import EventEmitter from 'events';
import { CyTubeConnection } from './connection.js';
import { DazzaPersonality } from './character.js';
import { CooldownManager } from '../utils/cooldowns.js';
import { PersistentCooldownManager } from '../utils/persistentCooldowns.js';
import { MemoryManager } from '../utils/memoryManager.js';
import { RateLimiter } from '../utils/rateLimiter.js';
import { formatDuration, formatTimestamp } from '../utils/formatting.js';
import { truncateMessage, MAX_MESSAGE_LENGTH } from '../utils/messageValidator.js';
import { createLogger } from '../utils/logger.js';
import { detectUrls, extractDomain } from '../utils/urlDetector.js';
import { fetchUrlTitleAndComment } from '../services/urlTitleFetcher.js';
import { OllamaService } from '../services/ollama.js';
import Database from '../services/database.js';
import { loadCommands } from '../commands/index.js';
import { HeistManager } from '../modules/heist/index.js';
import { VideoPayoutManager } from '../modules/video_payout/index.js';
import { PissingContestManager } from '../modules/pissing_contest/index.js';
import GalleryUpdater from '../modules/galleryUpdater.js';
import { normalizeUsernameForDb } from '../utils/usernameNormalizer.js';
import { CashMonitor } from '../utils/cashMonitor.js';
import { ApiServer } from '../api/server.js';
import { extractImageUrls } from '../utils/imageDetector.js';
import { ImageHealthChecker } from '../modules/imageHealthChecker.js';
import BatchScheduler from '../batch/BatchScheduler.js';
import { registerChatAnalyzers } from '../batch/registerAnalyzers.js';

export class CyTubeBot extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.connection = new CyTubeConnection(config);
        this.personality = new DazzaPersonality();
        this.cooldowns = new CooldownManager();
        this.memoryManager = new MemoryManager();
        this.rateLimiter = new RateLimiter({
            windowMs: 60000, // 1 minute
            maxRequests: 15, // 15 commands per minute
            warnThreshold: 0.8 // Warn at 12 commands
        });
        this.db = new Database(config.database.path, config.bot.username);
        this.commands = null;
        this.heistManager = null; // Initialize after database
        this.galleryUpdater = null; // Initialize after database
        this.logger = createLogger({
            level: config.logging?.level || 'info',
            console: config.logging?.console !== false
        });
        
        // Bot state
        this.username = config.bot.username; // Store bot username for commands
        this.startTime = Date.now();
        this.userlist = new Map();
        this.lastGreetings = new Map();
        this.admins = new Set(config.admins || []);
        
        // Greeting system
        this.lastGreetingTime = 0;
        this.greetingCooldown = this.getRandomGreetingCooldown(); // 5-15 minutes
        this.recentJoins = []; // Track recent joins to avoid spam
        this.pendingGreeting = null; // Track pending greeting timeout
        this.userDepartureTimes = new Map(); // Track when users left to implement 2-minute cooldown
        
        // URL comment cooldown - random between 2-15 minutes (Dazza's drunk and unreliable)
        this.lastUrlCommentTime = 0;
        this.urlCommentCooldown = this.getRandomUrlCooldown();
        
        // Ollama integration
        this.ollama = config.ollama?.enabled ? new OllamaService(config) : null;
        this.mentionCooldown = this.getRandomMentionCooldown(); // 10-30 seconds
        this.lastMentionTime = 0;
        this.recentMentions = new Map(); // Track mentions per user
        this.messageHistory = []; // Store last 10 messages for context
        this.maxHistorySize = 10;
        this.pendingMentionTimeouts = new Set(); // Track active mention timeouts
        
        // Message tracking to prevent duplicates
        this.processedMessages = new Set(); // Track processed message IDs
        this.maxProcessedSize = 1000; // Limit size to prevent memory issues
        this.staleMessageThreshold = 30000; // Ignore messages older than 30 seconds
        
        // Heist economy system
        this.heistManager = null;
        
        // Video payout system
        this.videoPayoutManager = null;
        
        // Cash monitoring system
        this.cashMonitor = null;
        
        // API server
        this.apiServer = null;
        
        // Batch processing scheduler
        this.batchScheduler = null;
        
        // Periodic task intervals
        this.reminderInterval = null;
        this.statsInterval = null;
        
        // Ready flag - don't process commands until fully initialized
        this.ready = false;
        
        // Media and playlist tracking
        this.currentMedia = null;
        this.playlist = [];
        this.playlistLocked = false;
        
        // Setup connection event handlers
        this.setupEventHandlers();
    }

    async init() {
        try {
            // Initialize database
            await this.db.init();
            this.db.setBot(this); // Set bot reference for WebSocket events
            
            // Load commands
            this.commands = await loadCommands();
            
            // Initialize HeistManager with bot reference
            this.heistManager = new HeistManager(this.db, this);
            this.setupHeistHandlers();
            await this.heistManager.init();
            
            // Initialize VideoPayoutManager
            this.videoPayoutManager = new VideoPayoutManager(this.db, this);
            this.setupVideoPayoutHandlers();
            await this.videoPayoutManager.init();
            
            // Initialize PissingContestManager
            this.pissingContestManager = new PissingContestManager(this);
            
            // Initialize GalleryUpdater - DISABLED: Using real-time API instead
            // this.galleryUpdater = new GalleryUpdater(this.db, this.logger);
            // this.galleryUpdater.start();
            
            // Initialize ImageHealthChecker
            this.imageHealthChecker = new ImageHealthChecker(this);
            this.imageHealthChecker.start();
            
            // Initialize CashMonitor (10 second interval)
            this.cashMonitor = new CashMonitor(this.db, this.logger, 10000);
            
            // Initialize Batch Scheduler for chat analytics
            this.batchScheduler = new BatchScheduler(this.db, this.logger);
            await this.batchScheduler.init();
            
            // Register chat analyzers (run every 4 hours)
            await registerChatAnalyzers(this.batchScheduler, this.db, this.logger, {
                intervalHours: 4,
                timezoneOffset: this.config.batch?.timezoneOffset || 0,
                runOnStartup: this.config.batch?.runOnStartup !== false // Default to true
            });
            
            // Start batch scheduler
            await this.batchScheduler.start();
            this.logger.info('Batch scheduler started');
            
            // Initialize API server
            this.apiServer = new ApiServer(this, this.config.api?.port || 3001);
            await this.apiServer.start();
            
            // Log initial connection attempt
            await this.db.logConnectionEvent('connect', { type: 'initial' });
            
            // Connect to CyTube
            await this.connection.connect();
            
            // Join channel
            await this.connection.joinChannel(this.config.cytube.channel);
            
            // Login if credentials are provided
            if (this.config.bot.username && this.config.bot.password) {
                await this.connection.login(this.config.bot.username, this.config.bot.password);
                
                // Wait 2 seconds after login before processing messages
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Start periodic tasks
            this.startPeriodicTasks();
            
            // Mark bot as ready to process commands
            this.ready = true;
            
            // Start cash monitoring now that bot is ready
            await this.cashMonitor.start();
            
            this.logger.info('Bot initialized successfully');
            
            // Request playlist data after joining channel
            setTimeout(() => {
                this.logger.debug('Setting up playlist handlers');
                if (this.connection && this.connection.socket) {
                    // Setup playlist event handlers once
                    if (!this.eventLoggingSetup) {
                        this.eventLoggingSetup = true;
                        
                        // Setup playlist event handlers directly on socket
                        this.connection.socket.on('playlist', (data) => this.handlePlaylist(data));
                        this.connection.socket.on('queue', (data) => this.handleQueue(data));
                        this.connection.socket.on('delete', (data) => this.handleDelete(data));
                        this.connection.socket.on('moveVideo', (data) => this.handleMoveVideo(data));
                        this.connection.socket.on('setPlaylistMeta', (data) => {
                            this.logger.debug('Playlist metadata received', data);
                        });
                        
                        // Only log non-spammy events for debugging
                        this.connection.socket.onAny((eventName, ...args) => {
                            if (!['chatMsg', 'mediaUpdate', 'usercount'].includes(eventName)) {
                                this.logger.debug(`CyTube event: ${eventName}`, { 
                                    argsCount: args.length
                                });
                            }
                        });
                    }
                    
                    // Request playlist from CyTube
                    this.connection.socket.emit('requestPlaylist');
                } else {
                    this.logger.warn('No socket available for playlist request');
                }
            }, 2000); // Small delay to ensure we're fully connected
        } catch (error) {
            this.logger.error('Failed to initialize bot', { error: error.message });
            throw error;
        }
    }

    setupEventHandlers() {
        // Connection events
        this.connection.on('disconnected', () => this.handleDisconnect());
        this.connection.on('reconnecting', () => this.handleReconnect());
        this.connection.on('reconnectFailed', () => {
            this.logger.error('Max reconnection attempts reached - giving up');
            // Optionally exit the process
            // process.exit(1);
        });
        this.connection.on('stateChange', (change) => {
            this.logger.connection(`state changed from ${change.from} to ${change.to}`);
            
            // Emit connection state changes for API WebSocket
            if (this.apiServer) {
                if (change.to === 'connected') {
                    this.emit('connected');
                } else if (change.to === 'disconnected') {
                    this.emit('disconnected');
                }
            }
        });
        
        // Chat events
        this.connection.on('chatMsg', (data) => this.handleChatMessage(data));
        this.connection.on('pm', (data) => this.handlePrivateMessage(data));
        
        // User events
        this.connection.on('userlist', (users) => this.handleUserlist(users));
        this.connection.on('addUser', (user) => this.handleUserJoin(user));
        this.connection.on('userLeave', (user) => this.handleUserLeave(user));
        this.connection.on('setAFK', (data) => this.handleAFKUpdate(data));
        
        // Channel events
        this.connection.on('rank', (rank) => this.handleRankUpdate(rank));
        
        // Media events
        this.connection.on('changeMedia', (data) => this.handleMediaChange(data));
        this.connection.on('mediaUpdate', (data) => this.handleMediaUpdate(data));
        
        // CyTube sends setCurrent to indicate which video in playlist is current
        this.connection.on('setCurrent', (data) => this.handleSetCurrent(data));
    }
    
    setupHeistHandlers() {
        // Listen for heist events and send messages
        this.heistManager.on('announce', (data) => {
            this.sendMessage(data.message);
        });
        
        this.heistManager.on('depart', (data) => {
            this.sendMessage(data.message);
        });
        
        this.heistManager.on('return', (data) => {
            this.sendMessage(data.message);
        });
        
        this.heistManager.on('payout', (data) => {
            this.sendMessage(data.message);
        });
        
        // Handle follow-up comments
        this.heistManager.on('comment', (data) => {
            this.sendMessage(data.message);
        });
        
        // Optional: Acknowledge votes (comment out if too spammy)
        this.heistManager.on('vote_registered', (data) => {
            // Only acknowledge vote changes to reduce spam
            if (data.changed) {
                const responses = [
                    `changed ya mind -${data.username}? ${data.crime} it is`,
                    `righto -${data.username}, switched to ${data.crime}`
                ];
                this.sendMessage(responses[Math.floor(Math.random() * responses.length)]);
            }
        });
        
        // Handle heist resume events after bot restart
        this.heistManager.on('resume_voting', (data) => {
            this.sendMessage(data.message);
        });
        
        this.heistManager.on('resume_progress', (data) => {
            this.sendMessage(data.message);
        });
    }
    
    setupVideoPayoutHandlers() {
        // Nothing to set up here - video payout works silently
        // All event handling is done through the existing handlers
    }

    async handleChatMessage(data) {
        // Generate a unique message ID based on username, message, and time
        const messageId = `${data.username}-${data.time || Date.now()}-${data.msg.substring(0, 20)}`;
        
        // Debug log for duplicate detection
        if (data.msg.includes('translate') || data.msg.includes('wukka')) {
            this.logger.debug('Processing message', { 
                messageId, 
                alreadyProcessed: this.processedMessages.has(messageId),
                processedSize: this.processedMessages.size 
            });
        }
        
        // Check if we've already processed this message
        if (this.processedMessages.has(messageId)) {
            this.logger.warn('Ignoring duplicate message', { 
                messageId,
                username: data.username,
                message: data.msg.substring(0, 50)
            });
            return;
        }
        
        // Check if message is stale (older than threshold)
        const messageTime = data.time || Date.now();
        const messageAge = Date.now() - messageTime;
        if (messageAge > this.staleMessageThreshold) {
            this.logger.debug('Ignoring stale message', { 
                username: data.username,
                age: Math.round(messageAge / 1000) + 's',
                message: data.msg.substring(0, 50)
            });
            return;
        }
        
        // Track this message as processed
        this.processedMessages.add(messageId);
        
        // Trim processed messages set if it gets too large
        if (this.processedMessages.size > this.maxProcessedSize) {
            const toDelete = this.processedMessages.size - (this.maxProcessedSize / 2);
            const iterator = this.processedMessages.values();
            for (let i = 0; i < toDelete; i++) {
                this.processedMessages.delete(iterator.next().value);
            }
        }
        
        // Ignore our own messages (check this BEFORE adding to history)
        // Check against both config username and stored username to handle any case differences
        const messageUsername = data.username.toLowerCase();
        const botUsername = this.config.bot.username.toLowerCase();
        const storedUsername = this.username.toLowerCase();
        
        if (messageUsername === botUsername || messageUsername === storedUsername) {
            // Log if our own messages contain HTML
            if (data.msg.includes('<strong>') || data.msg.includes('</strong>')) {
                this.logger.warn('Bot message contains HTML tags', { 
                    message: data.msg.substring(0, 100) 
                });
            }
            
            // Debug log to track bot's own messages being filtered
            this.logger.debug('Ignoring bot\'s own message', {
                messageUsername: data.username,
                botUsername: this.config.bot.username,
                storedUsername: this.username,
                message: data.msg.substring(0, 50)
            });
            
            return;
        }
        
        // Log all other users' messages to console
        console.log(`[${data.username}]: ${data.msg}`);
        
        // Add to message history for context (only for other users' messages)
        this.addToMessageHistory(data.username, data.msg, messageTime);

        // Don't process any messages until bot is fully initialized
        if (!this.ready) {
            this.logger.debug('Ignoring message - bot not ready yet', { 
                username: data.username,
                message: data.msg 
            });
            return;
        }

        // Debug log for heads/tails messages
        if (data.msg.toLowerCase() === 'heads' || data.msg.toLowerCase() === 'tails') {
            this.logger.info('Heads/tails message received', {
                username: data.username,
                message: data.msg,
                ready: this.ready,
                hasDb: !!this.db
            });
        }

        try {
            // Log entry into try block for heads/tails
            if (data.msg.toLowerCase() === 'heads' || data.msg.toLowerCase() === 'tails') {
                this.logger.info('Processing heads/tails in try block', {
                    username: data.username,
                    message: data.msg
                });
            }
            
            // Log message to database with normalized username and get the message ID
            const canonicalUsername = await normalizeUsernameForDb(this, data.username);
            const logResult = await this.db.logMessage(canonicalUsername, data.msg);
            const messageId = logResult.messageId || logResult; // Handle both old and new format
            
            // Check if any images were restored
            if (logResult.restoredImages && logResult.restoredImages.length > 0) {
                for (const restored of logResult.restoredImages) {
                    this.logger.info(`Restored previously dead image: ${restored.url}`);
                }
                // Notify in chat about restored image (Dazza style)
                setTimeout(() => {
                    this.sendMessage(`Oi fucken' oath! That pic's back from the dead! Thought it carked it but she's alive again!`);
                }, 2000);
            }
            
            
            // Emit events for API WebSocket
            if (this.apiServer) {
                // Strip HTML from message for clean display
                const cleanMessage = data.msg.replace(/<[^>]*>/g, '');
                
                // Emit chat message event
                this.emit('chat:message', {
                    username: data.username,
                    message: cleanMessage,
                    timestamp: Date.now(),
                    isPM: data.meta && data.meta.pm
                });
                
                // Emit user stats update
                this.emit('stats:user:update', {
                    username: canonicalUsername,
                    event: 'message'
                });
                
                // If images were added, emit gallery events
                const imageUrls = extractImageUrls(data.msg);
                for (const url of imageUrls) {
                    this.emit('gallery:image:added', {
                        username: canonicalUsername,
                        url,
                        timestamp: Date.now()
                    });
                }
            }

            // Detect and log URLs in the message
            const urlDetection = detectUrls(data.msg);
            if (urlDetection.hasUrls) {
                // Process first URL only (to avoid spam)
                const urlData = urlDetection.urls[0];
                
                // Add domain to the URL data
                urlData.domain = extractDomain(urlData.url);
                
                // Log the URL to database
                await this.db.logUrl(data.username, urlData, messageId);
                
                this.logger.debug('URL detected', {
                    username: data.username,
                    url: urlData.url,
                    type: urlData.type,
                    domain: urlData.domain
                });
                
                // Check if we should comment on the URL
                const now = Date.now();
                const timeSinceLastComment = now - this.lastUrlCommentTime;
                
                // Only respond to about 50% of links (Dazza's drunk and misses half)
                const shouldRespond = Math.random() < 0.5;
                
                if (shouldRespond && timeSinceLastComment > this.urlCommentCooldown) {
                    // Fetch title and make contextual comment
                    const comment = await fetchUrlTitleAndComment(urlData, data.username);
                    if (comment) {
                        this.lastUrlCommentTime = now;
                        // Set new random cooldown for next time
                        this.urlCommentCooldown = this.getRandomUrlCooldown();
                        
                        // Add a delay (1-5 seconds - drunk typing speed)
                        const drunkDelay = 1000 + Math.random() * 4000;
                        setTimeout(() => {
                            this.sendMessage(comment);
                        }, drunkDelay);
                        
                        this.logger.debug(`Commented on YouTube link, next possible in ${Math.round(this.urlCommentCooldown / 60000)} minutes`);
                    }
                } else if (!shouldRespond) {
                    this.logger.debug('Skipped YouTube link (drunk roll failed)');
                } else {
                    this.logger.debug(`Skipped YouTube link (cooldown: ${Math.round((this.urlCommentCooldown - timeSinceLastComment) / 1000)}s remaining)`);
                }
            }

            // Check for tells
            await this.checkAndDeliverTells(data.username);
            
            // Notify heist manager of message activity
            if (this.heistManager) {
                await this.heistManager.handleMessage(data.username, data.msg);
            }
            
            // Check for mentions of Dazza (but not from the bot itself or server messages)
            if (this.ollama && this.hasMention(data.msg)) {
                // Double-check we're not responding to ourselves or server messages
                const senderLower = data.username.toLowerCase();
                if (senderLower === this.config.bot.username.toLowerCase() || 
                    senderLower === this.username.toLowerCase() ||
                    senderLower === '[server]') {
                    this.logger.debug('Ignoring mention from bot/server', { 
                        username: data.username,
                        message: data.msg.substring(0, 50)
                    });
                } else {
                    this.logger.debug('Mention detected', { 
                        username: data.username, 
                        message: data.msg,
                        timestamp: new Date().toISOString()
                    });
                    await this.handleMention(data);
                }
            }

            // Check if it's a command
            // Check for pissing contest responses (yes/no)
            const lowerMsg = data.msg.toLowerCase().trim();
            if (this.pissingContestManager) {
                const challenge = this.pissingContestManager.findChallengeForUser(data.username);
                if (challenge) {
                    // Check if it's an accept/decline phrase
                    const acceptPhrases = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay',
                        'bring it on', 'you\'re on', 'let\'s go', 'fuck yeah',
                        'whip it out', 'dicks out', 'let\'s piss',
                        'prepare to lose', 'easy money', 'bet'];
                    const declinePhrases = ['no', 'nah', 'nope', 'pass',
                        'fuck off', 'piss off', 'not now',
                        'maybe later', 'busy', 'can\'t'];
                    
                    if (acceptPhrases.includes(lowerMsg)) {
                        const result = await this.pissingContestManager.acceptChallenge(data.username);
                        if (!result.success) {
                            this.sendMessage(result.message);
                        }
                        return;
                    } else if (declinePhrases.includes(lowerMsg)) {
                        const result = await this.pissingContestManager.declineChallenge(data.username);
                        this.sendMessage(result.message);
                        return;
                    }
                }
            }

            // Check for coin flip responses
            if ((data.msg.toLowerCase() === 'heads' || data.msg.toLowerCase() === 'tails') && this.db) {
                this.logger.info('Checking for coin flip response', {
                    username: data.username,
                    message: data.msg,
                    hasDb: !!this.db
                });
                
                // Debug: Check all pending challenges
                const allPendingChallenges = await this.db.all(
                    'SELECT * FROM coin_flip_challenges WHERE status = ?',
                    ['pending']
                );
                
                this.logger.info('All pending challenges', {
                    count: allPendingChallenges.length,
                    challenges: allPendingChallenges
                });
                
                // Check if this user has a pending coin flip challenge
                const pendingChallenge = await this.db.get(
                    'SELECT * FROM coin_flip_challenges WHERE LOWER(challenged) = LOWER(?) AND status = ?',
                    [data.username, 'pending']
                );
                
                this.logger.info('Coin flip challenge query result', {
                    username: data.username,
                    usernameLower: data.username.toLowerCase(),
                    foundChallenge: !!pendingChallenge,
                    challenge: pendingChallenge
                });
                
                if (pendingChallenge) {
                    this.logger.info('Found pending challenge, looking for coin flip command');
                    
                    // Process the coin flip response
                    const coinFlipCommand = this.commands.commands.get('coin_flip') || 
                                          this.commands.commands.get('coinflip') ||
                                          this.commands.commands.get('cf');
                    
                    this.logger.info('Coin flip command lookup', {
                        found: !!coinFlipCommand,
                        hasHandler: !!(coinFlipCommand && coinFlipCommand.handleChallengeResponse),
                        commandKeys: Array.from(this.commands.commands.keys()).slice(0, 10)
                    });
                    
                    if (coinFlipCommand && coinFlipCommand.handleChallengeResponse) {
                        this.logger.info('Calling handleChallengeResponse');
                        await coinFlipCommand.handleChallengeResponse(
                            this, 
                            { username: data.username, isPM: false }, 
                            data.msg.toLowerCase()
                        );
                        this.logger.info('handleChallengeResponse completed');
                        return;
                    } else {
                        this.logger.error('Cannot process coin flip response', {
                            commandFound: !!coinFlipCommand,
                            hasHandler: !!(coinFlipCommand && coinFlipCommand.handleChallengeResponse)
                        });
                    }
                }
            }
            
            if (data.msg.startsWith('!')) {
                await this.handleCommand(data);
            }
        } catch (error) {
            this.logger.error('Error handling chat message', { 
                error: error.message,
                username: data.username,
                message: data.msg 
            });
        }
    }

    async handleCommand(data) {
        // Check rate limit first
        const rateLimit = this.rateLimiter.check(data.username);
        
        if (!rateLimit.allowed) {
            this.sendMessage(`oi ${data.username} fuckin ease up on the commands ya pelican, give it ${rateLimit.resetIn}s`);
            return;
        }
        
        if (rateLimit.shouldWarn) {
            this.sendMessage(`${data.username} steady on cobber, you're nearly at the limit ay (${rateLimit.requests}/${rateLimit.limit})`);
        }

        const parts = data.msg.slice(1).split(' ');
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        const result = await this.commands.execute(commandName, this, {
            username: data.username,
            msg: data.msg,
            time: data.time || Date.now()
        }, args);
        
        // Log successful command execution
        if (result.success) {
            this.logger.command(data.username, commandName, args);
        }

        if (!result.success && result.error === 'Command not found') {
            // Don't respond to unknown commands
            return;
        }

        if (!result.success && result.error) {
            this.sendMessage(`${data.username}: ${result.error}`);
        }
    }

    handleUserlist(users) {
        this.userlist.clear();
        let afkCount = 0;
        
        users.forEach(user => {
            this.userlist.set(user.name.toLowerCase(), user);
            // Count AFK users on initial load (check both locations)
            if (user.afk === true || (user.meta && user.meta.afk === true)) {
                afkCount++;
            }
        });
        
        this.logger.info(`Loaded ${users.length} users in channel (${afkCount} AFK)`);
        
        // Notify video payout manager of userlist update
        if (this.videoPayoutManager) {
            this.videoPayoutManager.handleUserlistUpdate().catch(err =>
                this.logger.error('Failed to handle userlist update for video payout', { error: err.message })
            );
        }
        
        // Debug: Log complete user data for first few users
        if (users.length > 0) {
            this.logger.debug('First user full data:', JSON.stringify(users[0]));
            this.logger.debug('User object properties:', Object.keys(users[0]));
            
            // Check specifically for AFK users
            users.forEach(user => {
                if (user.meta && typeof user.meta === 'object') {
                    this.logger.debug(`User ${user.name} has meta:`, JSON.stringify(user.meta));
                }
            });
        }
    }

    handleUserJoin(user) {
        // Debug log to track duplicate calls
        this.logger.debug(`handleUserJoin called for ${user.name} at ${new Date().toISOString()}`);
        
        this.userlist.set(user.name.toLowerCase(), user);
        
        // Log join event
        this.db.logUserEvent(user.name, 'join').catch(err => 
            this.logger.error('Failed to log join event', { error: err.message, user: user.name })
        );
        
        this.logger.userEvent(user.name, 'join');
        
        // Emit user join event for API WebSocket
        if (this.apiServer) {
            this.emit('user:join', user.name);
            this.emit('stats:channel:activity', {
                activeUsers: this.userlist.size,
                event: 'user_joined',
                username: user.name
            });
        }
        
        // Track join for spam prevention
        this.recentJoins.push(Date.now());

        // Check if we should greet
        if (this.config.greeting.enabled && this.shouldGreetUser(user.name)) {
            // Cancel any pending greeting
            if (this.pendingGreeting) {
                clearTimeout(this.pendingGreeting);
                this.pendingGreeting = null;
            }
            
            // Random typing delay between 1-3 seconds
            const typingDelay = 1000 + Math.random() * 2000;
            
            this.pendingGreeting = setTimeout(async () => {
                // Double-check we haven't been cancelled
                if (!this.pendingGreeting) return;
                
                const greeting = await this.getRandomGreeting(user.name);
                this.sendMessage(greeting);
                
                // Update greeting tracking
                this.lastGreetingTime = Date.now();
                this.greetingCooldown = this.getRandomGreetingCooldown();
                this.pendingGreeting = null;
                
                this.logger.debug(`Greeted ${user.name}, next greeting possible in ${Math.round(this.greetingCooldown / 60000)} minutes`);
            }, typingDelay);
        }

        // No need to notify heist manager of joins - it tracks activity through messages

        // Track for video payout
        if (this.videoPayoutManager) {
            this.videoPayoutManager.handleUserJoin(user.name).catch(err =>
                this.logger.error('Failed to track user join for video payout', { error: err.message, user: user.name })
            );
        }

        // Check for tells after a short delay (to let them settle in)
        // Use a unique timeout key to prevent duplicate checks
        const tellCheckKey = `tellCheck_${user.name}_${Date.now()}`;
        if (!this.pendingTellChecks) {
            this.pendingTellChecks = new Set();
        }
        
        // If we already have a pending check for this user, skip
        const hasPendingCheck = Array.from(this.pendingTellChecks).some(key => 
            key.startsWith(`tellCheck_${user.name}_`)
        );
        
        if (!hasPendingCheck) {
            this.pendingTellChecks.add(tellCheckKey);
            setTimeout(() => {
                this.checkAndDeliverTells(user.name);
                this.pendingTellChecks.delete(tellCheckKey);
            }, 2000);
        }
    }

    handleUserLeave(user) {
        this.userlist.delete(user.name.toLowerCase());
        
        // Track departure time for greeting cooldown
        this.userDepartureTimes.set(user.name.toLowerCase(), Date.now());
        
        // Clean up old departure times (older than 1 hour)
        const oneHourAgo = Date.now() - 3600000;
        for (const [username, time] of this.userDepartureTimes) {
            if (time < oneHourAgo) {
                this.userDepartureTimes.delete(username);
            }
        }
        
        // Log leave event
        this.db.logUserEvent(user.name, 'leave').catch(err => 
            this.logger.error('Failed to log leave event', { error: err.message, user: user.name })
        );
        
        this.logger.userEvent(user.name, 'leave');
        
        // Emit user leave event for API WebSocket
        if (this.apiServer) {
            this.emit('user:leave', user.name);
            this.emit('stats:channel:activity', {
                activeUsers: this.userlist.size,
                event: 'user_left',
                username: user.name
            });
        }
        
        // Track for video payout
        if (this.videoPayoutManager) {
            this.videoPayoutManager.handleUserLeave(user.name).catch(err =>
                this.logger.error('Failed to track user leave for video payout', { error: err.message, user: user.name })
            );
        }
    }

    handleRankUpdate(rank) {
        this.logger.info(`Bot rank updated to: ${rank}`);
    }
    
    async handleMediaChange(data) {
        this.logger.info(`Media changed: ${data.title || 'Unknown'} (ID: ${data.id || 'unknown'})`);
        
        // Update current media
        this.currentMedia = data;
        
        // Emit media change event for API WebSocket
        if (this.apiServer) {
            this.emit('media:change', {
                title: data.title,
                id: data.id,
                type: data.type,
                duration: data.duration || data.seconds
            });
        }
        
        if (this.videoPayoutManager) {
            this.videoPayoutManager.handleMediaChange(data).catch(err =>
                this.logger.error('Failed to handle media change for video payout', { error: err.message })
            );
        }
    }
    
    handleMediaUpdate(data) {
        // Media updates happen frequently (time updates), only log if needed for debugging
        // this.logger.debug('Media update', data);
        if (this.currentMedia) {
            this.currentMedia.currentTime = data.currentTime || 0;
            this.currentMedia.paused = data.paused || false;
        }
    }
    
    handlePlaylist(data) {
        // Full playlist update
        this.playlist = data || [];
        this.logger.info(`Playlist updated: ${this.playlist.length} videos`);
        
        // Debug logging removed - playlist structure confirmed
    }
    
    handleSetCurrent(data) {
        // CyTube sends this to indicate current video position
        this.logger.debug(`Current video set to position: ${data}`);
    }
    
    handleQueue(data) {
        // Video added to queue
        if (data.item) {
            if (data.after) {
                // Find position and insert after
                const index = this.playlist.findIndex(v => v.uid === data.after);
                if (index >= 0) {
                    this.playlist.splice(index + 1, 0, data.item);
                } else {
                    this.playlist.push(data.item);
                }
            } else {
                // Add to end
                this.playlist.push(data.item);
            }
            this.logger.debug(`Video queued: ${data.item.title}`);
        }
    }
    
    handleDelete(data) {
        // Video removed from queue
        const index = this.playlist.findIndex(v => v.uid === data.uid);
        if (index >= 0) {
            const removed = this.playlist.splice(index, 1)[0];
            this.logger.debug(`Video removed: ${removed.title}`);
        }
    }
    
    handleMoveVideo(data) {
        // Video moved in queue
        const fromIndex = this.playlist.findIndex(v => v.uid === data.from);
        if (fromIndex >= 0) {
            const video = this.playlist.splice(fromIndex, 1)[0];
            
            if (data.after) {
                const toIndex = this.playlist.findIndex(v => v.uid === data.after);
                if (toIndex >= 0) {
                    this.playlist.splice(toIndex + 1, 0, video);
                } else {
                    this.playlist.push(video);
                }
            } else {
                // Move to beginning
                this.playlist.unshift(video);
            }
        }
    }
    
    getUserlist() {
        return this.userlist;
    }
    
    handleAFKUpdate(data) {
        // data should contain { name: username, afk: boolean }
        const user = this.userlist.get(data.name.toLowerCase());
        if (user) {
            const wasAFK = user.afk === true || (user.meta && user.meta.afk === true);
            
            // Update AFK status in both possible locations
            user.afk = data.afk;
            if (!user.meta) {
                user.meta = {};
            }
            user.meta.afk = data.afk;
            this.logger.debug(`User ${data.name} AFK status: ${data.afk}`);
            
            // If user just came back from AFK, check for tells
            if (wasAFK && !data.afk) {
                this.logger.debug(`${data.name} returned from AFK, checking for tells`);
                setTimeout(() => {
                    this.checkAndDeliverTells(data.name);
                }, 1500); // Small delay to make it feel natural
            }
        }
    }

    async handleDisconnect() {
        this.logger.connection('disconnected');
        
        // Stop cash monitoring
        if (this.cashMonitor) {
            this.cashMonitor.stop();
        }
        
        // Pause batch scheduler to prevent SQL errors during disconnect
        if (this.batchScheduler && this.batchScheduler.isRunning) {
            this.logger.info('Pausing batch scheduler during disconnect');
            await this.batchScheduler.stop();
        }
        
        // Clean up database state (rollback transactions, etc.)
        if (this.db && this.db.cleanup) {
            this.logger.debug('Cleaning up database state');
            await this.db.cleanup();
        }
        
        // Clear all pending mention timeouts
        this.pendingMentionTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.pendingMentionTimeouts.clear();
        
        // Clear pending tell checks
        if (this.pendingTellChecks) {
            this.pendingTellChecks.clear();
        }
        
        // Clear message history and processed messages to avoid stale data
        this.messageHistory = [];
        this.processedMessages.clear();
        this.recentMentions.clear();
        
        this.logger.debug('Cleared message history, timeouts, and tracking data on disconnect');
    }

    async handleReconnect() {
        this.logger.connection('reconnecting');
        
        // Check if we can reconnect (30 second minimum delay)
        const canConnect = await this.db.canConnect(30000);
        if (!canConnect) {
            const lastConnect = await this.db.getLastConnectionTime('connect');
            const timeSince = Date.now() - lastConnect;
            const waitTime = Math.ceil((30000 - timeSince) / 1000);
            
            this.logger.info(`Connection throttled - waiting ${waitTime}s before reconnecting (good neighbor policy)`);
            
            // Schedule reconnect after the required delay
            setTimeout(() => {
                this.handleReconnect();
            }, waitTime * 1000);
            return;
        }
        
        // Clear all pending mention timeouts
        this.pendingMentionTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.pendingMentionTimeouts.clear();
        
        // Clear pending tell checks
        if (this.pendingTellChecks) {
            this.pendingTellChecks.clear();
        }
        
        // Clear any stale data before reconnecting
        this.messageHistory = [];
        this.processedMessages.clear();
        this.recentMentions.clear();
        
        try {
            // Log connection attempt
            await this.db.logConnectionEvent('connect', { type: 'reconnect' });
            
            // Don't call init() again - just reconnect
            await this.connection.connect();
            await this.connection.joinChannel(this.config.cytube.channel);
            
            if (this.config.bot.username && this.config.bot.password) {
                await this.connection.login(this.config.bot.username, this.config.bot.password);
            }
            
            this.logger.info('Reconnection successful');
            
            // Restart batch scheduler after successful reconnection
            if (this.batchScheduler && !this.batchScheduler.isRunning) {
                this.logger.info('Restarting batch scheduler after reconnection');
                await this.batchScheduler.start();
            }
        } catch (error) {
            this.logger.error('Reconnection failed', { error: error.message });
            
            // Log failed attempt
            await this.db.logConnectionEvent('connect_failed', { error: error.message });
            
            // If it's a rate limit error, the connection handler already increased the delay
            // Otherwise, schedule another reconnect
            if (!error.message.includes('Rate limit') && !error.message.includes('Too soon')) {
                this.connection.scheduleReconnect();
            }
        }
    }

    sendMessage(message, context = null) {
        // Check if we're in a PM context and should send PM response
        if (context && context.isPM && context.pmResponses) {
            this.sendPrivateMessage(context.username, message);
            return;
        }
        
        // If message is an array, it's already been split by Ollama service
        if (Array.isArray(message)) {
            // Send each message with delays
            let delay = 0;
            message.forEach((msg, index) => {
                setTimeout(() => {
                    // Apply character personality to each message
                    const processedMsg = this.personality.processMessage(msg);
                    console.log(`[${this.username}]: ${processedMsg}`);
                    this.connection.sendChatMessage(processedMsg);
                }, delay);
                // Add 2-4 seconds between messages
                delay += 2000 + Math.random() * 2000;
            });
            return;
        }
        
        // Single message - apply personality and send
        const processedMessage = this.personality.processMessage(message);
        
        // Split if too long rather than truncating
        if (processedMessage.length > MAX_MESSAGE_LENGTH) {
            const messages = this.splitLongMessage(processedMessage);
            this.sendMessage(messages, context); // Recursive call with array
            return;
        }
        
        // Log bot's own messages to console
        console.log(`[${this.username}]: ${processedMessage}`);
        
        this.connection.sendChatMessage(processedMessage);
    }

    isAdmin(username) {
        return this.admins.has(username.toLowerCase());
    }
    
    isUserAFK(username) {
        const user = this.userlist.get(username.toLowerCase());
        if (!user) return false;
        
        // Check both direct afk property and meta.afk
        return user.afk === true || (user.meta && user.meta.afk === true);
    }
    
    getAFKUsers() {
        const afkUsers = [];
        this.userlist.forEach((user, name) => {
            // Check both direct afk property and meta.afk
            if (user.afk === true || (user.meta && user.meta.afk === true)) {
                afkUsers.push(user.name);
            }
        });
        return afkUsers;
    }

    getUptime() {
        return formatDuration(Date.now() - this.startTime);
    }
    
    /**
     * Split a long message into multiple messages at word boundaries
     * @param {string} message - The message to split
     * @returns {string[]} Array of messages
     */
    splitLongMessage(message) {
        const messages = [];
        const words = message.split(' ');
        let currentMessage = '';
        
        for (const word of words) {
            if ((currentMessage + ' ' + word).length > MAX_MESSAGE_LENGTH) {
                if (currentMessage) {
                    messages.push(currentMessage.trim());
                }
                currentMessage = word;
            } else {
                currentMessage += (currentMessage ? ' ' : '') + word;
            }
        }
        
        if (currentMessage) {
            messages.push(currentMessage.trim());
        }
        
        // Limit to 3 messages max
        return messages.slice(0, 3);
    }

    async checkAndDeliverTells(username) {
        try {
            const tells = await this.db.getTellsForUser(username);
            
            for (let i = 0; i < tells.length; i++) {
                const tell = tells[i];
                const timeDiff = Date.now() - tell.created_at;
                const minutes = Math.floor(timeDiff / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);
                
                let timeAgo;
                if (days > 0) {
                    timeAgo = `${days} day${days > 1 ? 's' : ''} ago`;
                } else if (hours > 0) {
                    timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
                } else if (minutes > 0) {
                    timeAgo = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
                } else {
                    timeAgo = 'just now';
                }
                
                const deliveryMessages = [
                    `oi ${username}! ${tell.from_user} told me to tell ya "${tell.message}" (${timeAgo})`,
                    `${username} mate, got a message from ${tell.from_user} for ya: "${tell.message}" (${timeAgo})`,
                    `ey ${username}, ${tell.from_user} left this for ya ${timeAgo}: "${tell.message}"`,
                    `${username}! ${tell.from_user} said to pass this on: "${tell.message}" (${timeAgo})`,
                    `about time ya showed up ${username}, ${tell.from_user} wanted me to tell ya: "${tell.message}" (${timeAgo})`
                ];
                
                // Delay messages slightly to avoid spam
                setTimeout(() => {
                    if (tell.via_pm) {
                        // Tell was sent via PM, deliver privately
                        const publicNotifications = [
                            `oi ${username}, check ya PMs mate!`,
                            `${username}, ya got a private message waiting`,
                            `psst ${username}, slide into ya DMs for a message`,
                            `${username} mate, check ya inbox`
                        ];
                        
                        this.sendMessage(publicNotifications[Math.floor(Math.random() * publicNotifications.length)]);
                        
                        // Send the actual message via PM
                        const pmMessage = `Private message from ${tell.from_user} (${timeAgo}): "${tell.message}"`;
                        this.sendPrivateMessage(username, pmMessage);
                    } else {
                        // Regular public tell
                        this.sendMessage(deliveryMessages[Math.floor(Math.random() * deliveryMessages.length)]);
                    }
                }, 1500 + (i * 2000));
                
                await this.db.markTellDelivered(tell.id);
            }
        } catch (error) {
            this.logger.error('Failed to deliver tells', { error: error.message, username });
        }
    }

    async checkReminders() {
        try {
            const reminders = await this.db.getDueReminders();
            
            for (const reminder of reminders) {
                let delivered = false;
                
                if (reminder.to_user === '@me') {
                    // Always deliver self-reminders
                    const selfDeliveries = [
                        `oi -${reminder.from_user} ya wanted me to remind ya: ${reminder.message}`,
                        `-${reminder.from_user} mate, reminder time: ${reminder.message}`,
                        `ey -${reminder.from_user}, you told me to bug ya about this: ${reminder.message}`,
                        `*taps -${reminder.from_user} on shoulder* time for: ${reminder.message}`,
                        `WAKE UP -${reminder.from_user}! ${reminder.message}`,
                        `reminder for -${reminder.from_user}: ${reminder.message}`,
                        `-${reminder.from_user}! oi! ${reminder.message}`,
                        `this is your reminder -${reminder.from_user}: ${reminder.message}`
                    ];
                    this.sendMessage(selfDeliveries[Math.floor(Math.random() * selfDeliveries.length)]);
                    delivered = true;
                } else {
                    // Check if target user is online
                    const user = this.userlist.get(reminder.to_user.toLowerCase());
                    if (user) {
                        // Calculate how late the reminder is
                        const now = Date.now();
                        const lateness = now - reminder.remind_at;
                        
                        // If more than 1 minute late, mention it
                        if (lateness > 60000) {
                            const lateMinutes = Math.floor(lateness / 60000);
                            const lateHours = Math.floor(lateMinutes / 60);
                            
                            let lateText;
                            if (lateHours > 0) {
                                lateText = `${lateHours}h ${lateMinutes % 60}m late`;
                            } else {
                                lateText = `${lateMinutes}m late`;
                            }
                            
                            const lateDeliveries = [
                                `-${reminder.to_user} oi listen up, -${reminder.from_user} wanted me to tell ya: ${reminder.message} (sorry mate, ${lateText} - you were offline)`,
                                `finally caught ya -${reminder.to_user}! -${reminder.from_user} wanted me to tell ya: ${reminder.message} (${lateText} late, where were ya?)`,
                                `-${reminder.to_user}! about bloody time! -${reminder.from_user} said: ${reminder.message} (${lateText} ago)`,
                                `ey -${reminder.to_user}, got a late message from -${reminder.from_user}: ${reminder.message} (supposed to be ${lateText} ago)`,
                                `-${reminder.to_user} ya finally showed up! -${reminder.from_user} wanted ya to know: ${reminder.message} (${lateText} late)`
                            ];
                            this.sendMessage(lateDeliveries[Math.floor(Math.random() * lateDeliveries.length)]);
                        } else {
                            const onTimeDeliveries = [
                                `-${reminder.to_user} oi listen up, -${reminder.from_user} wanted me to tell ya: ${reminder.message}`,
                                `message for -${reminder.to_user} from -${reminder.from_user}: ${reminder.message}`,
                                `ey -${reminder.to_user}! -${reminder.from_user} says: ${reminder.message}`,
                                `-${reminder.to_user} mate, -${reminder.from_user} told me to remind ya: ${reminder.message}`,
                                `*pokes -${reminder.to_user}* message from -${reminder.from_user}: ${reminder.message}`,
                                `attention -${reminder.to_user}! -${reminder.from_user} wants ya to know: ${reminder.message}`,
                                `-${reminder.to_user}, got something for ya from -${reminder.from_user}: ${reminder.message}`
                            ];
                            this.sendMessage(onTimeDeliveries[Math.floor(Math.random() * onTimeDeliveries.length)]);
                        }
                        delivered = true;
                    } else {
                        // User is offline, keep checking until they come online
                        this.logger.debug(`Reminder for offline user ${reminder.to_user}, will retry later`);
                    }
                }
                
                // Only mark as delivered if actually sent
                if (delivered) {
                    await this.db.markReminderDelivered(reminder.id);
                }
            }
        } catch (error) {
            this.logger.error('Failed to check reminders', { error: error.message });
        }
    }

    startPeriodicTasks() {
        // Check reminders every minute
        this.reminderInterval = setInterval(() => this.checkReminders(), this.config.reminder.checkInterval);
        
        // Log stats periodically
        this.statsInterval = setInterval(() => {
            this.logger.info('Bot stats', {
                uptime: this.getUptime(),
                usersOnline: this.userlist.size,
                memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
            });
        }, 5 * 60 * 1000); // Every 5 minutes
        
        // Start memory cleanup for greeting map
        this.memoryManager.startCleanup(this.lastGreetings);
        
        // Start rate limiter cleanup
        this.rateLimiter.startAutoCleanup();
        
        // Clean up old persistent cooldowns daily
        this.cooldownCleanupInterval = setInterval(async () => {
            try {
                const cooldownManager = new PersistentCooldownManager(this.db);
                await cooldownManager.cleanupOldCooldowns();
                this.logger.info('Cleaned up old cooldowns');
            } catch (error) {
                this.logger.error('Failed to clean up cooldowns', { error: error.message });
            }
        }, 24 * 60 * 60 * 1000); // Every 24 hours
    }

    getRandomGreetingCooldown() {
        // Random cooldown between 5-15 minutes
        return 300000 + Math.random() * 600000; // 5 min + 0-10 min
    }
    
    getRandomUrlCooldown() {
        // Random cooldown between 2-15 minutes (Dazza's attention span varies when drunk)
        return 120000 + Math.random() * 780000; // 2min + 0-13min
    }
    
    getRandomMentionCooldown() {
        // Random cooldown between 5-15 seconds (reduced from 10-30)
        return 5000 + Math.random() * 10000; // 5s + 0-10s
    }
    
    shouldGreetUser(username) {
        // Don't greet if not fully ready
        if (!this.ready) return false;
        
        // Don't greet ourselves
        if (username.toLowerCase() === this.config.bot.username.toLowerCase()) return false;
        
        // Check if user recently left (within 2 minutes)
        const userLower = username.toLowerCase();
        const departureTime = this.userDepartureTimes.get(userLower);
        if (departureTime) {
            const timeSinceDeparture = Date.now() - departureTime;
            if (timeSinceDeparture < 120000) { // 2 minutes in milliseconds
                this.logger.debug(`Not greeting ${username} - only gone for ${Math.round(timeSinceDeparture / 1000)}s`);
                return false;
            }
            // Remove from tracking since they've been gone long enough
            this.userDepartureTimes.delete(userLower);
        }
        
        // Check if enough time has passed since last greeting
        const now = Date.now();
        if (now - this.lastGreetingTime < this.greetingCooldown) return false;
        
        // Clear old joins from recent list (older than 30 seconds)
        this.recentJoins = this.recentJoins.filter(join => now - join < 30000);
        
        // Don't greet if there's been a lot of recent activity
        if (this.recentJoins.length > 2) return false;
        
        // Add some randomness - 70% chance to greet when conditions are met
        return Math.random() < 0.7;
    }
    
    async getRandomGreeting(username) {
        // Check if this is a first-time user
        try {
            const userStats = await this.db.get(
                'SELECT first_seen FROM user_stats WHERE username = ?',
                [username]
            );
            
            // If no stats exist, this is a first-time user
            if (!userStats) {
                const firstTimeGreetings = [
                    `oi ${username}, I haven't seen you around here before!`,
                    `who the fuck is ${username}? never seen ya before mate`,
                    `${username}? new face! welcome to the shitshow`,
                    `fuckin hell, fresh meat! welcome ${username}`,
                    `${username}! first time? this place'll ruin ya`,
                    `never seen ${username} before, you a cop?`,
                    `${username}'s new! someone get 'em a beer`,
                    `oi everyone, ${username}'s a virgin! first timer!`,
                    `${username}? don't recognize ya mate, welcome aboard`,
                    `new cunt alert! ${username}'s here for the first time`,
                    `${username}! fresh face, prepare to be corrupted`,
                    `who invited ${username}? kidding, welcome newbie`,
                    `${username}'s cherry's about to be popped, first timer!`,
                    `strewth, ${username}! never seen ya round these parts`,
                    `${username}? you lost mate? welcome anyway`,
                    `fresh blood! ${username}'s new to this circus`,
                    `${username}! hope you're ready for this shitshow`,
                    `never seen ${username} before, must be fresh off the boat`,
                    `oi ${username}, first time? you're in for a treat`,
                    `${username}'s new! quick, act normal everyone`,
                    `welcome ${username}! we don't bite... much`,
                    `${username}? new face! this your first rodeo?`,
                    `fuckin oath, ${username}'s a first timer!`
                ];
                
                return firstTimeGreetings[Math.floor(Math.random() * firstTimeGreetings.length)];
            }
        } catch (err) {
            this.logger.error('Error checking if user is first-time:', err);
            // Fall through to regular greetings on error
        }
        
        // Regular greetings for returning users
        const greetings = [
            `oi ${username}, how's it goin mate`,
            `${username}! good to see ya cobber`,
            `fuckin hell ${username}'s here`,
            `${username} mate! pull up a chair`,
            `look who rocked up, ${username}!`,
            `${username}! just in time for a cone`,
            `ey ${username}, grab us a beer while you're up`,
            `${username}'s here, party can start now`,
            `about time ${username} showed up`,
            `${username}! where ya been mate`,
            `well well well, if it isn't ${username}`,
            `${username} ya legend`,
            `${username}! thought you were dead mate`,
            `${username} just in time, we're gettin on the piss`,
            `strewth, ${username}'s graced us with their presence`,
            `${username} mate, long time no see`,
            `${username}! ya missed all the good stuff`,
            `look what the cat dragged in, ${username}`,
            `${username}! still breathin I see`,
            `${username} decided to show up ay`,
            `g'day ${username}`,
            `${username}! ya beauty`,
            `finally ${username}, been waitin for ages`,
            `${username} rocks up fashionably late as usual`,
            `there's ${username}, hide the bongs`,
            `${username}! shazza's been askin about ya`,
            `${username} in the house`,
            `bloody oath, ${username}'s here`
        ];
        
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    /**
     * Add message to history buffer
     * @param {string} username 
     * @param {string} message 
     * @param {number} timestamp - Message timestamp
     */
    addToMessageHistory(username, message, timestamp = Date.now()) {
        this.messageHistory.push({ username, message, timestamp });
        
        // Keep only last N messages
        if (this.messageHistory.length > this.maxHistorySize) {
            this.messageHistory.shift();
        }
    }
    
    /**
     * Check if message contains a mention of Dazza
     * @param {string} message 
     * @returns {boolean}
     */
    hasMention(message) {
        const lowerMsg = message.toLowerCase();
        
        // Patterns that indicate talking ABOUT Dazza, not TO him
        const aboutDazzaPatterns = [
            /\b(dazza|daz)'s\b/i,                          // Possessive (dazza's)
            /\b(dazza|daz)\s+(took|nicked|already|scrapes|cut|share|profit)/i, // Heist narratives
            /\b(after|minus|with)\s+(dazza|daz)/i,         // Prepositional phrases
        ];
        
        // If it's talking ABOUT Dazza, not a mention
        if (aboutDazzaPatterns.some(pattern => pattern.test(lowerMsg))) {
            return false;
        }
        
        // Patterns for actual mentions/addresses to Dazza
        const mentionPatterns = [
            /^(hey |hi |yo |oi |g'day |sup )?(dazza|daz)([,!?]|\s|$)/i,  // Greeting at start
            /[,.!?;]\s*(hey |hi |yo |oi )?(dazza|daz)([,!?]|\s|$)/i,     // After punctuation
            /\b(dazza|daz)[,!?]?\s+(you|ya|mate|cunt|there)/i,           // Direct address
            /@(dazza|daz)\b/i,                                            // @ mention style
            /\b(dazza|daz)\s*\?/i,                                        // Question to Dazza
            /\b(dazza|daz)\s*!+$/i,                                       // Exclamation at end
            /\b(dazza|daz)$/i,                                            // Dazza as last word
        ];
        
        // Check if any pattern matches
        return mentionPatterns.some(pattern => pattern.test(lowerMsg));
    }
    
    /**
     * Check if this is a test override (dazza with !!)
     * @param {string} message
     * @returns {boolean}
     */
    isTestOverride(message) {
        // Must mention dazza in a way that would trigger hasMention() AND end with !!
        return this.hasMention(message) && /!!$/.test(message);
    }
    
    /**
     * Handle mentions of Dazza
     * @param {Object} data - Message data
     */
    async handleMention(data) {
        const now = Date.now();
        const username = data.username.toLowerCase();
        const isTestMode = this.isTestOverride(data.msg);
        
        // Log test mode activation
        if (isTestMode) {
            this.logger.debug('Test override activated (dazza!!)');
        }
        
        // Track mention for this user
        if (!this.recentMentions.has(username)) {
            this.recentMentions.set(username, { count: 0, firstTime: now });
        }
        
        const userMentions = this.recentMentions.get(username);
        userMentions.count++;
        
        // Clean up old mention tracking (reset after 2 minutes, reduced from 5)
        if (now - userMentions.firstTime > 120000) {
            userMentions.count = 1;
            userMentions.firstTime = now;
        }
        
        // Skip cooldown check if test mode
        if (!isTestMode) {
            // Check cooldown
            const timeSinceLast = now - this.lastMentionTime;
            if (timeSinceLast < this.mentionCooldown) {
                // During cooldown, always respond but with cooldown messages
                const response = this.ollama.getCooldownResponse();
                const timeoutId = setTimeout(() => {
                    this.sendMessage(response);
                    this.pendingMentionTimeouts.delete(timeoutId);
                }, 1000);
                this.pendingMentionTimeouts.add(timeoutId);
                return;
            }
        }
        
        // Check if user is being annoying (skip in test mode)
        // Increased threshold to > 11 to be much less aggressive
        if (!isTestMode && userMentions.count > 11) {
            const annoyanceResponse = this.ollama.getAnnoyanceResponse(userMentions.count);
            this.lastMentionTime = now;
            setTimeout(() => this.sendMessage(annoyanceResponse), 1000 + Math.random() * 2000);
            return;
        }
        
        // Try to get Ollama response
        try {
            this.logger.debug('Attempting Ollama query', { 
                username: data.username,
                isTestMode,
                message: data.msg.substring(0, 50)
            });
            
            // Check if Ollama is available
            const isAvailable = await this.ollama.isAvailable();
            
            if (!isAvailable) {
                // Ollama is down, use fallback
                const fallback = this.ollama.getFallbackResponse();
                const delay = 1500 + Math.random() * 3000;
                const timeoutId = setTimeout(() => {
                    this.sendMessage(fallback);
                    this.pendingMentionTimeouts.delete(timeoutId);
                }, delay);
                this.pendingMentionTimeouts.add(timeoutId);
                return;
            }
            
            // Get recent context (excluding the current message)
            const context = this.messageHistory.slice(0, -1);
            
            // Generate response
            const response = await this.ollama.generateResponse(data.msg, context);
            
            if (response) {
                this.lastMentionTime = now;
                // Set new random cooldown for next time
                this.mentionCooldown = this.getRandomMentionCooldown();
                
                // Handle multi-message responses
                if (Array.isArray(response)) {
                    // Multiple messages - send with delays between them
                    let totalDelay = 2000 + Math.random() * 3000; // Initial delay
                    
                    response.forEach((msg, index) => {
                        const timeoutId = setTimeout(() => {
                            this.sendMessage(msg);
                            this.pendingMentionTimeouts.delete(timeoutId);
                        }, totalDelay);
                        this.pendingMentionTimeouts.add(timeoutId);
                        // Add 2-4 seconds between messages (drunk typing speed)
                        totalDelay += 2000 + Math.random() * 2000;
                    });
                    
                    this.logger.debug(`Dazza sent ${response.length} messages, next possible mention in ${Math.round(this.mentionCooldown / 1000)}s`);
                } else {
                    // Single message
                    const delay = 2000 + Math.random() * 3000;
                    const timeoutId = setTimeout(() => {
                        this.sendMessage(response);
                        this.pendingMentionTimeouts.delete(timeoutId);
                    }, delay);
                    this.pendingMentionTimeouts.add(timeoutId);
                    
                    this.logger.debug(`Dazza responded, next possible mention in ${Math.round(this.mentionCooldown / 1000)}s`);
                }
            } else {
                // Generation failed, use fallback
                const fallback = this.ollama.getFallbackResponse();
                const delay = 1500 + Math.random() * 3000;
                const timeoutId = setTimeout(() => {
                    this.sendMessage(fallback);
                    this.pendingMentionTimeouts.delete(timeoutId);
                }, delay);
                this.pendingMentionTimeouts.add(timeoutId);
            }
            
        } catch (error) {
            this.logger.error('Error handling mention:', error);
            // Use fallback on any error
            const fallback = this.ollama.getFallbackResponse();
            const delay = 1500 + Math.random() * 3000;
            const timeoutId = setTimeout(() => {
                this.sendMessage(fallback);
                this.pendingMentionTimeouts.delete(timeoutId);
            }, delay);
            this.pendingMentionTimeouts.add(timeoutId);
        }
    }
    
    async handlePrivateMessage(data) {
        // Log the PM
        this.logger.info(`PM from ${data.username}: ${data.msg}`);
        
        // Ignore our own PMs
        if (data.username.toLowerCase() === this.username.toLowerCase()) {
            return;
        }
        
        // Store PM in database for audit/history
        try {
            await this.db.run(
                'INSERT INTO private_messages (from_user, to_user, message, timestamp) VALUES (?, ?, ?, ?)',
                [data.username, this.username, data.msg, data.time || Date.now()]
            );
        } catch (err) {
            // Table might not exist yet - we'll create it later
            this.logger.debug('PM logging failed - table may not exist yet');
        }
        
        // Extract and store image URLs from PMs
        try {
            const imageUrls = extractImageUrls(data.msg);
            if (imageUrls.length > 0) {
                this.logger.info(`[PM] Found ${imageUrls.length} image(s) from ${data.username}`);
                
                for (const url of imageUrls) {
                    await this.db.addUserImage(data.username, url);
                    this.logger.debug(`[PM] Added image to gallery: ${url} from ${data.username}`);
                }
                
                // Emit WebSocket event for real-time gallery updates
                if (this.apiServer) {
                    for (const url of imageUrls) {
                        this.apiServer.emit('gallery:image:added', {
                            username: data.username,
                            url: url,
                            timestamp: Date.now(),
                            source: 'pm'
                        });
                    }
                }
            }
        } catch (err) {
            this.logger.error('[PM] Failed to extract/store images:', err);
        }
        
        // Check if message is a command
        const isCommand = data.msg.startsWith(this.config.bot.commandPrefix || '!');
        
        if (isCommand) {
            // Process as command
            const prefix = this.config.bot.commandPrefix || '!';
            const args = data.msg.slice(prefix.length).trim().split(/\s+/);
            const commandName = args.shift().toLowerCase();
            
            // Find command
            const command = this.commands.get(commandName);
            
            if (command && command.pmAccepted) {
                // Create a PM context for the message
                const pmContext = {
                    ...data,
                    isPM: true,
                    originalMessage: data.msg
                };
                
                // Create a wrapped bot object that intercepts sendMessage calls
                // We need to bind methods properly when spreading
                const wrappedBot = Object.create(this);
                wrappedBot.sendMessage = (message) => {
                    if (command.pmResponses) {
                        // Send via PM
                        this.sendPrivateMessage(data.username, message);
                    } else {
                        // Send to chat
                        this.sendMessage(message);
                    }
                };
                // Expose PM sender info
                wrappedBot.pmContext = pmContext;
                
                // Execute command with wrapped bot
                const result = await command.execute(wrappedBot, pmContext, args);
            } else if (command && !command.pmAccepted) {
                // Command exists but doesn't accept PMs
                this.sendPrivateMessage(data.username, 'that command dont work in PMs mate');
            } else {
                // Command not found
                this.sendPrivateMessage(data.username, 'dunno what ya on about mate');
            }
        } else {
            // Not a command, send auto-response
            const responses = [
                'oi mate, got any ciggies?',
                'fuck me dead, private messages now? fancy',
                'yeah nah cant talk right now, shazza\'s on me case',
                'pm\'s are for cops and dogs mate',
                'whisper sweet nothings to me',
                'this better be about durries or piss'
            ];
            
            const response = responses[Math.floor(Math.random() * responses.length)];
            
            // Send PM back with slight delay
            setTimeout(() => {
                this.sendPrivateMessage(data.username, response);
            }, 1000 + Math.random() * 2000);
        }
    }
    
    sendPrivateMessage(toUser, message) {
        if (!this.connection.isConnected()) {
            this.logger.error('Cannot send PM: not connected');
            return;
        }
        
        this.logger.info(`Sending PM to ${toUser}: ${message}`);
        
        this.connection.socket.emit('pm', {
            to: toUser,
            msg: message,
            meta: {}
        });
    }
    
    async shutdown() {
        this.logger.info('Shutting down bot...');
        
        // Mark bot as not ready to prevent processing new messages
        this.ready = false;
        
        // Stop periodic tasks
        if (this.reminderInterval) {
            clearInterval(this.reminderInterval);
            this.reminderInterval = null;
        }
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
        if (this.cooldownCleanupInterval) {
            clearInterval(this.cooldownCleanupInterval);
            this.cooldownCleanupInterval = null;
        }
        
        // Stop batch scheduler
        if (this.batchScheduler) {
            this.logger.info('Stopping batch scheduler...');
            await this.batchScheduler.stop();
        }
        
        // Cancel all pending timeouts
        if (this.pendingGreeting) {
            clearTimeout(this.pendingGreeting);
            this.pendingGreeting = null;
        }
        
        // Clear all pending mention timeouts
        this.pendingMentionTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.pendingMentionTimeouts.clear();
        
        // Clear URL comment timeout
        if (this.lastUrlCommentTime) {
            this.lastUrlCommentTime = null;
        }
        
        // Stop memory cleanup
        this.memoryManager.stopCleanup();
        
        // Stop rate limiter cleanup
        this.rateLimiter.stopAutoCleanup();
        
        // Stop cash monitor
        if (this.cashMonitor) {
            this.cashMonitor.stop();
        }
        
        // Stop image health checker
        if (this.imageHealthChecker) {
            this.imageHealthChecker.stop();
        }
        
        // Shutdown managers in parallel
        const shutdownPromises = [];
        
        if (this.heistManager) {
            shutdownPromises.push(this.heistManager.shutdown());
        }
        
        if (this.videoPayoutManager) {
            shutdownPromises.push(this.videoPayoutManager.shutdown());
        }
        
        // Wait for all managers to shutdown
        await Promise.all(shutdownPromises);
        
        // Stop gallery updater
        if (this.galleryUpdater) {
            this.galleryUpdater.stop();
        }
        
        // Stop API server (this will also close WebSocket connections)
        if (this.apiServer) {
            await this.apiServer.stop();
        }
        
        // Remove all event listeners to prevent memory leaks
        this.removeAllListeners();
        
        // Disconnect from server
        if (this.connection) {
            this.connection.removeAllListeners();
            this.connection.disconnect();
        }
        
        // Close database
        if (this.db) {
            await this.db.close();
        }
        
        this.logger.info('Bot shutdown complete');
    }
}