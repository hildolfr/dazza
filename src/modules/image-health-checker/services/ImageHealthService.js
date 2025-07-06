import { ImageHealthChecker } from '../ImageHealthChecker.js';

/**
 * Image Health Service
 * Service wrapper for ImageHealthChecker to integrate with modular architecture
 */
class ImageHealthService {
    constructor(context, config, logger) {
        this.context = context;
        this.config = config;
        this.logger = logger;
        this.healthChecker = null;
        this.ready = false;
    }

    /**
     * Initialize the image health service
     */
    async initialize() {
        try {
            // Create ImageHealthChecker instance with enhanced context including services
            const botContext = this.context.bot || this.context;
            // Add services registry to the bot context for modular architecture compatibility
            if (!botContext.services && this.context.services) {
                botContext.services = this.context.services;
            }
            // Ensure database access is available
            if (!botContext.db && this.context.db) {
                botContext.db = this.context.db;
            }
            this.healthChecker = new ImageHealthChecker(botContext);

            // Override configuration if provided
            if (this.config) {
                if (this.config.checkInterval) {
                    this.healthChecker.checkInterval = this.config.checkInterval;
                }
                if (this.config.recheckInterval) {
                    this.healthChecker.recheckInterval = this.config.recheckInterval;
                }
                if (this.config.batchSize) {
                    this.healthChecker.batchSize = this.config.batchSize;
                }
                if (this.config.minFailureInterval) {
                    this.healthChecker.minFailureInterval = this.config.minFailureInterval;
                }
                if (this.config.maxFailures) {
                    this.healthChecker.maxFailures = this.config.maxFailures;
                }
                if (this.config.maxRecheckHours) {
                    this.healthChecker.maxRecheckHours = this.config.maxRecheckHours;
                }
            }

            this.ready = true;
            this.logger.info('Image health service initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize image health service', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Start the image health service
     */
    async start() {
        if (!this.ready) {
            throw new Error('Image health service not initialized');
        }

        try {
            // Start the health checker
            if (this.config.autoStart !== false) {
                this.healthChecker.start();
                this.logger.info('Image health service started');
            } else {
                this.logger.info('Image health service initialized but not auto-started');
            }
            
        } catch (error) {
            this.logger.error('Failed to start image health service', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Stop the image health service
     */
    async stop() {
        try {
            if (this.healthChecker && typeof this.healthChecker.stop === 'function') {
                this.healthChecker.stop();
            }

            this.ready = false;
            this.logger.info('Image health service stopped');
            
        } catch (error) {
            this.logger.error('Failed to stop image health service', {
                error: error.message
            });
        }
    }

    /**
     * Manually trigger a health check
     * @returns {Promise} Check result
     */
    async runHealthCheck() {
        if (!this.ready || !this.healthChecker) {
            throw new Error('Image health service not ready');
        }

        try {
            return await this.healthChecker.runHealthCheck();
        } catch (error) {
            this.logger.error('Error running health check', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Check health of images for a specific user
     * @param {string} username - Username to check
     * @returns {Promise} Check result
     */
    async checkUserImages(username) {
        if (!this.ready || !this.healthChecker) {
            throw new Error('Image health service not ready');
        }

        try {
            return await this.healthChecker.checkUserImages(username);
        } catch (error) {
            this.logger.error('Error checking user images', {
                error: error.message,
                username
            });
            throw error;
        }
    }

    /**
     * Recheck a specific pruned image
     * @param {number} imageId - Image ID to recheck
     * @returns {Promise} Recheck result
     */
    async recheckImage(imageId) {
        if (!this.ready || !this.healthChecker) {
            throw new Error('Image health service not ready');
        }

        try {
            return await this.healthChecker.recheckImage(imageId);
        } catch (error) {
            this.logger.error('Error rechecking image', {
                error: error.message,
                imageId
            });
            throw error;
        }
    }

    /**
     * Run recheck for all pruned images
     * @returns {Promise} Recheck result
     */
    async runRecheckPrunedImages() {
        if (!this.ready || !this.healthChecker) {
            throw new Error('Image health service not ready');
        }

        try {
            return await this.healthChecker.runRecheckPrunedImages();
        } catch (error) {
            this.logger.error('Error rechecking pruned images', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Start health check monitoring
     */
    async startMonitoring() {
        if (this.healthChecker) {
            this.healthChecker.start();
        }
    }

    /**
     * Stop health check monitoring
     */
    async stopMonitoring() {
        if (this.healthChecker) {
            this.healthChecker.stop();
        }
    }

    /**
     * Get image health service status
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            ready: this.ready,
            healthChecker: !!this.healthChecker,
            isRunning: this.healthChecker?.isRunning || false,
            intervals: {
                checkInterval: this.healthChecker?.checkInterval || null,
                recheckInterval: this.healthChecker?.recheckInterval || null
            },
            config: this.config
        };
    }

    /**
     * Get health checker instance for direct access
     * @returns {ImageHealthChecker} The health checker instance
     */
    getChecker() {
        return this.healthChecker;
    }
}

export default ImageHealthService;