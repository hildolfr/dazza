import BaseModule from '../../core/BaseModule.js';
import MediaManagementService from './services/MediaManagementService.js';

/**
 * Media Management Module
 * Handles media tracking, playlist management, and media-related events
 * Extracted from bot.js to provide modular media management functionality
 */
class MediaManagementModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'media-management';
        this.dependencies = ['core-database'];
        this.optionalDependencies = ['core-api'];
        this.mediaManagementService = null;
        
        // Module configuration
        this.config = {
            roomId: context.config?.cytube?.channel || 'default',
            trackMedia: true,
            trackPlaylist: true,
            enableApiEvents: true,
            ...context.userConfig
        };
    }

    async init() {
        await super.init();
        
        // Create MediaManagementService
        this.mediaManagementService = new MediaManagementService(
            this._context.services,
            this.config,
            this.logger
        );
        
        this.logger.info('Media Management module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the media management service
        await this.mediaManagementService.initialize();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'mediaManagement', 
            service: {
                // Media tracking methods
                recordMediaPlay: this.mediaManagementService.recordMediaPlay.bind(this.mediaManagementService),
                recordMediaQueued: this.mediaManagementService.recordMediaQueued.bind(this.mediaManagementService),
                
                // Media state methods
                getCurrentMedia: this.mediaManagementService.getCurrentMedia.bind(this.mediaManagementService),
                getPlaylist: this.mediaManagementService.getPlaylist.bind(this.mediaManagementService),
                getPlaylistLocked: this.mediaManagementService.getPlaylistLocked.bind(this.mediaManagementService),
                
                // Event handler methods
                handleMediaChange: this.mediaManagementService.handleMediaChange.bind(this.mediaManagementService),
                handleMediaUpdate: this.mediaManagementService.handleMediaUpdate.bind(this.mediaManagementService),
                handlePlaylist: this.mediaManagementService.handlePlaylist.bind(this.mediaManagementService),
                handleSetCurrent: this.mediaManagementService.handleSetCurrent.bind(this.mediaManagementService),
                handleQueue: this.mediaManagementService.handleQueue.bind(this.mediaManagementService),
                handleDelete: this.mediaManagementService.handleDelete.bind(this.mediaManagementService),
                handleMoveVideo: this.mediaManagementService.handleMoveVideo.bind(this.mediaManagementService),
                
                // Statistics and status
                getMediaStats: this.mediaManagementService.getMediaStats.bind(this.mediaManagementService),
                getStatus: this.mediaManagementService.getStatus.bind(this.mediaManagementService)
            }
        });
        
        // Subscribe to media-related events
        this.subscribe('media:change', this.handleMediaChangeEvent.bind(this));
        this.subscribe('media:update', this.handleMediaUpdateEvent.bind(this));
        this.subscribe('media:playlist', this.handlePlaylistEvent.bind(this));
        this.subscribe('media:setCurrent', this.handleSetCurrentEvent.bind(this));
        this.subscribe('media:queue', this.handleQueueEvent.bind(this));
        this.subscribe('media:delete', this.handleDeleteEvent.bind(this));
        this.subscribe('media:moveVideo', this.handleMoveVideoEvent.bind(this));
        this.subscribe('media:setPlaylistMeta', this.handlePlaylistMetaEvent.bind(this));
        
        this.logger.info('Media Management module started');
    }

    async stop() {
        this.logger.info('Media Management module stopping');
        
        if (this.mediaManagementService) {
            await this.mediaManagementService.destroy();
        }
        
        await super.stop();
    }

    /**
     * Handle media change events
     */
    async handleMediaChangeEvent(data) {
        try {
            await this.mediaManagementService.handleMediaChange(data);
        } catch (error) {
            this.logger.error('Error handling media change event', {
                error: error.message,
                mediaId: data.id
            });
        }
    }

    /**
     * Handle media update events  
     */
    async handleMediaUpdateEvent(data) {
        try {
            await this.mediaManagementService.handleMediaUpdate(data);
        } catch (error) {
            this.logger.error('Error handling media update event', {
                error: error.message
            });
        }
    }

    /**
     * Handle playlist events
     */
    async handlePlaylistEvent(data) {
        try {
            await this.mediaManagementService.handlePlaylist(data);
        } catch (error) {
            this.logger.error('Error handling playlist event', {
                error: error.message
            });
        }
    }

    /**
     * Handle set current events
     */
    async handleSetCurrentEvent(data) {
        try {
            await this.mediaManagementService.handleSetCurrent(data);
        } catch (error) {
            this.logger.error('Error handling set current event', {
                error: error.message
            });
        }
    }

    /**
     * Handle queue events
     */
    async handleQueueEvent(data) {
        try {
            await this.mediaManagementService.handleQueue(data);
        } catch (error) {
            this.logger.error('Error handling queue event', {
                error: error.message
            });
        }
    }

    /**
     * Handle delete events
     */
    async handleDeleteEvent(data) {
        try {
            await this.mediaManagementService.handleDelete(data);
        } catch (error) {
            this.logger.error('Error handling delete event', {
                error: error.message
            });
        }
    }

    /**
     * Handle move video events
     */
    async handleMoveVideoEvent(data) {
        try {
            await this.mediaManagementService.handleMoveVideo(data);
        } catch (error) {
            this.logger.error('Error handling move video event', {
                error: error.message
            });
        }
    }

    /**
     * Handle playlist meta events
     */
    async handlePlaylistMetaEvent(data) {
        try {
            this.logger.debug('Playlist metadata received', data);
        } catch (error) {
            this.logger.error('Error handling playlist meta event', {
                error: error.message
            });
        }
    }

    /**
     * Get module status
     */
    getStatus() {
        const serviceStatus = this.mediaManagementService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.mediaManagementService?.ready || false,
            services: {
                mediaManagement: !!this.mediaManagementService
            },
            serviceStatus: serviceStatus
        };
    }
}

export default MediaManagementModule;