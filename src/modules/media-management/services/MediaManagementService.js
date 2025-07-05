import MediaTracker from '../../media/MediaTracker.js';

/**
 * Media Management Service
 * Handles media tracking, playlist management, and media-related events
 * Extracted from bot.js media management functionality
 */
class MediaManagementService {
    constructor(services, config, logger) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.ready = false;
        
        // Media tracking
        this.mediaTracker = null;
        
        // Media and playlist state
        this.currentMedia = null;
        this.playlist = [];
        this.playlistLocked = false;
        
        // Service references (will be injected during initialization)
        this.videoPayoutManager = null;
        this.apiServer = null;
    }

    async initialize() {
        this.logger.info('MediaManagementService initializing...');
        
        try {
            // Initialize MediaTracker
            this.mediaTracker = new MediaTracker();
            this.mediaTracker.initialize({
                roomId: this.config.roomId
            });
            
            // Get service references
            this.videoPayoutManager = this.services.get('videoPayoutManager');
            this.apiServer = this.services.get('apiServer');
            
            this.ready = true;
            this.logger.info('MediaManagementService initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize MediaManagementService', { error: error.message });
            throw error;
        }
    }

    /**
     * Handle media change events (when new media starts playing)
     */
    async handleMediaChange(data) {
        try {
            this.logger.info(`Media changed: ${data.title || 'Unknown'} (ID: ${data.id || 'unknown'})`);
            
            // Update current media state
            this.currentMedia = data;
            
            // Emit media change event for API WebSocket
            if (this.apiServer && this.config.enableApiEvents) {
                this.apiServer.emit('media:change', {
                    title: data.title,
                    id: data.id,
                    type: data.type,
                    duration: data.duration || data.seconds
                });
            }
            
            // Handle video payout manager integration
            if (this.videoPayoutManager) {
                try {
                    await this.videoPayoutManager.handleMediaChange(data);
                } catch (err) {
                    this.logger.error('Failed to handle media change for video payout', { 
                        error: err.message 
                    });
                }
            }
            
            // Track media play
            if (this.mediaTracker && this.config.trackMedia) {
                try {
                    await this.mediaTracker.recordMediaPlay(data);
                } catch (err) {
                    this.logger.error('Failed to record media play', { 
                        error: err.message 
                    });
                }
            }
            
        } catch (error) {
            this.logger.error('Error in handleMediaChange', {
                error: error.message,
                mediaId: data.id
            });
        }
    }

    /**
     * Handle media update events (time updates, pause/resume)
     */
    handleMediaUpdate(data) {
        try {
            // Media updates happen frequently (time updates), only log if needed for debugging
            // this.logger.debug('Media update', data);
            
            if (this.currentMedia) {
                this.currentMedia.currentTime = data.currentTime || 0;
                this.currentMedia.paused = data.paused || false;
            }
            
        } catch (error) {
            this.logger.error('Error in handleMediaUpdate', {
                error: error.message
            });
        }
    }

    /**
     * Handle playlist updates (full playlist replacement)
     */
    handlePlaylist(data) {
        try {
            // Full playlist update
            this.playlist = data || [];
            this.logger.info(`Playlist updated: ${this.playlist.length} videos`);
            
        } catch (error) {
            this.logger.error('Error in handlePlaylist', {
                error: error.message
            });
        }
    }

    /**
     * Handle set current position in playlist
     */
    handleSetCurrent(data) {
        try {
            // CyTube sends this to indicate current video position
            this.logger.debug(`Current video set to position: ${data}`);
            
        } catch (error) {
            this.logger.error('Error in handleSetCurrent', {
                error: error.message
            });
        }
    }

    /**
     * Handle video queue events (videos added to playlist)
     */
    async handleQueue(data) {
        try {
            // Video added to queue
            if (data.item) {
                if (data.after) {
                    // Find position and insert after
                    const index = this.playlist.findIndex(v => v.uid === data.after);
                    if (index >= 0) {
                        this.playlist.splice(index + 1, 0, data.item);
                    } else {
                        this.playlist.push(data.item);
                    }
                } else {
                    // Add to end
                    this.playlist.push(data.item);
                }
                
                this.logger.debug(`Video queued: ${data.item.title}`);
                
                // Track media queue
                if (this.mediaTracker && this.config.trackMedia) {
                    try {
                        await this.mediaTracker.recordMediaQueued(data.item);
                    } catch (err) {
                        this.logger.error('Failed to record media queue', { 
                            error: err.message 
                        });
                    }
                }
            }
            
        } catch (error) {
            this.logger.error('Error in handleQueue', {
                error: error.message
            });
        }
    }

    /**
     * Handle video delete events (videos removed from playlist)
     */
    handleDelete(data) {
        try {
            // Video removed from queue
            const index = this.playlist.findIndex(v => v.uid === data.uid);
            if (index >= 0) {
                const removed = this.playlist.splice(index, 1)[0];
                this.logger.debug(`Video removed: ${removed.title}`);
            }
            
        } catch (error) {
            this.logger.error('Error in handleDelete', {
                error: error.message
            });
        }
    }

    /**
     * Handle video move events (videos reordered in playlist)
     */
    handleMoveVideo(data) {
        try {
            // Video moved in queue
            const fromIndex = this.playlist.findIndex(v => v.uid === data.from);
            if (fromIndex >= 0) {
                const video = this.playlist.splice(fromIndex, 1)[0];
                
                if (data.after) {
                    const toIndex = this.playlist.findIndex(v => v.uid === data.after);
                    if (toIndex >= 0) {
                        this.playlist.splice(toIndex + 1, 0, video);
                    } else {
                        this.playlist.push(video);
                    }
                } else {
                    // Move to beginning
                    this.playlist.unshift(video);
                }
            }
            
        } catch (error) {
            this.logger.error('Error in handleMoveVideo', {
                error: error.message
            });
        }
    }

    /**
     * Record media play (for external use)
     */
    async recordMediaPlay(data) {
        if (this.mediaTracker && this.config.trackMedia) {
            try {
                await this.mediaTracker.recordMediaPlay(data);
            } catch (error) {
                this.logger.error('Failed to record media play', { 
                    error: error.message 
                });
                throw error;
            }
        }
    }

    /**
     * Record media queued (for external use)
     */
    async recordMediaQueued(data) {
        if (this.mediaTracker && this.config.trackMedia) {
            try {
                await this.mediaTracker.recordMediaQueued(data);
            } catch (error) {
                this.logger.error('Failed to record media queued', { 
                    error: error.message 
                });
                throw error;
            }
        }
    }

    /**
     * Get current media
     */
    getCurrentMedia() {
        return this.currentMedia;
    }

    /**
     * Get current playlist
     */
    getPlaylist() {
        return this.playlist;
    }

    /**
     * Get playlist locked status
     */
    getPlaylistLocked() {
        return this.playlistLocked;
    }

    /**
     * Get media statistics
     */
    async getMediaStats() {
        if (this.mediaTracker) {
            try {
                return await this.mediaTracker.getStats();
            } catch (error) {
                this.logger.error('Failed to get media stats', { 
                    error: error.message 
                });
                return null;
            }
        }
        return null;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            ready: this.ready,
            name: 'MediaManagementService',
            mediaTracker: {
                enabled: this.mediaTracker?.enabled || false,
                roomId: this.mediaTracker?.roomId || null
            },
            currentMedia: this.currentMedia ? {
                id: this.currentMedia.id,
                title: this.currentMedia.title,
                type: this.currentMedia.type
            } : null,
            playlist: {
                length: this.playlist.length,
                locked: this.playlistLocked
            },
            config: {
                trackMedia: this.config.trackMedia,
                trackPlaylist: this.config.trackPlaylist,
                enableApiEvents: this.config.enableApiEvents
            }
        };
    }

    /**
     * Clean up resources
     */
    async destroy() {
        this.logger.info('MediaManagementService destroying...');
        
        // Stop media tracker
        if (this.mediaTracker) {
            this.mediaTracker.destroy();
            this.mediaTracker = null;
        }
        
        // Reset state
        this.currentMedia = null;
        this.playlist = [];
        this.playlistLocked = false;
        this.ready = false;
        
        this.logger.info('MediaManagementService destroyed');
    }
}

export default MediaManagementService;