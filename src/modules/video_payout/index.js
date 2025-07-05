import BaseModule from '../../core/BaseModule.js';
import VideoPayoutService from './services/VideoPayoutService.js';

/**
 * Video Payout Module
 * Video watching reward and payout system with session tracking
 * Converted from legacy VideoPayoutManager to modular architecture
 */
class VideoPayoutModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'video_payout';
        this.dependencies = ['core-database', 'economy-system', 'media-management'];
        this.optionalDependencies = ['user-management'];
        this.payoutService = null;
        
        // Default configuration for video payout system
        this.config = {
            luckyChance: 0.02,          // 2% chance for lucky reward
            normalReward: 1,            // Normal reward amount
            luckyReward: 3,             // Lucky reward amount
            sessionTimeout: 300000,     // 5 minutes session timeout
            reconciliationInterval: 10000,  // 10 seconds reconciliation interval
            ...context.userConfig       // Allow override from config
        };
    }

    async init() {
        await super.init();
        
        // Create VideoPayoutService
        this.payoutService = new VideoPayoutService(
            this._context,
            this.config,
            this.logger
        );
        
        this.logger.info('Video payout module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize and start the payout service
        await this.payoutService.initialize();
        await this.payoutService.start();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'videoPayout', 
            service: {
                handleMediaChange: this.payoutService.handleMediaChange.bind(this.payoutService),
                handleUserJoin: this.payoutService.handleUserJoin.bind(this.payoutService),
                handleUserLeave: this.payoutService.handleUserLeave.bind(this.payoutService),
                handleUserlistUpdate: this.payoutService.handleUserlistUpdate.bind(this.payoutService),
                getUserStats: this.payoutService.getUserStats.bind(this.payoutService),
                getStatus: this.payoutService.getStatus.bind(this.payoutService),
                getManager: this.payoutService.getManager.bind(this.payoutService)
            }
        });
        
        // Subscribe to media and user events
        this.subscribe('media:change', this.handleMediaChange.bind(this));
        this.subscribe('user:join', this.handleUserJoin.bind(this));
        this.subscribe('user:leave', this.handleUserLeave.bind(this));
        this.subscribe('userlist:update', this.handleUserlistUpdate.bind(this));
        
        this.logger.info('Video payout module started');
    }

    async stop() {
        this.logger.info('Video payout module stopping');
        
        if (this.payoutService) {
            await this.payoutService.stop();
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
            await this.payoutService.handleMediaChange(data.mediaInfo, data.roomId);
            
            // Emit event for other modules
            this.emit('video:session:change', {
                mediaInfo: data.mediaInfo,
                roomId: data.roomId,
                timestamp: Date.now()
            });
            
        } catch (error) {
            this.logger.error('Error processing media change for video payout', {
                error: error.message,
                mediaInfo: data.mediaInfo,
                roomId: data.roomId
            });
        }
    }

    /**
     * Handle user join events
     * @param {Object} data - User join event data
     */
    async handleUserJoin(data) {
        if (!data || !data.username) {
            return;
        }
        
        try {
            await this.payoutService.handleUserJoin(data.username, data.roomId);
            
        } catch (error) {
            this.logger.error('Error handling user join for video payout', {
                error: error.message,
                username: data.username,
                roomId: data.roomId
            });
        }
    }

    /**
     * Handle user leave events
     * @param {Object} data - User leave event data
     */
    async handleUserLeave(data) {
        if (!data || !data.username) {
            return;
        }
        
        try {
            await this.payoutService.handleUserLeave(data.username, data.roomId);
            
        } catch (error) {
            this.logger.error('Error handling user leave for video payout', {
                error: error.message,
                username: data.username,
                roomId: data.roomId
            });
        }
    }

    /**
     * Handle userlist update events
     * @param {Object} data - Userlist update event data
     */
    async handleUserlistUpdate(data) {
        try {
            await this.payoutService.handleUserlistUpdate(data.roomId);
            
        } catch (error) {
            this.logger.error('Error handling userlist update for video payout', {
                error: error.message,
                roomId: data.roomId
            });
        }
    }

    /**
     * Get module status
     * @returns {Object} - Module status information
     */
    getStatus() {
        const payoutStatus = this.payoutService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.payoutService?.ready || false,
            services: {
                payoutService: !!this.payoutService
            },
            payoutStatus: payoutStatus,
            config: this.config
        };
    }
}

export default VideoPayoutModule;