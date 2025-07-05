import { VideoPayoutManager } from '../VideoPayoutManager.js';

/**
 * Video Payout Service
 * Service wrapper for VideoPayoutManager to integrate with modular architecture
 */
class VideoPayoutService {
    constructor(context, config, logger) {
        this.context = context;
        this.config = config;
        this.logger = logger;
        this.payoutManager = null;
        this.ready = false;
    }

    /**
     * Initialize the video payout service
     */
    async initialize() {
        try {
            // Create VideoPayoutManager with modular context
            this.payoutManager = new VideoPayoutManager(
                this.context.services?.get('database') || this.context.db,
                this.context.bot || this.context
            );

            // Override configuration if provided
            if (this.config) {
                this.payoutManager.config = {
                    ...this.payoutManager.config,
                    LUCKY_CHANCE: this.config.luckyChance || this.payoutManager.config.LUCKY_CHANCE,
                    NORMAL_REWARD: this.config.normalReward || this.payoutManager.config.NORMAL_REWARD,
                    LUCKY_REWARD: this.config.luckyReward || this.payoutManager.config.LUCKY_REWARD
                };
            }

            // Initialize the payout manager
            await this.payoutManager.init();

            this.ready = true;
            this.logger.info('Video payout service initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize video payout service', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Start the video payout service
     */
    async start() {
        if (!this.ready) {
            throw new Error('Video payout service not initialized');
        }

        try {
            // Start payout manager if it has a start method
            if (typeof this.payoutManager.start === 'function') {
                await this.payoutManager.start();
            }

            this.logger.info('Video payout service started');
            
        } catch (error) {
            this.logger.error('Failed to start video payout service', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Stop the video payout service
     */
    async stop() {
        try {
            if (this.payoutManager && typeof this.payoutManager.shutdown === 'function') {
                await this.payoutManager.shutdown();
            }

            this.ready = false;
            this.logger.info('Video payout service stopped');
            
        } catch (error) {
            this.logger.error('Failed to stop video payout service', {
                error: error.message
            });
        }
    }

    /**
     * Handle media change events
     * @param {Object} mediaInfo - Media information
     * @param {string} roomId - Room ID
     */
    async handleMediaChange(mediaInfo, roomId) {
        if (!this.ready || !this.payoutManager) {
            return;
        }

        try {
            await this.payoutManager.handleMediaChange(mediaInfo, roomId);
            
        } catch (error) {
            this.logger.error('Error handling media change', {
                error: error.message,
                mediaInfo,
                roomId
            });
        }
    }

    /**
     * Handle user join events
     * @param {string} username - Username
     * @param {string} roomId - Room ID
     */
    async handleUserJoin(username, roomId) {
        if (!this.ready || !this.payoutManager) {
            return;
        }

        try {
            await this.payoutManager.handleUserJoin(username, roomId);
            
        } catch (error) {
            this.logger.error('Error handling user join for video payout', {
                error: error.message,
                username,
                roomId
            });
        }
    }

    /**
     * Handle user leave events
     * @param {string} username - Username
     * @param {string} roomId - Room ID
     */
    async handleUserLeave(username, roomId) {
        if (!this.ready || !this.payoutManager) {
            return;
        }

        try {
            await this.payoutManager.handleUserLeave(username, roomId);
            
        } catch (error) {
            this.logger.error('Error handling user leave for video payout', {
                error: error.message,
                username,
                roomId
            });
        }
    }

    /**
     * Handle userlist update events
     * @param {string} roomId - Room ID
     */
    async handleUserlistUpdate(roomId) {
        if (!this.ready || !this.payoutManager) {
            return;
        }

        try {
            await this.payoutManager.handleUserlistUpdate(roomId);
            
        } catch (error) {
            this.logger.error('Error handling userlist update for video payout', {
                error: error.message,
                roomId
            });
        }
    }

    /**
     * Get user video watching statistics
     * @param {string} username - Username
     * @returns {Object} User stats
     */
    async getUserStats(username) {
        if (!this.ready || !this.payoutManager) {
            return null;
        }

        try {
            return await this.payoutManager.getUserStats(username);
        } catch (error) {
            this.logger.error('Error getting user video stats', {
                error: error.message,
                username
            });
            return null;
        }
    }

    /**
     * Get video payout service status
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            ready: this.ready,
            payoutManager: !!this.payoutManager,
            config: this.config
        };
    }

    /**
     * Get payout manager instance for direct access
     * @returns {VideoPayoutManager} The payout manager instance
     */
    getManager() {
        return this.payoutManager;
    }
}

export default VideoPayoutService;