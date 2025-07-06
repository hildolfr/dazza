import BaseModule from '../../core/BaseModule.js';
import MediaService from './services/MediaService.js';

/**
 * Media Module
 * Media tracking and database management for encountered media
 * Converted to modular architecture from standalone MediaTracker
 */
class MediaModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'media';
        this.dependencies = ['core-database'];
        this.optionalDependencies = [];
        this.mediaService = null;
        
        // Default configuration for media tracking
        this.config = {
            trackMedia: true,               // Enable media tracking
            databasePath: 'media_encountered_modular.db',  // Database path
            cleanupInterval: 86400000,      // 24 hours cleanup interval
            roomId: 'fatpizza',            // Default room ID
            ...context.userConfig          // Allow override from config
        };
    }

    async init() {
        await super.init();
        
        // Create MediaService
        this.mediaService = new MediaService(
            this._context,
            this.config,
            this.logger
        );
        
        this.logger.info('Media module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize and start the media service
        await this.mediaService.initialize();
        await this.mediaService.start();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'media', 
            service: {
                trackMedia: this.mediaService.trackMedia.bind(this.mediaService),
                getStats: this.mediaService.getStats.bind(this.mediaService),
                searchMedia: this.mediaService.searchMedia.bind(this.mediaService),
                getStatus: this.mediaService.getStatus.bind(this.mediaService),
                getTracker: this.mediaService.getTracker.bind(this.mediaService)
            }
        });
        
        // Subscribe to media events
        this.subscribe('media:change', this.handleMediaChange.bind(this));
        this.subscribe('media:queue', this.handleMediaQueue.bind(this));
        
        this.logger.info('Media module started');
    }

    async stop() {
        this.logger.info('Media module stopping');
        
        if (this.mediaService) {
            await this.mediaService.stop();
        }
        
        await super.stop();
    }

    /**
     * Handle media change events
     * @param {Object} data - Media change event data
     */
    async handleMediaChange(data) {
        if (!data || !data.mediaInfo) {
            return;
        }
        
        try {
            const result = await this.mediaService.trackMedia(data.mediaInfo);
            
            if (result) {
                // Emit event for other modules
                this.emit('media:tracked', {
                    mediaInfo: data.mediaInfo,
                    trackResult: result,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            this.logger.error('Error handling media change', {
                error: error.message,
                mediaInfo: data.mediaInfo
            });
        }
    }

    /**
     * Handle media queue events
     * @param {Object} data - Media queue event data
     */
    async handleMediaQueue(data) {
        if (!data || !data.mediaInfo) {
            return;
        }
        
        try {
            // Track queued media
            await this.mediaService.trackMedia({
                ...data.mediaInfo,
                queued: true
            });
            
        } catch (error) {
            this.logger.error('Error handling media queue', {
                error: error.message,
                mediaInfo: data.mediaInfo
            });
        }
    }

    /**
     * Get module status
     * @returns {Object} - Module status information
     */
    getStatus() {
        const mediaStatus = this.mediaService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.mediaService?.ready || false,
            services: {
                mediaService: !!this.mediaService
            },
            mediaStatus: mediaStatus,
            config: this.config
        };
    }
}

export default MediaModule;