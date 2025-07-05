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
            // Handle different data structures that might be passed
            let username, message, roomId;
            
            if (data.message && typeof data.message === 'object') {
                // Structure: { message: { username, msg, ... }, roomId, ... }
                username = data.message.username;
                message = data.message.msg;
                roomId = data.roomId || 'fatpizza';
            } else {
                // Structure: { username, message/msg, roomId, ... }
                username = data.username;
                message = data.message || data.msg;
                roomId = data.roomId || 'fatpizza';
            }
            
            // Validate we have required data
            if (!username || !message) {
                this.logger.warn('Invalid heist message data', {
                    hasUsername: !!username,
                    hasMessage: !!message,
                    dataStructure: Object.keys(data)
                });
                return;
            }
            
            // Forward message to heist manager with correct parameters
            if (typeof this.heistManager.handleMessage === 'function') {
                await this.heistManager.handleMessage(username, message, roomId);
            }
            
        } catch (error) {
            this.logger.error('Error handling heist message', {
                error: error.message,
                stack: error.stack,
                dataStructure: Object.keys(data),
                data: JSON.stringify(data).substring(0, 200)
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