/**
 * Connection Handler Service
 * Manages CyTube connection events, disconnection/reconnection logic,
 * and chat event routing. Extracted from bot.js for modular architecture.
 */
class ConnectionHandler {
    constructor(services, config, logger) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        
        // Tracking structures
        this.pendingMentionTimeouts = new Set();
        this.pendingTellChecks = new Set();
        this.messageHistory = [];
        this.processedMessages = new Set();
        this.recentMentions = new Set();
        
        // Connection state
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
        this.reconnectDelay = config.reconnectDelay || 30000;
        
        this.ready = false;
    }
    
    async initialize() {
        // Get required services
        this.database = this.services.get('database');
        this.eventBus = this.services.get('eventBus');
        this.connection = this.services.get('connection');
        
        // Optional services
        this.messageProcessor = this.services.get('messageProcessor');
        
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
        
        // Chat events - route to message processor if available
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
        this.connection.on('setCurrent', (data) => this.handleSetCurrent(data));
        
        this.logger.debug('Connection event handlers setup complete');
    }
    
    /**
     * Handle chat messages - route to message processor or emit events
     */
    async handleChatMessage(data) {
        try {
            // If message processor is available, use it
            if (this.messageProcessor) {
                const result = await this.messageProcessor.processMessage(data);
                this.logger.debug('Message processed by MessageProcessor', { result });
            } else {
                // Fallback: emit event for other modules to handle
                this.eventBus.emit('chat:message', {
                    username: data.username,
                    message: data.msg,
                    timestamp: data.time || Date.now(),
                    meta: data.meta
                });
            }
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
                
                // Schedule reconnect after the required delay
                setTimeout(() => {
                    this.handleReconnect();
                }, waitTime * 1000);
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
    trackTimeout(timeoutId) {
        this.pendingMentionTimeouts.add(timeoutId);
    }
    
    /**
     * Remove timeout from tracking set
     */
    untrackTimeout(timeoutId) {
        this.pendingMentionTimeouts.delete(timeoutId);
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
     * Cleanup method for module shutdown
     */
    async cleanup() {
        this.logger.info('ConnectionHandler cleanup initiated');
        
        // Clear all timeouts
        this.pendingMentionTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.pendingMentionTimeouts.clear();
        this.pendingTellChecks.clear();
        
        // Clear data structures
        this.messageHistory = [];
        this.processedMessages.clear();
        this.recentMentions.clear();
        
        this.ready = false;
        this.logger.info('ConnectionHandler cleanup complete');
    }
}

module.exports = ConnectionHandler;