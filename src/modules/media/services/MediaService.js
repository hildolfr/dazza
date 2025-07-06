import MediaTracker from '../MediaTracker.js';

/**
 * Media Service
 * Service wrapper for MediaTracker to integrate with modular architecture
 */
class MediaService {
    constructor(context, config, logger) {
        this.context = context;
        this.config = config;
        this.logger = logger;
        this.mediaTracker = null;
        this.ready = false;
    }

    /**
     * Initialize the media service
     */
    async initialize() {
        try {
            // Create MediaTracker instance
            this.mediaTracker = new MediaTracker();

            // Initialize with configuration
            const trackerConfig = {
                roomId: this.config.roomId || 'fatpizza',
                trackMedia: this.config.trackMedia !== false,
                databasePath: this.config.databasePath || 'media_encountered_modular.db',
                ...this.config
            };

            await this.mediaTracker.initialize(trackerConfig);

            this.ready = true;
            this.logger.info('Media service initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize media service', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Start the media service
     */
    async start() {
        if (!this.ready) {
            throw new Error('Media service not initialized');
        }

        try {
            // Start media tracker if it has a start method
            if (typeof this.mediaTracker.start === 'function') {
                await this.mediaTracker.start();
            }

            this.logger.info('Media service started');
            
        } catch (error) {
            this.logger.error('Failed to start media service', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Stop the media service
     */
    async stop() {
        try {
            if (this.mediaTracker && typeof this.mediaTracker.stop === 'function') {
                await this.mediaTracker.stop();
            }

            this.ready = false;
            this.logger.info('Media service stopped');
            
        } catch (error) {
            this.logger.error('Failed to stop media service', {
                error: error.message
            });
        }
    }

    /**
     * Track media information
     * @param {Object} mediaInfo - Media information to track
     * @returns {Promise} Track result
     */
    async trackMedia(mediaInfo) {
        if (!this.ready || !this.mediaTracker) {
            return null;
        }

        try {
            return await this.mediaTracker.trackMedia(mediaInfo);
        } catch (error) {
            this.logger.error('Error tracking media', {
                error: error.message,
                mediaInfo
            });
            return null;
        }
    }

    /**
     * Get media statistics
     * @returns {Object} Media statistics
     */
    async getStats() {
        if (!this.ready || !this.mediaTracker) {
            return {};
        }

        try {
            return await this.mediaTracker.getStats();
        } catch (error) {
            this.logger.error('Error getting media stats', {
                error: error.message
            });
            return {};
        }
    }

    /**
     * Search media history
     * @param {string} query - Search query
     * @returns {Array} Search results
     */
    async searchMedia(query) {
        if (!this.ready || !this.mediaTracker) {
            return [];
        }

        try {
            return await this.mediaTracker.searchMedia(query);
        } catch (error) {
            this.logger.error('Error searching media', {
                error: error.message,
                query
            });
            return [];
        }
    }

    /**
     * Get media service status
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            ready: this.ready,
            mediaTracker: !!this.mediaTracker,
            config: this.config
        };
    }

    /**
     * Get media tracker instance for direct access
     * @returns {MediaTracker} The media tracker instance
     */
    getTracker() {
        return this.mediaTracker;
    }
}

export default MediaService;