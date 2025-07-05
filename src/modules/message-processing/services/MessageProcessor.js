import { normalizeUsernameForDb } from '../../../utils/userHelper.js';
import { detectUrls, extractDomain } from '../../../utils/urlDetection.js';
import { extractImageUrls } from '../../../utils/imageExtraction.js';
import crypto from 'crypto';

/**
 * Core message processing service
 * Handles message validation, filtering, logging, and routing
 */
class MessageProcessor {
    constructor(services, config, logger) {
        this.services = services;  // Direct services reference
        this.config = config;
        this.logger = logger;
        
        // Message tracking
        this.processedMessages = new Set();
        this.maxProcessedSize = 10000;
        this.staleMessageThreshold = 30000; // 30 seconds
        
        // Message history for context
        this.messageHistory = [];
        this.maxHistorySize = 50;
        
        // Bot message tracking (for echo detection)
        this.recentBotMessages = new Map();
        this.MESSAGE_CACHE_DURATION = 5000; // 5 seconds
        
        // URL commenting
        this.lastUrlCommentTime = 0;
        this.urlCommentCooldown = this.getRandomUrlCooldown();
        
        this.ready = false;
    }
    
    async initialize() {
        // Check that required services are available
        if (!this.services?.get('database')) {
            throw new Error('Database service required for message processing');
        }
        
        this.ready = true;
        this.logger.info('MessageProcessor service initialized');
    }
    
    // Dynamic getters for services
    get database() {
        return this.services?.get('database');
    }
    
    get eventBus() {
        return this.services?.get('eventBus');
    }
    
    get cooldown() {
        return this.services?.get('cooldown');
    }
    
    /**
     * Main message processing entry point
     * @param {Object} messageData - Message data from chat
     * @param {Object} botContext - Bot context for additional services
     */
    async processMessage(messageData, botContext = {}) {
        try {
            this.logger.debug('[MessageProcessor] Starting processMessage', {
                messageData: {
                    username: messageData?.username,
                    msg: messageData?.msg?.substring(0, 50),
                    time: messageData?.time,
                    hasMsg: !!messageData?.msg
                },
                botContext: {
                    hasUsername: !!botContext?.username,
                    hasDb: !!botContext?.db,
                    hasLogger: !!botContext?.logger,
                    dbMethods: botContext?.db ? Object.getOwnPropertyNames(botContext.db).filter(name => typeof botContext.db[name] === 'function') : []
                }
            });
            
            // Generate unique message ID for deduplication
            const messageId = this.generateMessageId(messageData);
            
            // Check for duplicate message
            if (this.isDuplicateMessage(messageId, messageData)) {
                return { processed: false, reason: 'duplicate' };
            }
            
            // Check for stale message
            if (this.isStaleMessage(messageData)) {
                return { processed: false, reason: 'stale' };
            }
            
            // Track as processed
            this.trackProcessedMessage(messageId);
            
            // Check if it's a bot message
            if (this.isBotMessage(messageData, botContext)) {
                return { processed: false, reason: 'bot_message' };
            }
            
            // Check for recent bot message echo
            if (this.isRecentBotMessageEcho(messageData.msg)) {
                return { processed: false, reason: 'bot_echo' };
            }
            
            // Log the message
            this.logger.info(`[${messageData.username}]: ${messageData.msg}`);
            
            // Add to message history
            this.addToMessageHistory(messageData.username, messageData.msg, messageData.time);
            
            // Early return if bot not ready
            if (!this.ready) {
                this.logger.debug('Ignoring message - message processor not ready');
                return { processed: false, reason: 'not_ready' };
            }
            
            // Process the message
            const result = await this.handleValidMessage(messageData, botContext);
            
            return { processed: true, result };
            
        } catch (error) {
            this.logger.error('Error processing message', {
                error: error.message,
                username: messageData.username,
                message: messageData.msg
            });
            throw error;
        }
    }
    
    /**
     * Handle a validated message
     */
    async handleValidMessage(messageData, botContext) {
        this.logger.debug('[MessageProcessor] handleValidMessage called', {
            messageData: {
                username: messageData?.username,
                msg: messageData?.msg?.substring(0, 50)
            },
            botContext: {
                hasDb: !!botContext?.db,
                hasLogger: !!botContext?.logger,
                username: botContext?.username,
                dbType: typeof botContext?.db,
                dbConstructor: botContext?.db?.constructor?.name
            }
        });
        
        this.logger.debug('[MessageProcessor] About to call normalizeUsernameForDb', {
            botContextDb: !!botContext?.db,
            messageUsername: messageData?.username
        });
        
        const canonicalUsername = await normalizeUsernameForDb(botContext, messageData.username);
        
        // Log message to database
        const database = this.services.get('database');
        const logResult = await database.logMessage(canonicalUsername, messageData.msg);
        const messageId = logResult.messageId || logResult;
        
        // Handle image restorations
        this.handleImageRestorations(logResult);
        
        // Emit events for API/WebSocket
        await this.emitMessageEvents(messageData, canonicalUsername);
        
        // Process URLs in message
        await this.processUrls(messageData, messageId, botContext);
        
        // Check for tells to deliver
        if (botContext.checkAndDeliverTells) {
            await botContext.checkAndDeliverTells(messageData.username);
        }
        
        // Heist manager notification now handled by heist module via event system
        
        // Handle mentions
        if (this.hasMention(messageData.msg) && botContext.handleMention) {
            await this.handleMentionDetection(messageData, botContext);
        }
        
        // Handle game responses
        await this.handleGameResponses(messageData, botContext);
        
        // Handle commands
        if (messageData.msg.startsWith('!') && botContext.handleCommand) {
            await botContext.handleCommand(messageData);
        }
        
        return { messageId, canonicalUsername };
    }
    
    /**
     * Generate unique message ID for deduplication
     */
    generateMessageId(messageData) {
        return `${messageData.username}-${messageData.time || Date.now()}-${messageData.msg.substring(0, 20)}`;
    }
    
    /**
     * Check if message is duplicate
     */
    isDuplicateMessage(messageId, messageData) {
        if (this.processedMessages.has(messageId)) {
            this.logger.warn('Ignoring duplicate message', {
                messageId,
                username: messageData.username,
                message: messageData.msg.substring(0, 50)
            });
            return true;
        }
        return false;
    }
    
    /**
     * Check if message is too old
     */
    isStaleMessage(messageData) {
        const messageTime = messageData.time || Date.now();
        const messageAge = Date.now() - messageTime;
        
        if (messageAge > this.staleMessageThreshold) {
            this.logger.debug('Ignoring stale message', {
                username: messageData.username,
                age: Math.round(messageAge / 1000) + 's',
                message: messageData.msg.substring(0, 50)
            });
            return true;
        }
        return false;
    }
    
    /**
     * Track processed message and manage memory
     */
    trackProcessedMessage(messageId) {
        this.processedMessages.add(messageId);
        
        // Trim if too large
        if (this.processedMessages.size > this.maxProcessedSize) {
            const toDelete = this.processedMessages.size - (this.maxProcessedSize / 2);
            const iterator = this.processedMessages.values();
            for (let i = 0; i < toDelete; i++) {
                this.processedMessages.delete(iterator.next().value);
            }
        }
    }
    
    /**
     * Check if message is from the bot
     */
    isBotMessage(messageData, botContext) {
        if (!messageData?.username) {
            this.logger.warn('isBotMessage called with invalid messageData', { messageData });
            return false;
        }
        
        const messageUsername = messageData.username.toLowerCase();
        const botUsername = this.config?.bot?.username?.toLowerCase() || 'dazza';
        const storedUsername = botContext.username?.toLowerCase();
        
        if (messageUsername === botUsername || messageUsername === storedUsername) {
            // Log if bot messages contain HTML
            if (messageData.msg.includes('<strong>') || messageData.msg.includes('</strong>')) {
                this.logger.warn('Bot message contains HTML tags', {
                    message: messageData.msg.substring(0, 100)
                });
            }
            
            this.logger.debug('Ignoring bot\'s own message', {
                messageUsername: messageData.username,
                botUsername: this.config.bot.username,
                storedUsername: botContext.username,
                message: messageData.msg.substring(0, 50)
            });
            
            return true;
        }
        return false;
    }
    
    /**
     * Check if message was recently sent by bot (echo detection)
     */
    isRecentBotMessageEcho(message) {
        const hash = this.hashMessage(message);
        const timestamp = this.recentBotMessages.get(hash);
        
        if (!timestamp) {
            return false;
        }
        
        const age = Date.now() - timestamp;
        const isRecent = age <= this.MESSAGE_CACHE_DURATION;
        
        if (isRecent) {
            this.logger.debug('Message identified as recent bot message echo', {
                hash,
                ageMs: age,
                messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
            });
        }
        
        return isRecent;
    }
    
    /**
     * Hash message for echo detection
     */
    hashMessage(message) {
        return crypto.createHash('sha256').update(message).digest('hex').substring(0, 16);
    }
    
    /**
     * Track bot's own messages for echo detection
     */
    trackBotMessage(message) {
        const hash = this.hashMessage(message);
        this.recentBotMessages.set(hash, Date.now());
        
        // Cleanup old entries
        const cutoff = Date.now() - this.MESSAGE_CACHE_DURATION;
        for (const [msgHash, timestamp] of this.recentBotMessages) {
            if (timestamp < cutoff) {
                this.recentBotMessages.delete(msgHash);
            }
        }
    }
    
    /**
     * Add message to history buffer
     */
    addToMessageHistory(username, message, timestamp = Date.now()) {
        this.messageHistory.push({ username, message, timestamp });
        
        if (this.messageHistory.length > this.maxHistorySize) {
            this.messageHistory.shift();
        }
    }
    
    /**
     * Get message history for context
     */
    getMessageHistory() {
        return [...this.messageHistory];
    }
    
    /**
     * Handle image restoration notifications
     */
    handleImageRestorations(logResult) {
        if (logResult.restoredImages && logResult.restoredImages.length > 0) {
            for (const restored of logResult.restoredImages) {
                this.logger.info(`Restored previously dead image: ${restored.url}`);
            }
        }
        
        if (logResult.failedRestorations && logResult.failedRestorations.length > 0) {
            for (const failed of logResult.failedRestorations) {
                this.logger.warn(`Failed to restore image (gallery full): ${failed.url}`);
            }
        }
    }
    
    /**
     * Emit events for API/WebSocket
     */
    async emitMessageEvents(messageData, canonicalUsername) {
        if (!this.eventBus) return;
        
        // Strip HTML from message for clean display
        const cleanMessage = messageData.msg.replace(/<[^>]*>/g, '');
        
        // Emit chat message event
        this.eventBus.emit('chat:message', {
            username: messageData.username,
            message: cleanMessage,
            timestamp: Date.now(),
            isPM: messageData.meta && messageData.meta.pm
        });
        
        // Emit user stats update
        this.eventBus.emit('stats:user:update', {
            username: canonicalUsername,
            event: 'message'
        });
        
        // If images were added, emit gallery events
        const imageUrls = extractImageUrls(messageData.msg);
        for (const url of imageUrls) {
            this.eventBus.emit('gallery:image:added', {
                username: canonicalUsername,
                url,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Process URLs in message
     */
    async processUrls(messageData, messageId, botContext) {
        const urlDetection = detectUrls(messageData.msg);
        if (!urlDetection.hasUrls) return;
        
        // Process first URL only (to avoid spam)
        const urlData = urlDetection.urls[0];
        urlData.domain = extractDomain(urlData.url);
        
        // Log URL to database
        await this.database.logUrl(messageData.username, urlData, messageId);
        
        this.logger.debug('URL detected', {
            username: messageData.username,
            url: urlData.url,
            type: urlData.type,
            domain: urlData.domain
        });
        
        // Handle URL commenting
        await this.handleUrlCommenting(urlData, messageData.username, botContext);
    }
    
    /**
     * Handle URL commenting with cooldowns
     */
    async handleUrlCommenting(urlData, username, botContext) {
        const now = Date.now();
        const timeSinceLastComment = now - this.lastUrlCommentTime;
        
        // Only respond to about 50% of links (Dazza's drunk and misses half)
        const shouldRespond = Math.random() < 0.5;
        
        if (shouldRespond && timeSinceLastComment > this.urlCommentCooldown) {
            // Fetch title and make contextual comment
            const { fetchUrlTitleAndComment } = await import('../../../utils/urlTitleFetcher.js');
            const comment = await fetchUrlTitleAndComment(urlData, username);
            
            if (comment && botContext.sendMessage) {
                this.lastUrlCommentTime = now;
                this.urlCommentCooldown = this.getRandomUrlCooldown();
                
                // Add drunk typing delay
                const drunkDelay = 1000 + Math.random() * 4000;
                setTimeout(() => {
                    botContext.sendMessage(comment);
                }, drunkDelay);
                
                this.logger.debug(`Commented on URL, next possible in ${Math.round(this.urlCommentCooldown / 60000)} minutes`);
            }
        } else if (!shouldRespond) {
            this.logger.debug('Skipped URL (drunk roll failed)');
        } else {
            this.logger.debug(`Skipped URL (cooldown: ${Math.round((this.urlCommentCooldown - timeSinceLastComment) / 1000)}s remaining)`);
        }
    }
    
    /**
     * Get random URL comment cooldown (5-15 minutes)
     */
    getRandomUrlCooldown() {
        return (5 + Math.random() * 10) * 60 * 1000;
    }
    
    /**
     * Check for mentions of Dazza
     */
    hasMention(message) {
        const lowerMsg = message.toLowerCase();
        
        // Patterns that indicate talking ABOUT Dazza, not TO him
        const aboutDazzaPatterns = [
            /\b(dazza|daz)'s\b/i,
            /\b(dazza|daz)\s+(took|nicked|already|scrapes|cut|share|profit)/i,
            /\b(after|minus|with)\s+(dazza|daz)/i,
        ];
        
        // If it's talking ABOUT Dazza, not a mention
        if (aboutDazzaPatterns.some(pattern => pattern.test(lowerMsg))) {
            return false;
        }
        
        // Patterns for actual mentions/addresses to Dazza
        const mentionPatterns = [
            /^(hey |hi |yo |oi |g'day |sup )?(dazza|daz)([,!?]|\s|$)/i,
            /[,.!?;]\s*(hey |hi |yo |oi )?(dazza|daz)([,!?]|\s|$)/i,
            /\b(dazza|daz)[,!?]?\s+(you|ya|mate|cunt|there)/i,
            /@(dazza|daz)\b/i,
            /\b(dazza|daz)\s*\?/i,
            /\b(dazza|daz)\s*!+$/i,
            /\b(dazza|daz)$/i,
        ];
        
        return mentionPatterns.some(pattern => pattern.test(lowerMsg));
    }
    
    /**
     * Handle mention detection and routing
     */
    async handleMentionDetection(messageData, botContext) {
        const senderLower = messageData.username.toLowerCase();
        if (senderLower === this.config.bot.username.toLowerCase() ||
            senderLower === botContext.username?.toLowerCase() ||
            senderLower === '[server]') {
            
            this.logger.debug('Ignoring mention from bot/server', {
                username: messageData.username,
                message: messageData.msg.substring(0, 50)
            });
            return;
        }
        
        const roomId = messageData.roomId || messageData.room || botContext.connection?.roomId || 'fatpizza';
        
        this.logger.debug('Mention detected', {
            username: messageData.username,
            message: messageData.msg,
            timestamp: new Date().toISOString(),
            room: roomId
        });
        
        await botContext.handleMention(messageData, roomId);
    }
    
    /**
     * Handle game responses (pissing contest, coin flip)
     */
    async handleGameResponses(messageData, botContext) {
        const lowerMsg = messageData.msg.toLowerCase().trim();
        
        // Handle pissing contest responses
        if (botContext.pissingContestManager) {
            const roomId = botContext.connection?.roomId || 'fatpizza';
            const challenge = botContext.pissingContestManager.findChallengeForUser(messageData.username, roomId);
            
            if (challenge) {
                const acceptPhrases = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay',
                    'bring it on', 'you\'re on', 'let\'s go', 'fuck yeah',
                    'whip it out', 'dicks out', 'let\'s piss',
                    'prepare to lose', 'easy money', 'bet'];
                const declinePhrases = ['no', 'nah', 'nope', 'pass',
                    'fuck off', 'piss off', 'not now',
                    'maybe later', 'busy', 'can\'t'];
                
                if (acceptPhrases.includes(lowerMsg)) {
                    const result = await botContext.pissingContestManager.acceptChallenge(messageData.username, roomId);
                    if (!result.success && botContext.sendMessage) {
                        botContext.sendMessage(result.message);
                    }
                    return;
                } else if (declinePhrases.includes(lowerMsg)) {
                    const result = await botContext.pissingContestManager.declineChallenge(messageData.username, roomId);
                    if (botContext.sendMessage) {
                        botContext.sendMessage(result.message);
                    }
                    return;
                }
            }
        }
        
        // Handle coin flip responses
        if ((lowerMsg === 'heads' || lowerMsg === 'tails') && this.database) {
            await this.handleCoinFlipResponse(messageData, lowerMsg, botContext);
        }
    }
    
    /**
     * Handle coin flip responses
     */
    async handleCoinFlipResponse(messageData, response, botContext) {
        this.logger.info('Checking for coin flip response', {
            username: messageData.username,
            message: response,
            hasDb: !!this.database
        });
        
        const pendingChallenge = await this.database.get(
            'SELECT * FROM coin_flip_challenges WHERE LOWER(challenged) = LOWER(?) AND status = ?',
            [messageData.username, 'pending']
        );
        
        if (pendingChallenge && botContext.commands) {
            this.logger.info('Found pending challenge, processing response');
            
            const coinFlipCommand = botContext.commands.commands.get('coin_flip') ||
                                  botContext.commands.commands.get('coinflip') ||
                                  botContext.commands.commands.get('cf');
            
            if (coinFlipCommand && coinFlipCommand.handleChallengeResponse) {
                await coinFlipCommand.handleChallengeResponse(
                    botContext,
                    { username: messageData.username, isPM: false },
                    response
                );
            }
        }
    }
}

export default MessageProcessor;