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
        this.db = new Database(config.database.path, config.bot.username);
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
            this.commands = await loadCommands();
            
            // Initialize global managers
            this.heistManager = new HeistManager(this.db, this);
            await this.heistManager.init();
            
            this.videoPayoutManager = new VideoPayoutManager(this.db, this);
            await this.videoPayoutManager.init();
            
            this.pissingContestManager = new PissingContestManager(this);
            
            this.imageHealthChecker = new ImageHealthChecker(this);
            this.imageHealthChecker.start();
            
            this.cashMonitor = new CashMonitor(this.db, this.logger, 60000);
            
            this.memoryMonitor = new MemoryMonitor(this, {
                checkInterval: this.config.memory?.checkInterval || 30000,
                gcThreshold: this.config.memory?.gcThreshold || 100
            });
            this.memoryMonitor.start();
            
            // Initialize batch scheduler
            if (this.config.batch?.enabled !== false) {
                this.batchScheduler = new BatchScheduler(this.db, this.logger);
                registerChatAnalyzers(this.batchScheduler);
                this.batchScheduler.start();
            }
            
            // Initialize API server
            if (this.config.api?.enabled) {
                this.apiServer = new ApiServer(this.config.api, this);
                await this.apiServer.start();
            }
            
            // Load and join rooms
            await this.loadRooms();
            
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
            const files = await fs.promises.readdir(roomsDir);
            const roomFiles = files.filter(f => f.endsWith('.js'));
            
            for (const file of roomFiles) {
                const roomId = path.basename(file, '.js');
                const roomConfigPath = path.join(roomsDir, file);
                
                try {
                    // Clear require cache to allow hot-reloading
                    delete require.cache[require.resolve(roomConfigPath)];
                    const roomConfig = await import(roomConfigPath);
                    
                    if (roomConfig.default?.enabled || roomConfig.enabled) {
                        const config = roomConfig.default || roomConfig;
                        await this.joinRoom(roomId, config);
                    } else {
                        this.logger.info(`Room ${roomId} is disabled, skipping`);
                    }
                } catch (error) {
                    this.logger.error(`Failed to load room config for ${roomId}:`, error);
                }
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
            
            roomContext.connected = true;
            roomContext.joinedChannel = true;
            
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
            const reminders = await this.db.getAndDeleteDueReminders();
            
            for (const reminder of reminders) {
                const roomContext = this.rooms.get(reminder.room_id);
                if (!roomContext || !roomContext.connected) {
                    // Room not connected, skip this reminder
                    continue;
                }
                
                // Check if user is in the room
                if (roomContext.hasUser(reminder.username)) {
                    const timeAgo = formatDuration(Date.now() - reminder.set_at);
                    this.sendMessage(reminder.room_id, 
                        `Oi -${reminder.username}, ${timeAgo} ago you wanted me to remind ya: ${reminder.message}`
                    );
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