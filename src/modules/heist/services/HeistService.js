import { HeistManager } from '../HeistManager_multiroom.js';

/**
 * Heist Service
 * Service wrapper for HeistManager to integrate with modular architecture
 */
class HeistService {
    constructor(context, config, logger) {
        this.context = context;
        this.config = config;
        this.logger = logger;
        this.heistManager = null;
        this.ready = false;
    }

    /**
     * Initialize the heist service
     */
    async initialize() {
        try {
            // Create HeistManager with modular context
            this.heistManager = new HeistManager(
                this.context.services?.get('database') || this.context.db,
                this.context.bot || this.context,
                this.logger
            );

            // Initialize the heist manager
            if (typeof this.heistManager.init === 'function') {
                await this.heistManager.init();
            }

            this.ready = true;
            this.logger.info('Heist service initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize heist service', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Start the heist service
     */
    async start() {
        if (!this.ready) {
            throw new Error('Heist service not initialized');
        }

        try {
            // Start heist manager if it has a start method
            if (typeof this.heistManager.start === 'function') {
                await this.heistManager.start();
            }

            this.logger.info('Heist service started');
            
        } catch (error) {
            this.logger.error('Failed to start heist service', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Stop the heist service
     */
    async stop() {
        try {
            if (this.heistManager && typeof this.heistManager.stop === 'function') {
                await this.heistManager.stop();
            }

            this.ready = false;
            this.logger.info('Heist service stopped');
            
        } catch (error) {
            this.logger.error('Failed to stop heist service', {
                error: error.message
            });
        }
    }

    /**
     * Handle chat messages for heist commands
     * @param {Object} data - Chat message data
     */
    async handleMessage(data) {
        if (!this.ready || !this.heistManager) {
            return;
        }

        try {
            // Validate input data structure
            if (!data || typeof data !== 'object') {
                this.logger.warn('Invalid heist message data - not an object', { data });
                return;
            }

            // Extract data from chat:message event structure
            // Expected structure: { username: string, message: string, timestamp: number, isPM: boolean }
            let username, message, roomId;
            
            if (data.message && typeof data.message === 'object') {
                // Legacy structure: { message: { username, msg, ... }, roomId, ... }
                username = data.message.username;
                message = data.message.msg;
                roomId = data.roomId || 'fatpizza';
            } else {
                // Standard chat:message event structure: { username, message, ... }
                username = data.username;
                message = data.message || data.msg;
                roomId = data.roomId || 'fatpizza';
            }
            
            // Strict parameter validation
            if (typeof username !== 'string' || username.trim() === '') {
                this.logger.warn('Invalid heist message data - username not a valid string', {
                    username,
                    usernameType: typeof username,
                    hasMessage: !!message,
                    dataKeys: Object.keys(data)
                });
                return;
            }
            
            if (typeof message !== 'string' || message.trim() === '') {
                this.logger.warn('Invalid heist message data - message not a valid string', {
                    username,
                    message,
                    messageType: typeof message,
                    dataKeys: Object.keys(data)
                });
                return;
            }
            
            // Ensure roomId is a string
            if (typeof roomId !== 'string') {
                roomId = 'fatpizza'; // Default fallback
            }
            
            // Forward message to heist manager with validated parameters
            if (typeof this.heistManager.handleMessage === 'function') {
                await this.heistManager.handleMessage(username, message, roomId);
            }
            
        } catch (error) {
            this.logger.error('Error handling heist message', {
                error: error.message,
                stack: error.stack,
                username: data?.username || 'unknown',
                message: data?.message?.substring(0, 100) || 'unknown',
                dataStructure: data ? Object.keys(data) : 'null'
            });
        }
    }

    /**
     * Get heist service status
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            ready: this.ready,
            heistManager: !!this.heistManager,
            config: this.config
        };
    }

    /**
     * Get heist manager instance for direct access
     * @returns {HeistManager} The heist manager instance
     */
    getManager() {
        return this.heistManager;
    }
}

export default HeistService;