import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CyTubeConnection } from './connection.js';
import { DazzaPersonality } from './character.js';
import { CooldownManager } from '../utils/cooldowns.js';
import { PersistentCooldownManager } from '../utils/persistentCooldowns.js';
import { MemoryManager } from '../utils/memoryManager.js';
import { MemoryMonitor } from '../utils/MemoryMonitor.js';
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
import RoomContext from '../RoomContext.js';
import { applyRoomEventHandlers } from './roomEventHandlers.js';
import { setupHeistHandlers } from './heistEventHandlers.js';
import MediaTracker from '../modules/media/MediaTracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * MultiRoomBot manages multiple room connections and coordinates global state
 */
export class MultiRoomBot extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.logger = createLogger({
            level: config.logging?.level || 'info',
            console: config.logging?.console !== false
        });
        
        // Bot identity
        this.username = config.bot.username;
        this.startTime = Date.now();
        this.admins = new Set(config.admins || []);
        
        // Room management
        this.rooms = new Map(); // roomId -> RoomContext
        this.connections = new Map(); // roomId -> CyTubeConnection
        
        // Global services (shared across all rooms)
        this.personality = new DazzaPersonality();
        this.db = new Database(config.database.path, config.bot.username, {
            logger: this.logger
        });
        this.commands = null;
        this.cooldowns = new CooldownManager(); // Global cooldowns
        this.memoryManager = new MemoryManager();
        this.rateLimiter = new RateLimiter({
            windowMs: 60000, // 1 minute
            maxRequests: 15, // 15 commands per minute per user (global)
            warnThreshold: 0.8
        });
        
        // Global managers (shared state across rooms)
        this.heistManager = null;
        this.videoPayoutManager = null;
        this.pissingContestManager = null;
        this.galleryUpdater = null;
        this.imageHealthChecker = null;
        this.cashMonitor = null;
        this.memoryMonitor = null;
        this.mediaTracker = null;
        
        // Ollama integration
        this.ollama = config.ollama?.enabled ? new OllamaService(config) : null;
        
        // API server
        this.apiServer = null;
        
        // Batch processing
        this.batchScheduler = null;
        
        // Periodic task intervals
        this.reminderInterval = null;
        this.statsInterval = null;
        
        // Ready flag
        this.ready = false;
    }
    
    async init() {
        try {
            // Initialize database
            await this.db.init();
            this.db.setBot(this);
            
            // Load commands
            this.commands = await loadCommands(this.logger);
            
            // Initialize global managers
            this.heistManager = new HeistManager(this.db, this);
            await this.heistManager.init();
            setupHeistHandlers(this);
            
            this.videoPayoutManager = new VideoPayoutManager(this.db, this);
            await this.videoPayoutManager.init();
            
            this.pissingContestManager = new PissingContestManager(this);
            
            this.imageHealthChecker = new ImageHealthChecker(this);
            this.imageHealthChecker.start();
            
            // Initialize MediaTracker (single instance for all rooms)
            this.mediaTracker = new MediaTracker();
            this.mediaTracker.initialize({
                roomId: 'multi-room' // Special identifier for multi-room mode
            });
            
            this.cashMonitor = new CashMonitor(this.db, this.logger, 60000);
            
            this.memoryMonitor = new MemoryMonitor(this, {
                checkInterval: this.config.memory?.checkInterval || 30000,
                gcThreshold: this.config.memory?.gcThreshold || 100
            });
            this.memoryMonitor.start();
            
            // Initialize batch scheduler
            if (this.config.batch?.enabled !== false) {
                this.batchScheduler = new BatchScheduler(this.db, this.logger);
                registerChatAnalyzers(this.batchScheduler, this.db, this.logger);
                this.batchScheduler.start();
            }
            
            // Initialize API server
            if (this.config.api?.enabled) {
                this.logger.info('Initializing API server on port', this.config.api.port);
                this.apiServer = new ApiServer(this, this.config.api.port);
                await this.apiServer.start();
            } else {
                this.logger.info('API server disabled in config');
            }
            
            // Load and join rooms
            await this.loadRooms();
            
            // Start cash monitor
            await this.cashMonitor.start();
            this.logger.info('Cash monitor started');
            
            // Start periodic tasks
            this.startPeriodicTasks();
            
            // Set ready flag
            this.ready = true;
            
            this.logger.info('Multi-room bot initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize bot:', error);
            throw error;
        }
    }
    
    /**
     * Load room configurations and join enabled rooms
     */
    async loadRooms() {
        const roomsDir = path.join(__dirname, '../../rooms');
        
        try {
            // Check if rooms directory exists, create if not
            try {
                await fs.promises.access(roomsDir);
            } catch (error) {
                this.logger.warn('Rooms directory not found, creating it...');
                await fs.promises.mkdir(roomsDir, { recursive: true });
                
                // Create example room file
                const exampleContent = `// Example room configuration
// Copy this file and rename it to match your CyTube room name
// e.g., fatpizza.js, always_sunny.js, etc.

export default {
    // Required: The exact room name on CyTube
    name: 'example_room',
    
    // Optional: Enable/disable the bot for this room
    enabled: false, // Set to true to enable this room
    
    // Optional: Room-specific settings
    settings: {
        // Custom welcome message
        welcomeMessage: 'Welcome to the example room!',
        
        // Command prefix (default: '!')
        commandPrefix: '!',
        
        // Enable/disable specific features
        features: {
            economy: true,
            fishing: true,
            heists: true,
            bongs: true,
            drinks: true,
            gallery: true
        },
        
        // Room-specific cooldowns (milliseconds)
        cooldowns: {
            bong: 10000,    // 10 seconds
            drink: 8000,    // 8 seconds
            fish: 7200000   // 2 hours
        }
    }
};
`;
                await fs.promises.writeFile(path.join(roomsDir, 'example_room.js'), exampleContent);
                this.logger.info('Created example room configuration in rooms/example_room.js');
                this.logger.warn('No active rooms configured! Please create room configurations in the rooms/ directory.');
            }
            
            const files = await fs.promises.readdir(roomsDir);
            const roomFiles = files.filter(f => f.endsWith('.js'));
            
            let activeRooms = 0;
            for (const file of roomFiles) {
                const roomId = path.basename(file, '.js');
                const roomConfigPath = path.join(roomsDir, file);
                
                try {
                    const roomConfig = await import(roomConfigPath);
                    
                    if (roomConfig.default?.enabled || roomConfig.enabled) {
                        const config = roomConfig.default || roomConfig;
                        await this.joinRoom(roomId, config);
                        activeRooms++;
                    } else {
                        this.logger.info(`Room ${roomId} is disabled, skipping`);
                    }
                } catch (error) {
                    this.logger.error(`Failed to load room config for ${roomId}:`, error);
                }
            }
            
            if (activeRooms === 0) {
                this.logger.warn('No active rooms found! Please enable at least one room in the rooms/ directory.');
            }
        } catch (error) {
            this.logger.error('Failed to load rooms directory:', error);
        }
    }
    
    /**
     * Join a specific room
     */
    async joinRoom(roomId, roomConfig) {
        if (this.rooms.has(roomId)) {
            this.logger.warn(`Already connected to room ${roomId}`);
            return;
        }
        
        this.logger.info(`Joining room: ${roomId}`);
        
        // Create room context
        const roomContext = new RoomContext(roomId, this);
        this.rooms.set(roomId, roomContext);
        
        // Merge room config with global config
        const connectionConfig = {
            ...this.config,
            cytube: {
                ...this.config.cytube,
                channel: roomConfig.channel || roomId,
                ...roomConfig
            }
        };
        
        // Create connection for this room
        const connection = new CyTubeConnection(roomId, connectionConfig);
        this.connections.set(roomId, connection);
        
        // Setup room-specific event handlers
        this.setupRoomEventHandlers(roomId, connection, roomContext);
        
        // Record room join in database
        await this.db.run(`
            INSERT OR REPLACE INTO rooms (id, name, first_joined, last_active, is_active)
            VALUES (?, ?, ?, ?, 1)
        `, [roomId, roomId, Date.now(), Date.now()]);
        
        try {
            // Connect to the room
            await connection.connect();
            await connection.joinChannel(roomConfig.channel || roomId);
            
            // Login if credentials are provided
            if (this.config.bot.username && this.config.bot.password) {
                await connection.login(this.config.bot.username, this.config.bot.password);
                this.logger.info(`Logged in to room: ${roomId}`);
                
                // Wait 2 seconds after login before processing messages
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            roomContext.connected = true;
            roomContext.joinedChannel = true;
            roomContext.authenticated = true;
            
            this.logger.info(`Successfully joined room: ${roomId}`);
        } catch (error) {
            this.logger.error(`Failed to join room ${roomId}:`, error);
            
            // Clean up on failure
            this.rooms.delete(roomId);
            this.connections.delete(roomId);
            
            // Update database
            await this.db.run(`
                UPDATE rooms SET is_active = 0 WHERE id = ?
            `, [roomId]);
            
            throw error;
        }
    }
    
    /**
     * Leave a specific room
     */
    async leaveRoom(roomId) {
        const connection = this.connections.get(roomId);
        const roomContext = this.rooms.get(roomId);
        
        if (!connection || !roomContext) {
            this.logger.warn(`Not connected to room ${roomId}`);
            return;
        }
        
        this.logger.info(`Leaving room: ${roomId}`);
        
        // Disconnect from room
        connection.disconnect();
        
        // Clean up room context
        roomContext.cleanup();
        
        // Remove from maps
        this.connections.delete(roomId);
        this.rooms.delete(roomId);
        
        // Update database
        await this.db.run(`
            UPDATE rooms SET is_active = 0, last_active = ? WHERE id = ?
        `, [Date.now(), roomId]);
        
        this.logger.info(`Successfully left room: ${roomId}`);
    }
    
    /**
     * Setup event handlers for a specific room
     */
    setupRoomEventHandlers(roomId, connection, roomContext) {
        // Connection events
        connection.on('authenticated', () => this.handleRoomAuthenticated(roomId));
        connection.on('disconnected', (reason) => this.handleRoomDisconnected(roomId, reason));
        connection.on('reconnecting', () => this.handleRoomReconnecting(roomId));
        connection.on('reconnectFailed', () => this.handleRoomReconnectFailed(roomId));
        
        // User events
        connection.on('userlist', (users) => this.handleUserlist(roomId, users));
        connection.on('addUser', (user) => this.handleUserJoin(roomId, user));
        connection.on('userLeave', (data) => this.handleUserLeave(roomId, data));
        
        // Chat events
        connection.on('chatMsg', (data) => this.handleChatMessage(roomId, data));
        connection.on('pm', (data) => this.handlePrivateMessage(roomId, data));
        
        // Media events
        connection.on('changeMedia', (media) => this.handleMediaChange(roomId, media));
        connection.on('playlist', (playlist) => this.handlePlaylist(roomId, playlist));
        connection.on('setPlaylistLocked', (locked) => this.handlePlaylistLocked(roomId, locked));
        connection.on('setLeader', (username) => this.handleLeaderChange(roomId, username));
        
        // Queue events
        connection.on('queue', (data) => this.handleQueue(roomId, data));
        connection.on('delete', (data) => this.handleDelete(roomId, data));
        connection.on('moveVideo', (data) => this.handleMoveVideo(roomId, data));
        
        // Error events
        connection.on('error', (error) => this.handleRoomError(roomId, error));
        connection.on('errorMsg', (error) => this.handleRoomErrorMessage(roomId, error));
    }
    
    /**
     * Get a room context by ID
     */
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    
    /**
     * Get all active room contexts
     */
    getAllRooms() {
        return Array.from(this.rooms.values());
    }
    
    /**
     * Send a message to a specific room
     */
    sendMessage(roomId, message) {
        const connection = this.connections.get(roomId);
        if (!connection || !connection.connected) {
            this.logger.warn(`Cannot send message to disconnected room: ${roomId}`);
            return;
        }
        
        connection.sendChatMessage(message);
    }
    
    /**
     * Get combined userlist from all rooms (for compatibility)
     */
    getUserlist() {
        const allUsers = new Map();
        for (const [roomId, context] of this.rooms) {
            for (const [username, user] of context.userlist) {
                // If user exists in multiple rooms, keep the first one
                if (!allUsers.has(username)) {
                    allUsers.set(username, { ...user, roomId });
                }
            }
        }
        return allUsers;
    }
    
    /**
     * Get userlist for a specific room
     */
    getUserlistForRoom(roomId) {
        const roomContext = this.rooms.get(roomId);
        if (!roomContext) {
            return new Map();
        }
        return roomContext.userlist;
    }
    
    /**
     * Check if user is an admin
     */
    isAdmin(username) {
        return this.admins.has(username.toLowerCase());
    }
    
    /**
     * Send private message to user
     */
    sendPrivateMessage(toUser, message, roomId = null) {
        // For multi-room bot, we can't send PMs without room context
        // Log a warning if roomId is not provided
        if (!roomId) {
            this.logger.warn(`Cannot send PM to ${toUser} without room context`);
            return;
        }
        
        const roomContext = this.rooms.get(roomId);
        const connection = this.connections.get(roomId);
        if (!roomContext || !connection || !roomContext.connected) {
            this.logger.warn(`Cannot send PM - room ${roomId} not connected`);
            return;
        }
        
        // Send PM using socket emit (same as single-room bot)
        connection.socket.emit('pm', {
            to: toUser,
            msg: message,
            meta: {}
        });
    }
    
    /**
     * Execute a command in a specific room context
     */
    async executeCommand(roomId, commandName, message, args) {
        if (!this.ready) {
            this.logger.warn('Bot not ready, ignoring command');
            return;
        }
        
        const roomContext = this.rooms.get(roomId);
        if (!roomContext) {
            this.logger.error(`No room context for ${roomId}`);
            return;
        }
        
        // Check if command exists
        const command = this.commands.get(commandName);
        if (!command) {
            this.logger.debug(`Command not found: ${commandName} in room ${roomId}`);
            return;
        }
        
        // Check if command is allowed in this room
        if (command.rooms && command.rooms.length > 0 && !command.rooms.includes(roomId)) {
            this.logger.debug(`Command ${commandName} not allowed in room ${roomId}`);
            return;
        }
        
        // Add room context to message
        const messageWithRoom = {
            ...message,
            roomId,
            roomContext
        };
        
        try {
            const result = await this.commands.execute(commandName, this, messageWithRoom, args);
            
            if (result && typeof result === 'string') {
                this.sendMessage(roomId, result);
            }
        } catch (error) {
            this.logger.error(`Error executing command ${commandName} in room ${roomId}:`, error);
            this.sendMessage(roomId, "Oi somethin' went wrong with that command mate");
        }
    }
    
    /**
     * Handle room authenticated event
     */
    handleRoomAuthenticated(roomId) {
        const roomContext = this.rooms.get(roomId);
        if (roomContext) {
            roomContext.authenticated = true;
        }
        this.logger.info(`Authenticated in room: ${roomId}`);
    }
    
    /**
     * Handle room disconnected event
     */
    async handleRoomDisconnected(roomId, reason) {
        const roomContext = this.rooms.get(roomId);
        if (roomContext) {
            roomContext.connected = false;
            roomContext.authenticated = false;
            roomContext.joinedChannel = false;
        }
        
        this.logger.warn(`Disconnected from room ${roomId}: ${reason}`);
        
        // Update database
        await this.db.run(`
            UPDATE rooms SET last_active = ? WHERE id = ?
        `, [Date.now(), roomId]);
        
        // Emit room-specific disconnect event
        this.emit('room:disconnected', { roomId, reason });
    }
    
    /**
     * Handle room error
     */
    handleRoomError(roomId, error) {
        this.logger.error(`Error in room ${roomId}:`, error);
        this.emit('room:error', { roomId, error });
    }
    
    /**
     * Handle room error message
     */
    handleRoomErrorMessage(roomId, error) {
        this.logger.error(`Error message in room ${roomId}:`, error);
        
        // Check if it's a permission error
        if (error.msg && error.msg.includes('Guest login is restricted')) {
            this.logger.error(`Guest login restricted in room ${roomId}`);
        }
    }
    
    /**
     * Handle room reconnecting event
     */
    async handleRoomReconnecting(roomId) {
        this.logger.info(`Attempting to reconnect to room ${roomId}`);
        
        const connection = this.connections.get(roomId);
        const roomContext = this.rooms.get(roomId);
        
        if (!connection || !roomContext) {
            this.logger.error(`No connection/context for room ${roomId} during reconnect`);
            return;
        }
        
        try {
            // Get room config
            const roomConfigPath = path.join(__dirname, `../../rooms/${roomId}.js`);
            const roomConfig = await import(roomConfigPath);
            const config = roomConfig.default || roomConfig;
            
            // Attempt to reconnect
            await connection.connect();
            await connection.joinChannel(config.channel || roomId);
            
            // Login if credentials are provided
            if (this.config.bot.username && this.config.bot.password) {
                await connection.login(this.config.bot.username, this.config.bot.password);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Update room context
            roomContext.connected = true;
            roomContext.joinedChannel = true;
            roomContext.authenticated = true;
            
            // Update database
            await this.db.run(`
                UPDATE rooms SET is_active = 1, last_active = ? WHERE id = ?
            `, [Date.now(), roomId]);
            
            this.logger.info(`Successfully reconnected to room ${roomId}`);
            
            // Emit reconnection event
            this.emit('room:reconnected', { roomId });
        } catch (error) {
            this.logger.error(`Failed to reconnect to room ${roomId}:`, error);
            
            // If it's a rate limit error, the connection will handle retry
            if (!error.message.includes('Rate limit') && !error.message.includes('Too soon')) {
                // Schedule another reconnect attempt
                connection.scheduleReconnect();
            }
        }
    }
    
    /**
     * Handle room reconnect failed event
     */
    handleRoomReconnectFailed(roomId) {
        this.logger.error(`Max reconnection attempts reached for room ${roomId}`);
        
        // Update database to mark room as inactive
        this.db.run(`
            UPDATE rooms SET is_active = 0, last_active = ? WHERE id = ?
        `, [Date.now(), roomId]).catch(err => {
            this.logger.error(`Failed to update room status:`, err);
        });
        
        // Emit failure event
        this.emit('room:reconnectFailed', { roomId });
    }
    
    /**
     * Start periodic tasks
     */
    startPeriodicTasks() {
        // Check for reminders every minute
        this.reminderInterval = setInterval(() => {
            this.checkReminders();
        }, 60000);
        
        // Log stats every 5 minutes
        this.statsInterval = setInterval(() => {
            this.logStats();
        }, 300000);
    }
    
    /**
     * Check and send reminders
     */
    async checkReminders() {
        try {
            const reminders = await this.db.getDueReminders();
            
            for (const reminder of reminders) {
                const roomContext = this.rooms.get(reminder.room_id);
                if (!roomContext || !roomContext.connected) {
                    // Room not connected, skip this reminder
                    continue;
                }
                
                let delivered = false;
                
                // Check if it's a self-reminder
                if (reminder.to_user === '@me') {
                    const timeAgo = formatDuration(Date.now() - reminder.set_at);
                    this.sendMessage(reminder.room_id, 
                        `Oi -${reminder.from_user}, ${timeAgo} ago you wanted me to remind ya: ${reminder.message}`
                    );
                    delivered = true;
                } else {
                    // Check if target user is in the room
                    if (roomContext.hasUser(reminder.to_user)) {
                        const timeAgo = formatDuration(Date.now() - reminder.set_at);
                        this.sendMessage(reminder.room_id, 
                            `-${reminder.to_user} oi listen up, -${reminder.from_user} wanted me to tell ya: ${reminder.message}`
                        );
                        delivered = true;
                    }
                }
                
                // Only mark as delivered if actually sent
                if (delivered) {
                    await this.db.markReminderDelivered(reminder.id);
                }
            }
        } catch (error) {
            this.logger.error('Error checking reminders:', error);
        }
    }
    
    /**
     * Log statistics
     */
    logStats() {
        const uptime = Date.now() - this.startTime;
        const memoryUsage = process.memoryUsage();
        
        this.logger.info('Bot Statistics:', {
            uptime: formatDuration(uptime),
            activeRooms: this.rooms.size,
            memory: {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
            },
            rooms: Array.from(this.rooms.values()).map(room => ({
                id: room.roomId,
                connected: room.connected,
                users: room.userlist.size,
                messages: room.messageCount
            }))
        });
    }
    
    /**
     * Graceful shutdown
     */
    async shutdown() {
        this.logger.info('Shutting down multi-room bot...');
        
        // Clear intervals
        if (this.reminderInterval) clearInterval(this.reminderInterval);
        if (this.statsInterval) clearInterval(this.statsInterval);
        
        // Stop services
        if (this.memoryMonitor) this.memoryMonitor.stop();
        if (this.imageHealthChecker) this.imageHealthChecker.stop();
        if (this.mediaTracker) this.mediaTracker.destroy();
        if (this.cashMonitor) this.cashMonitor.stop();
        if (this.batchScheduler) this.batchScheduler.stop();
        if (this.apiServer) await this.apiServer.stop();
        
        // Leave all rooms
        for (const roomId of this.rooms.keys()) {
            await this.leaveRoom(roomId);
        }
        
        // Close database
        await this.db.close();
        
        this.logger.info('Multi-room bot shutdown complete');
    }
}

// Apply room event handler mixin
applyRoomEventHandlers(MultiRoomBot);

// Re-export as CyTubeBot for backwards compatibility during migration
export { MultiRoomBot as CyTubeBot };