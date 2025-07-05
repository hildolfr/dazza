import GalleryUpdater from '../GalleryUpdater.js';

/**
 * Gallery Update Service
 * Service wrapper for GalleryUpdater to integrate with modular architecture
 */
class GalleryUpdateService {
    constructor(context, config, logger) {
        this.context = context;
        this.config = config;
        this.logger = logger;
        this.galleryUpdater = null;
        this.ready = false;
    }

    /**
     * Initialize the gallery update service
     */
    async initialize() {
        try {
            // Get database service
            const database = this.context.services?.database || this.context.db;
            if (!database) {
                throw new Error('Database service not available for gallery updater');
            }

            // Create GalleryUpdater instance
            this.galleryUpdater = new GalleryUpdater(database, this.logger);

            // Override configuration if provided
            if (this.config) {
                if (this.config.updateInterval) {
                    this.galleryUpdater.updateInterval = this.config.updateInterval;
                }
                if (typeof this.config.useDynamicGallery === 'boolean') {
                    this.galleryUpdater.useDynamicGallery = this.config.useDynamicGallery;
                }
            }

            this.ready = true;
            this.logger.info('Gallery update service initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize gallery update service', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Start the gallery update service
     */
    async start() {
        if (!this.ready) {
            throw new Error('Gallery update service not initialized');
        }

        try {
            // Start the gallery updater
            if (this.config.autoStart !== false) {
                await this.galleryUpdater.start();
                this.logger.info('Gallery update service started');
            } else {
                this.logger.info('Gallery update service initialized but not auto-started');
            }
            
        } catch (error) {
            this.logger.error('Failed to start gallery update service', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Stop the gallery update service
     */
    async stop() {
        try {
            if (this.galleryUpdater && typeof this.galleryUpdater.stop === 'function') {
                await this.galleryUpdater.stop();
            }

            this.ready = false;
            this.logger.info('Gallery update service stopped');
            
        } catch (error) {
            this.logger.error('Failed to stop gallery update service', {
                error: error.message
            });
        }
    }

    /**
     * Manually trigger a gallery update
     * @returns {Promise} Update result
     */
    async triggerUpdate() {
        if (!this.ready || !this.galleryUpdater) {
            throw new Error('Gallery update service not ready');
        }

        try {
            return await this.galleryUpdater.update();
        } catch (error) {
            this.logger.error('Error triggering gallery update', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Check health of a specific image URL
     * @param {string} url - Image URL to check
     * @returns {Promise<boolean>} True if image is healthy
     */
    async checkImageHealth(url) {
        if (!this.ready || !this.galleryUpdater) {
            return false;
        }

        try {
            return await this.galleryUpdater.checkImageHealth(url);
        } catch (error) {
            this.logger.error('Error checking image health', {
                error: error.message,
                url
            });
            return false;
        }
    }

    /**
     * Start periodic gallery updates
     * @returns {Promise} Start result
     */
    async startUpdates() {
        if (!this.ready || !this.galleryUpdater) {
            throw new Error('Gallery update service not ready');
        }

        try {
            return await this.galleryUpdater.start();
        } catch (error) {
            this.logger.error('Error starting gallery updates', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Stop periodic gallery updates
     */
    async stopUpdates() {
        if (this.galleryUpdater) {
            this.galleryUpdater.stop();
        }
    }

    /**
     * Get gallery update service status
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            ready: this.ready,
            galleryUpdater: !!this.galleryUpdater,
            isUpdating: this.galleryUpdater?.isUpdating || false,
            lastUpdate: this.galleryUpdater?.lastUpdateHash || null,
            updateInterval: this.galleryUpdater?.updateInterval || null,
            config: this.config
        };
    }

    /**
     * Get gallery updater instance for direct access
     * @returns {GalleryUpdater} The gallery updater instance
     */
    getUpdater() {
        return this.galleryUpdater;
    }
}

export default GalleryUpdateService;