/**
 * Connection Handler Service
 * Manages CyTube connection events, disconnection/reconnection logic,
 * and chat event routing. Extracted from bot.js for modular architecture.
 */
class ConnectionHandler {
    constructor(services, config, logger, eventBus) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.eventBus = eventBus;
        
        // Tracking structures
        this.pendingMentionTimeouts = new Set();
        this.pendingTellChecks = new Set();
        this.messageHistory = [];
        this.processedMessages = new Set();
        this.recentMentions = new Set();
        
        // Timer tracking for cleanup
        this.timeouts = new Map(); // Map of timeout IDs to descriptions
        this.intervals = new Map(); // Map of interval IDs to descriptions
        this.isShuttingDown = false;
        
        // Connection state
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
        this.reconnectDelay = config.reconnectDelay || 30000;
        
        // Connection storm prevention
        this.maxConcurrentAttempts = config.maxConcurrentAttempts || 5;
        this.currentAttempts = 0;
        this.connectionHistory = []; // Track connection attempts
        this.maxConnectionsPerHour = config.maxConnectionsPerHour || 60;
        this.connectionBackoff = {
            base: 30000, // 30 seconds
            max: 600000, // 10 minutes
            multiplier: 2,
            current: 30000
        };
        this.emergencyMode = false;
        
        this.ready = false;
        
        // Bind cleanup for emergency shutdown
        this.boundCleanup = this.cleanup.bind(this);
        process.on('SIGINT', this.boundCleanup);
        process.on('SIGTERM', this.boundCleanup);
    }
    
    async initialize() {
        // Get required services
        this.database = this.services.get('database');
        
        // Wait for connection service to be available (it may be registered later during startup)
        let retries = 0;
        const maxRetries = 10;
        while (!this.connection && retries < maxRetries) {
            this.connection = this.services.get('connection');
            if (!this.connection) {
                this.logger.info(`Waiting for connection service... (attempt ${retries + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
                retries++;
            }
        }
        
        // Optional services - will be looked up when needed
        // this.messageProcessor = this.services.get('messageProcessor');
        
        // Debug logging to see what services are available
        this.logger.info('Checking services availability', {
            database: !!this.database,
            eventBus: !!this.eventBus,
            connection: !!this.connection,
            messageProcessor: !!this.services.get('messageProcessor'),
            allServices: Array.from(this.services.keys ? this.services.keys() : [])
        });
        
        if (!this.database || !this.eventBus || !this.connection) {
            throw new Error('Required services not available for ConnectionHandler');
        }
        
        // Setup event handlers
        this.setupEventHandlers();
        
        this.ready = true;
        this.logger.info('ConnectionHandler service initialized');
    }
    
    /**
     * Setup all connection and chat event handlers
     * Extracted from bot.js lines 275-316
     */
    setupEventHandlers() {
        // Connection events
        this.connection.on('disconnected', () => this.handleDisconnect());
        this.connection.on('reconnecting', () => this.handleReconnect());
        this.connection.on('reconnectFailed', () => {
            this.logger.error('Max reconnection attempts reached - giving up');
            this.eventBus.emit('connection:reconnectFailed');
        });
        
        this.connection.on('stateChange', (change) => {
            this.logger.info(`Connection state changed from ${change.from} to ${change.to}`);
            
            // Update internal state
            this.isConnected = (change.to === 'connected');
            
            // Emit connection state changes for other modules and API WebSocket
            this.eventBus.emit('connection:stateChange', {
                from: change.from,
                to: change.to,
                timestamp: Date.now()
            });
            
            if (change.to === 'connected') {
                this.eventBus.emit('connection:connected');
                this.reconnectAttempts = 0; // Reset on successful connection
            } else if (change.to === 'disconnected') {
                this.eventBus.emit('connection:disconnected');
            }
        });
        
        // Event handlers will be set up via event bus subscriptions in the module
        // No direct socket event listeners needed in modular architecture
        
        // All events handled via event bus subscriptions
        // Media events are handled by core-connection module and published to event bus
        
        this.logger.debug('Connection event handlers setup complete');
    }
    
    /**
     * Handle chat messages - route to message processor or emit events
     */
    async handleChatMessage(data) {
        try {
            // The data from core-connection is already in the correct format
            // Just forward it for other modules - MessageProcessor should subscribe to socket events directly
            // Data format: { room, username, message, time, meta }
            this.logger.debug('Forwarding chat message', {
                username: data.username,
                message: data.message?.substring(0, 50),
                room: data.room
            });
        } catch (error) {
            this.logger.error('Error handling chat message', {
                error: error.message,
                username: data.username,
                message: data.msg?.substring(0, 50)
            });
        }
    }
    
    /**
     * Handle private messages
     */
    async handlePrivateMessage(data) {
        try {
            this.logger.info(`PM from ${data.username}: ${data.msg}`);
            
            this.eventBus.emit('chat:pm', {
                username: data.username,
                message: data.msg,
                timestamp: Date.now(),
                to: data.to
            });
        } catch (error) {
            this.logger.error('Error handling private message', {
                error: error.message,
                username: data.username
            });
        }
    }
    
    /**
     * Handle user list updates
     */
    async handleUserlist(users) {
        try {
            this.logger.debug(`Received userlist with ${users.length} users`);
            
            this.eventBus.emit('user:list', {
                users: users,
                count: users.length,
                timestamp: Date.now()
            });
        } catch (error) {
            this.logger.error('Error handling userlist', { error: error.message });
        }
    }
    
    /**
     * Handle user join events
     */
    async handleUserJoin(user) {
        try {
            this.logger.debug(`User joined: ${user.name}`);
            
            this.eventBus.emit('user:join', {
                username: user.name,
                rank: user.rank,
                timestamp: Date.now(),
                user: user
            });
        } catch (error) {
            this.logger.error('Error handling user join', {
                error: error.message,
                username: user?.name
            });
        }
    }
    
    /**
     * Handle user leave events
     */
    async handleUserLeave(user) {
        try {
            this.logger.debug(`User left: ${user.name}`);
            
            this.eventBus.emit('user:leave', {
                username: user.name,
                timestamp: Date.now(),
                user: user
            });
        } catch (error) {
            this.logger.error('Error handling user leave', {
                error: error.message,
                username: user?.name
            });
        }
    }
    
    /**
     * Handle AFK status updates
     */
    async handleAFKUpdate(data) {
        try {
            this.logger.debug(`AFK update: ${data.name} - ${data.afk ? 'AFK' : 'back'}`);
            
            this.eventBus.emit('user:afk', {
                username: data.name,
                afk: data.afk,
                timestamp: Date.now()
            });
        } catch (error) {
            this.logger.error('Error handling AFK update', {
                error: error.message,
                username: data?.name
            });
        }
    }
    
    /**
     * Handle rank updates
     */
    async handleRankUpdate(rank) {
        try {
            this.logger.debug(`Rank updated to: ${rank}`);
            
            this.eventBus.emit('channel:rank', {
                rank: rank,
                timestamp: Date.now()
            });
        } catch (error) {
            this.logger.error('Error handling rank update', { error: error.message });
        }
    }
    
    /**
     * Handle media change events
     */
    async handleMediaChange(data) {
        try {
            this.logger.debug(`Media changed: ${data.title || 'Unknown'}`);
            
            this.eventBus.emit('media:change', {
                title: data.title,
                url: data.url,
                type: data.type,
                duration: data.seconds,
                timestamp: Date.now(),
                data: data
            });
        } catch (error) {
            this.logger.error('Error handling media change', { error: error.message });
        }
    }
    
    /**
     * Handle media update events
     */
    async handleMediaUpdate(data) {
        try {
            this.eventBus.emit('media:update', {
                currentTime: data.currentTime,
                paused: data.paused,
                timestamp: Date.now(),
                data: data
            });
        } catch (error) {
            this.logger.error('Error handling media update', { error: error.message });
        }
    }
    
    /**
     * Handle set current events
     */
    async handleSetCurrent(data) {
        try {
            this.eventBus.emit('media:setCurrent', {
                uid: data.uid,
                timestamp: Date.now(),
                data: data
            });
        } catch (error) {
            this.logger.error('Error handling setCurrent', { error: error.message });
        }
    }
    
    /**
     * Handle disconnection - cleanup and state management
     * Extracted from bot.js lines 1140-1175
     */
    async handleDisconnect() {
        try {
            this.logger.warn('Connection disconnected - performing cleanup');
            this.isConnected = false;
            
            // Emit cleanup event for other modules to handle their cleanup
            this.eventBus.emit('connection:cleanup', {
                reason: 'disconnect',
                timestamp: Date.now()
            });
            
            // Clean up database state (rollback transactions, etc.)
            if (this.database && this.database.cleanup) {
                this.logger.debug('Cleaning up database state');
                await this.database.cleanup();
            }
            
            // Clear all pending mention timeouts
            this.pendingMentionTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            this.pendingMentionTimeouts.clear();
            
            // Clear all tracked timeouts and intervals
            this.timeouts.forEach((description, timeoutId) => {
                clearTimeout(timeoutId);
                this.logger.debug(`Cleared timeout: ${description}`);
            });
            this.timeouts.clear();
            
            this.intervals.forEach((description, intervalId) => {
                clearInterval(intervalId);
                this.logger.debug(`Cleared interval: ${description}`);
            });
            this.intervals.clear();
            
            // Clear pending tell checks
            this.pendingTellChecks.clear();
            
            // Clear message history and processed messages to avoid stale data
            this.messageHistory = [];
            this.processedMessages.clear();
            this.recentMentions.clear();
            
            this.logger.debug('Completed disconnect cleanup');
            
        } catch (error) {
            this.logger.error('Error during disconnect handling', { error: error.message });
        }
    }
    
    /**
     * Handle reconnection logic with throttling
     * Extracted from bot.js lines 1177-1241
     */
    async handleReconnect() {
        try {
            this.logger.info('Attempting reconnection');
            this.reconnectAttempts++;
            
            // Check reconnection throttling (30 second minimum delay)
            const canConnect = await this.database.canConnect(this.reconnectDelay);
            if (!canConnect) {
                const lastConnect = await this.database.getLastConnectionTime('connect');
                const timeSince = Date.now() - lastConnect;
                const waitTime = Math.ceil((this.reconnectDelay - timeSince) / 1000);
                
                this.logger.info(`Connection throttled - waiting ${waitTime}s before reconnecting (good neighbor policy)`);
                
                this.eventBus.emit('connection:throttled', {
                    waitTime: waitTime,
                    attempts: this.reconnectAttempts,
                    timestamp: Date.now()
                });
                
                // Schedule reconnect after the required delay - track timeout
                const reconnectTimeout = setTimeout(() => {
                    this.timeouts.delete(reconnectTimeout);
                    if (!this.isShuttingDown) {
                        this.handleReconnect();
                    }
                }, waitTime * 1000);
                this.timeouts.set(reconnectTimeout, `reconnect-delay-${waitTime}s`);
                return;
            }
            
            // Check if we've exceeded max attempts
            if (this.reconnectAttempts > this.maxReconnectAttempts) {
                this.logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) exceeded`);
                this.eventBus.emit('connection:maxAttemptsExceeded', {
                    attempts: this.reconnectAttempts,
                    timestamp: Date.now()
                });
                return;
            }
            
            // Clear all pending timeouts and stale data
            this.pendingMentionTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            this.pendingMentionTimeouts.clear();
            
            // Clear all tracked timeouts and intervals
            this.timeouts.forEach((description, timeoutId) => {
                clearTimeout(timeoutId);
                this.logger.debug(`Cleared timeout during reconnect: ${description}`);
            });
            this.timeouts.clear();
            
            this.intervals.forEach((description, intervalId) => {
                clearInterval(intervalId);
                this.logger.debug(`Cleared interval during reconnect: ${description}`);
            });
            this.intervals.clear();
            
            this.pendingTellChecks.clear();
            this.messageHistory = [];
            this.processedMessages.clear();
            this.recentMentions.clear();
            
            // Log connection attempt
            await this.database.logConnectionEvent('connect', { 
                type: 'reconnect',
                attempt: this.reconnectAttempts
            });
            
            // Perform reconnection sequence
            await this.connection.connect();
            await this.connection.joinChannel(this.config.cytube.channel);
            
            if (this.config.bot.username && this.config.bot.password) {
                await this.connection.login(this.config.bot.username, this.config.bot.password);
            }
            
            this.logger.info('Reconnection successful');
            this.isConnected = true;
            
            // Emit reconnection success
            this.eventBus.emit('connection:reconnected', {
                attempts: this.reconnectAttempts,
                timestamp: Date.now()
            });
            
        } catch (error) {
            this.logger.error('Reconnection failed', { 
                error: error.message,
                attempt: this.reconnectAttempts
            });
            
            // Log failed attempt
            await this.database.logConnectionEvent('connect_failed', { 
                error: error.message,
                attempt: this.reconnectAttempts
            });
            
            // If it's a rate limit error, the connection handler already increased the delay
            // Otherwise, schedule another reconnect
            if (!error.message.includes('Rate limit') && !error.message.includes('Too soon')) {
                this.connection.scheduleReconnect();
            }
        }
    }
    
    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            pendingTimeouts: this.pendingMentionTimeouts.size,
            messageHistorySize: this.messageHistory.length,
            processedMessagesSize: this.processedMessages.size
        };
    }
    
    /**
     * Manual connection trigger
     */
    async connect() {
        if (this.isConnected) {
            this.logger.warn('Already connected');
            return;
        }
        
        await this.handleReconnect();
    }
    
    /**
     * Manual disconnect trigger
     */
    async disconnect() {
        if (!this.isConnected) {
            this.logger.warn('Already disconnected');
            return;
        }
        
        await this.connection.disconnect();
    }
    
    /**
     * Add timeout to tracking set
     */
    trackTimeout(timeoutId, description = 'mention-timeout') {
        this.pendingMentionTimeouts.add(timeoutId);
        this.timeouts.set(timeoutId, description);
    }
    
    /**
     * Remove timeout from tracking set
     */
    untrackTimeout(timeoutId) {
        this.pendingMentionTimeouts.delete(timeoutId);
        this.timeouts.delete(timeoutId);
    }
    
    /**
     * Create and track a timeout
     */
    createTimeout(callback, delay, description = 'generic-timeout') {
        const timeoutId = setTimeout(() => {
            this.timeouts.delete(timeoutId);
            if (!this.isShuttingDown) {
                callback();
            }
        }, delay);
        this.timeouts.set(timeoutId, description);
        return timeoutId;
    }
    
    /**
     * Create and track an interval
     */
    createInterval(callback, interval, description = 'generic-interval') {
        const intervalId = setInterval(() => {
            if (!this.isShuttingDown) {
                callback();
            }
        }, interval);
        this.intervals.set(intervalId, description);
        return intervalId;
    }
    
    /**
     * Add tell check to tracking set
     */
    trackTellCheck(checkId) {
        this.pendingTellChecks.add(checkId);
    }
    
    /**
     * Remove tell check from tracking set
     */
    untrackTellCheck(checkId) {
        this.pendingTellChecks.delete(checkId);
    }
    
    /**
     * Check if we're exceeding connection rate limits
     */
    _checkConnectionRateLimit() {
        const now = Date.now();
        const oneHourAgo = now - 3600000; // 1 hour ago
        
        // Clean old entries
        this.connectionHistory = this.connectionHistory.filter(entry => entry.timestamp > oneHourAgo);
        
        // Check if we're exceeding the hourly limit
        return this.connectionHistory.length < this.maxConnectionsPerHour;
    }
    
    /**
     * Increase backoff delay with exponential backoff
     */
    _increaseBackoff() {
        this.connectionBackoff.current = Math.min(
            this.connectionBackoff.current * this.connectionBackoff.multiplier,
            this.connectionBackoff.max
        );
        this.logger.info(`Connection backoff increased to ${this.connectionBackoff.current}ms`);
    }
    
    /**
     * Reset backoff delay on successful connection
     */
    _resetBackoff() {
        this.connectionBackoff.current = this.connectionBackoff.base;
        this.logger.info('Connection backoff reset');
    }
    
    /**
     * Cleanup method for module shutdown
     */
    async cleanup() {
        if (this.isShuttingDown) return; // Prevent duplicate cleanup
        
        this.logger.info('ConnectionHandler cleanup initiated');
        this.isShuttingDown = true;
        
        // Clear all timeouts
        this.pendingMentionTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.pendingMentionTimeouts.clear();
        
        // Clear all tracked timeouts and intervals
        this.timeouts.forEach((description, timeoutId) => {
            clearTimeout(timeoutId);
            this.logger.debug(`Cleanup cleared timeout: ${description}`);
        });
        this.timeouts.clear();
        
        this.intervals.forEach((description, intervalId) => {
            clearInterval(intervalId);
            this.logger.debug(`Cleanup cleared interval: ${description}`);
        });
        this.intervals.clear();
        
        this.pendingTellChecks.clear();
        
        // Clear data structures
        this.messageHistory = [];
        this.processedMessages.clear();
        this.recentMentions.clear();
        
        // Clear connection tracking
        this.connectionHistory = [];
        this.currentAttempts = 0;
        this.emergencyMode = false;
        this._resetBackoff();
        
        this.ready = false;
        
        // Remove process listeners
        process.removeListener('SIGINT', this.boundCleanup);
        process.removeListener('SIGTERM', this.boundCleanup);
        
        this.logger.info('ConnectionHandler cleanup complete');
    }
    
    /**
     * Get current timer statistics for monitoring
     */
    getTimerStats() {
        return {
            pendingMentionTimeouts: this.pendingMentionTimeouts.size,
            activeTimeouts: this.timeouts.size,
            activeIntervals: this.intervals.size,
            pendingTellChecks: this.pendingTellChecks.size,
            messageHistorySize: this.messageHistory.length,
            processedMessagesSize: this.processedMessages.size,
            recentMentionsSize: this.recentMentions.size,
            isConnected: this.isConnected,
            isShuttingDown: this.isShuttingDown,
            ready: this.ready,
            // Connection storm prevention stats
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            currentAttempts: this.currentAttempts,
            maxConcurrentAttempts: this.maxConcurrentAttempts,
            connectionHistorySize: this.connectionHistory.length,
            maxConnectionsPerHour: this.maxConnectionsPerHour,
            currentBackoff: this.connectionBackoff.current,
            emergencyMode: this.emergencyMode
        };
    }
}

export default ConnectionHandler;