import { normalizeUsernameForDb } from '../../../utils/usernameNormalizer.js';

/**
 * UserManagementService
 * Handles all user-related operations extracted from bot.js:
 * - Userlist management and tracking
 * - User join/leave events with database logging
 * - AFK status management
 * - User utility functions
 */
class UserManagementService {
    constructor(services, config, logger, eventBus) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.eventBus = eventBus;
        
        // Database service
        this.db = services.get('database');
        
        // User tracking
        this.userlist = new Map();
        this.userDepartureTimes = new Map(); // Track when users left to implement cooldown
        
        // Ready state
        this.ready = false;
        
        // Configuration from module config
        this.userDepartureTimeoutMs = config.userDepartureTimeoutMs || 3600000; // 1 hour default
        this.enableGreetingIntegration = config.enableGreetingIntegration !== false;
        this.enableVideoPayoutIntegration = config.enableVideoPayoutIntegration !== false;
        this.enableTellSystemIntegration = config.enableTellSystemIntegration !== false;
    }

    /**
     * Initialize the service
     */
    async initialize() {
        if (!this.db) {
            throw new Error('Database service is required for UserManagementService');
        }
        
        this.logger.info('UserManagementService initialized');
        this.ready = true;
    }

    /**
     * Handle userlist data from server
     * Extracted from bot.js lines 864-900
     * @param {Array} users - Array of user objects from server
     */
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
        
        // Emit event for API to broadcast user count
        this.eventBus.emit('userlist:loaded');
        
        // Notify video payout manager of userlist update (if enabled)
        if (this.enableVideoPayoutIntegration) {
            this.eventBus.emit('video-payout:userlist-update');
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

    /**
     * Handle user join events
     * Extracted from bot.js lines 902-972
     * @param {Object} user - User object
     * @param {Object} roomContext - Room context with sendMessage and sendPM functions
     */
    async handleUserJoin(user, roomContext = null) {
        // Debug log to track duplicate calls
        this.logger.debug(`handleUserJoin called for ${user.name} at ${new Date().toISOString()}`);
        
        this.userlist.set(user.name.toLowerCase(), user);
        
        // Log join event to database
        try {
            await this.db.logUserEvent(user.name, 'join');
        } catch (err) {
            this.logger.error('Failed to log join event', { error: err.message, user: user.name });
        }
        
        this.logger.userEvent(user.name, 'join');
        
        // Emit user join event for API WebSocket
        this.eventBus.emit('user:join', user.name);
        this.eventBus.emit('stats:channel:activity', {
            activeUsers: this.userlist.size,
            event: 'user_joined',
            username: user.name
        });
        
        // Emit user join event for greeting system (if enabled)
        if (this.enableGreetingIntegration && roomContext) {
            this.eventBus.emit('greeting:user-joined', {
                username: user.name,
                room: roomContext
            });
        }
        
        // Track for video payout (if enabled)
        if (this.enableVideoPayoutIntegration) {
            this.eventBus.emit('video-payout:user-join', { username: user.name });
        }

        // Emit user join event for tell-system module to handle (if enabled)
        if (this.enableTellSystemIntegration && roomContext) {
            this.eventBus.emit('user:join', {
                username: user.name,
                room: roomContext
            });
        }
    }

    /**
     * Handle user leave events
     * Extracted from bot.js lines 974-1011
     * @param {Object} user - User object
     */
    async handleUserLeave(user) {
        this.userlist.delete(user.name.toLowerCase());
        
        // Track departure time for greeting cooldown
        this.userDepartureTimes.set(user.name.toLowerCase(), Date.now());
        
        // Clean up old departure times (older than configured timeout)
        const cutoffTime = Date.now() - this.userDepartureTimeoutMs;
        for (const [username, time] of this.userDepartureTimes) {
            if (time < cutoffTime) {
                this.userDepartureTimes.delete(username);
            }
        }
        
        // Log leave event to database
        try {
            await this.db.logUserEvent(user.name, 'leave');
        } catch (err) {
            this.logger.error('Failed to log leave event', { error: err.message, user: user.name });
        }
        
        this.logger.userEvent(user.name, 'leave');
        
        // Emit user leave event for API WebSocket
        this.eventBus.emit('user:leave', user.name);
        this.eventBus.emit('stats:channel:activity', {
            activeUsers: this.userlist.size,
            event: 'user_left',
            username: user.name
        });
        
        // Track for video payout (if enabled)
        if (this.enableVideoPayoutIntegration) {
            this.eventBus.emit('video-payout:user-leave', { username: user.name });
        }
    }

    /**
     * Handle AFK status updates
     * Extracted from bot.js lines 1128-1161
     * @param {Object} data - AFK update data containing name and afk boolean
     * @param {Object} roomContext - Room context for tell system integration
     */
    handleAFKUpdate(data, roomContext = null) {
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
            
            // Emit event for API to broadcast updated user count
            if (wasAFK !== data.afk) {
                this.eventBus.emit('userlist:loaded'); // Reuse the same event to trigger count update
            }
            
            // If user just came back from AFK, emit event for tell-system module (if enabled)
            if (this.enableTellSystemIntegration && wasAFK && !data.afk && roomContext) {
                this.logger.debug(`${data.name} returned from AFK, emitting user join event`);
                setTimeout(() => {
                    this.eventBus.emit('user:join', {
                        username: data.name,
                        room: roomContext
                    });
                }, 1500); // Small delay to make it feel natural
            }
        }
    }

    /**
     * Get the current userlist
     * Extracted from bot.js lines 1124-1126
     * @returns {Map} Current userlist map
     */
    getUserlist() {
        return this.userlist;
    }

    /**
     * Get userlist for a specific room (compatibility method for multi-room support)
     * Single room bot always returns the main userlist
     * Extracted from bot.js lines 1262-1264
     * @param {string} roomId - Room ID (ignored in single-room implementation)
     * @returns {Map} Current userlist map
     */
    getUserlistForRoom(roomId) {
        return this.userlist;
    }

    /**
     * Check if a user is AFK
     * Extracted from bot.js lines 1344-1350
     * @param {string} username - Username to check
     * @returns {boolean} True if user is AFK
     */
    isUserAFK(username) {
        const user = this.userlist.get(username.toLowerCase());
        if (!user) return false;
        
        // Check both direct afk property and meta.afk
        return user.afk === true || (user.meta && user.meta.afk === true);
    }

    /**
     * Get list of AFK users
     * Extracted from bot.js lines 1352-1361
     * @returns {Array<string>} Array of AFK usernames
     */
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

    /**
     * Check if user recently departed (for greeting cooldown)
     * @param {string} username - Username to check
     * @returns {boolean} True if user recently left
     */
    hasRecentlyDeparted(username) {
        const userLower = username.toLowerCase();
        const departureTime = this.userDepartureTimes.get(userLower);
        if (!departureTime) return false;
        
        const timeSinceDeparture = Date.now() - departureTime;
        return timeSinceDeparture < 120000; // 2 minutes
    }

    /**
     * Remove user from departure tracking (called when greeting cooldown expires)
     * @param {string} username - Username to remove
     */
    removeDepartureTracking(username) {
        this.userDepartureTimes.delete(username.toLowerCase());
    }

    /**
     * Get current user count
     * @returns {number} Number of users in channel
     */
    getUserCount() {
        return this.userlist.size;
    }

    /**
     * Get AFK user count
     * @returns {number} Number of AFK users
     */
    getAFKUserCount() {
        return this.getAFKUsers().length;
    }

    /**
     * Get user by name
     * @param {string} username - Username to get
     * @returns {Object|null} User object or null if not found
     */
    getUser(username) {
        return this.userlist.get(username.toLowerCase()) || null;
    }

    /**
     * Check if user is online
     * @param {string} username - Username to check
     * @returns {boolean} True if user is online
     */
    isUserOnline(username) {
        return this.userlist.has(username.toLowerCase());
    }

    /**
     * Get service status
     * @returns {Object} Service status information
     */
    getStatus() {
        return {
            ready: this.ready,
            userCount: this.userlist.size,
            afkCount: this.getAFKUserCount(),
            departureTracking: this.userDepartureTimes.size,
            integrations: {
                greeting: this.enableGreetingIntegration,
                videoPayout: this.enableVideoPayoutIntegration,
                tellSystem: this.enableTellSystemIntegration
            }
        };
    }
}

export default UserManagementService;