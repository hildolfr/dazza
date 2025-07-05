import BaseModule from '../../core/BaseModule.js';
import GalleryUpdateService from './services/GalleryUpdateService.js';

/**
 * Gallery Updater Module
 * Gallery generation and image health monitoring system
 * Converted from standalone GalleryUpdater to modular architecture
 */
class GalleryUpdaterModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'gallery_updater';
        this.dependencies = ['core-database'];
        this.optionalDependencies = ['user-management'];
        this.updateService = null;
        
        // Default configuration for gallery updater
        this.config = {
            updateInterval: 300000,         // 5 minutes
            minAgeForPruning: 86400000,     // 24 hours
            useDynamicGallery: process.env.ENABLE_DYNAMIC_GALLERY === 'true',
            httpTimeout: 10000,             // 10 seconds
            autoStart: true,                // Auto-start updates
            ...context.userConfig           // Allow override from config
        };
    }

    async init() {
        await super.init();
        
        // Create GalleryUpdateService
        this.updateService = new GalleryUpdateService(
            this._context,
            this.config,
            this.logger
        );
        
        this.logger.info('Gallery updater module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize and start the gallery update service
        await this.updateService.initialize();
        await this.updateService.start();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'galleryUpdater', 
            service: {
                triggerUpdate: this.updateService.triggerUpdate.bind(this.updateService),
                checkImageHealth: this.updateService.checkImageHealth.bind(this.updateService),
                startUpdates: this.updateService.startUpdates.bind(this.updateService),
                stopUpdates: this.updateService.stopUpdates.bind(this.updateService),
                getStatus: this.updateService.getStatus.bind(this.updateService),
                getUpdater: this.updateService.getUpdater.bind(this.updateService)
            }
        });
        
        // Subscribe to user image events
        this.subscribe('user:image:added', this.handleImageAdded.bind(this));
        this.subscribe('user:image:removed', this.handleImageRemoved.bind(this));
        
        this.logger.info('Gallery updater module started');
    }

    async stop() {
        this.logger.info('Gallery updater module stopping');
        
        if (this.updateService) {
            await this.updateService.stop();
        }
        
        await super.stop();
    }

    /**
     * Handle user image added events
     * @param {Object} data - Image added event data
     */
    async handleImageAdded(data) {
        if (!data || !data.username || !data.url) {
            return;
        }
        
        try {
            this.logger.debug('User image added, scheduling gallery update', {
                username: data.username,
                url: data.url
            });
            
            // Trigger an update in the next cycle to include the new image
            setTimeout(() => {
                this.updateService.triggerUpdate().catch(error => {
                    this.logger.error('Error updating gallery after image add', {
                        error: error.message,
                        username: data.username
                    });
                });
            }, 5000); // Wait 5 seconds to batch multiple additions
            
        } catch (error) {
            this.logger.error('Error handling image added event', {
                error: error.message,
                username: data.username,
                url: data.url
            });
        }
    }

    /**
     * Handle user image removed events
     * @param {Object} data - Image removed event data
     */
    async handleImageRemoved(data) {
        if (!data || !data.username || !data.url) {
            return;
        }
        
        try {
            this.logger.debug('User image removed, scheduling gallery update', {
                username: data.username,
                url: data.url
            });
            
            // Trigger an update to remove the image from gallery
            setTimeout(() => {
                this.updateService.triggerUpdate().catch(error => {
                    this.logger.error('Error updating gallery after image removal', {
                        error: error.message,
                        username: data.username
                    });
                });
            }, 2000); // Shorter delay for removals
            
        } catch (error) {
            this.logger.error('Error handling image removed event', {
                error: error.message,
                username: data.username,
                url: data.url
            });
        }
    }

    /**
     * Get module status
     * @returns {Object} - Module status information
     */
    getStatus() {
        const updateStatus = this.updateService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.updateService?.ready || false,
            services: {
                updateService: !!this.updateService
            },
            updateStatus: updateStatus,
            config: this.config
        };
    }
}

export default GalleryUpdaterModule;