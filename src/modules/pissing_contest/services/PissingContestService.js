import { PissingContestManager } from '../PissingContestManager.js';

/**
 * Pissing Contest Service
 * Service wrapper for PissingContestManager to integrate with modular architecture
 */
class PissingContestService {
    constructor(context, config, logger) {
        this.context = context;
        this.config = config;
        this.logger = logger;
        this.contestManager = null;
        this.ready = false;
    }

    /**
     * Initialize the pissing contest service
     */
    async initialize() {
        try {
            // Create PissingContestManager with modular context
            this.contestManager = new PissingContestManager(
                this.context.bot || this.context
            );

            // Initialize the contest manager if it has an init method
            if (typeof this.contestManager.init === 'function') {
                await this.contestManager.init();
            }

            this.ready = true;
            this.logger.info('Pissing contest service initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize pissing contest service', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Start the pissing contest service
     */
    async start() {
        if (!this.ready) {
            throw new Error('Pissing contest service not initialized');
        }

        try {
            // Start contest manager if it has a start method
            if (typeof this.contestManager.start === 'function') {
                await this.contestManager.start();
            }

            this.logger.info('Pissing contest service started');
            
        } catch (error) {
            this.logger.error('Failed to start pissing contest service', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Stop the pissing contest service
     */
    async stop() {
        try {
            if (this.contestManager && typeof this.contestManager.stop === 'function') {
                await this.contestManager.stop();
            }

            this.ready = false;
            this.logger.info('Pissing contest service stopped');
            
        } catch (error) {
            this.logger.error('Failed to stop pissing contest service', {
                error: error.message
            });
        }
    }

    /**
     * Handle chat messages for contest commands
     * @param {Object} data - Chat message data
     */
    async handleMessage(data) {
        if (!this.ready || !this.contestManager) {
            return;
        }

        try {
            // Forward message to contest manager if it has a message handler
            if (typeof this.contestManager.handleMessage === 'function') {
                await this.contestManager.handleMessage(data);
            }
            
        } catch (error) {
            this.logger.error('Error handling contest message', {
                error: error.message,
                username: data.username,
                message: data.message
            });
        }
    }

    /**
     * Create a new contest challenge
     * @param {string} challenger - Challenger username
     * @param {string} challenged - Challenged username
     * @param {number} amount - Bet amount
     * @param {string} roomId - Room ID
     * @returns {Object} Challenge result
     */
    async createChallenge(challenger, challenged, amount, roomId) {
        if (!this.ready || !this.contestManager) {
            return { success: false, message: "Contest service not ready" };
        }

        try {
            return await this.contestManager.createChallenge(challenger, challenged, amount, roomId);
        } catch (error) {
            this.logger.error('Error creating contest challenge', {
                error: error.message,
                challenger,
                challenged,
                amount
            });
            return { success: false, message: "Error creating challenge" };
        }
    }

    /**
     * Accept a contest challenge
     * @param {string} username - Username accepting the challenge
     * @param {string} roomId - Room ID
     * @returns {Object} Accept result
     */
    async acceptChallenge(username, roomId) {
        if (!this.ready || !this.contestManager) {
            return { success: false, message: "Contest service not ready" };
        }

        try {
            return await this.contestManager.acceptChallenge(username, roomId);
        } catch (error) {
            this.logger.error('Error accepting contest challenge', {
                error: error.message,
                username
            });
            return { success: false, message: "Error accepting challenge" };
        }
    }

    /**
     * Decline a contest challenge
     * @param {string} username - Username declining the challenge
     * @param {string} roomId - Room ID
     * @returns {Object} Decline result
     */
    async declineChallenge(username, roomId) {
        if (!this.ready || !this.contestManager) {
            return { success: false, message: "Contest service not ready" };
        }

        try {
            return await this.contestManager.declineChallenge(username, roomId);
        } catch (error) {
            this.logger.error('Error declining contest challenge', {
                error: error.message,
                username
            });
            return { success: false, message: "Error declining challenge" };
        }
    }

    /**
     * Get contest service status
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            ready: this.ready,
            contestManager: !!this.contestManager,
            config: this.config
        };
    }

    /**
     * Get contest manager instance for direct access
     * @returns {PissingContestManager} The contest manager instance
     */
    getManager() {
        return this.contestManager;
    }
}

export default PissingContestService;