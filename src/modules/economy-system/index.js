import BaseModule from '../../core/BaseModule.js';
import EconomySystemService from './services/EconomySystemService.js';

/**
 * Economy System Module
 * Coordinates all economy-related managers and functionality
 * Extracted from bot.js to provide modular economy management
 */
class EconomySystemModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'economy-system';
        this.dependencies = ['core-database'];
        this.optionalDependencies = ['media-management'];
        this.economySystemService = null;
        
        // Module configuration
        this.config = {
            enableHeists: true,
            enableVideoPayouts: true,
            enablePissingContests: true,
            enableCashMonitor: true,
            cashMonitorInterval: 60000, // 60 seconds
            ...context.userConfig
        };
    }

    async init() {
        await super.init();
        
        // Create EconomySystemService
        this.economySystemService = new EconomySystemService(
            this._context.services,
            this.config,
            this.logger,
            this._context.bot // Pass bot reference for economy managers
        );
        
        this.logger.info('Economy System module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the economy system service
        await this.economySystemService.initialize();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'economySystem', 
            service: {
                // Heist management
                getHeistManager: this.economySystemService.getHeistManager.bind(this.economySystemService),
                handleHeistMessage: this.economySystemService.handleHeistMessage.bind(this.economySystemService),
                
                // Video payout management
                getVideoPayoutManager: this.economySystemService.getVideoPayoutManager.bind(this.economySystemService),
                handleVideoPayoutMediaChange: this.economySystemService.handleVideoPayoutMediaChange.bind(this.economySystemService),
                
                // Pissing contest management
                getPissingContestManager: this.economySystemService.getPissingContestManager.bind(this.economySystemService),
                handlePissingContestMessage: this.economySystemService.handlePissingContestMessage.bind(this.economySystemService),
                
                // Cash monitoring
                getCashMonitor: this.economySystemService.getCashMonitor.bind(this.economySystemService),
                startCashMonitor: this.economySystemService.startCashMonitor.bind(this.economySystemService),
                stopCashMonitor: this.economySystemService.stopCashMonitor.bind(this.economySystemService),
                
                // Combined message processing
                processMessage: this.economySystemService.processMessage.bind(this.economySystemService),
                
                // Status and statistics
                getStatus: this.economySystemService.getStatus.bind(this.economySystemService)
            }
        });
        
        // Subscribe to relevant events
        this.subscribe('chat:message', this.handleChatMessage.bind(this));
        this.subscribe('media:change', this.handleMediaChange.bind(this));
        this.subscribe('connection:disconnect', this.handleDisconnect.bind(this));
        
        this.logger.info('Economy System module started');
    }

    async stop() {
        this.logger.info('Economy System module stopping');
        
        if (this.economySystemService) {
            await this.economySystemService.destroy();
        }
        
        await super.stop();
    }

    /**
     * Handle chat message events for economy processing
     */
    async handleChatMessage(data) {
        const { message, room } = data;
        
        if (!message || !message.msg) {
            return;
        }
        
        try {
            await this.economySystemService.processMessage(message, room);
            
        } catch (error) {
            this.logger.error('Error processing message for economy system', {
                error: error.message,
                username: message.username,
                messageId: message.id
            });
        }
    }

    /**
     * Handle media change events for video payouts
     */
    async handleMediaChange(data) {
        try {
            await this.economySystemService.handleVideoPayoutMediaChange(data);
            
        } catch (error) {
            this.logger.error('Error handling media change for economy system', {
                error: error.message,
                mediaId: data.id
            });
        }
    }

    /**
     * Handle disconnect events
     */
    async handleDisconnect() {
        try {
            await this.economySystemService.stopCashMonitor();
            
        } catch (error) {
            this.logger.error('Error stopping cash monitor on disconnect', {
                error: error.message
            });
        }
    }

    /**
     * Get module status
     */
    getStatus() {
        const serviceStatus = this.economySystemService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.economySystemService?.ready || false,
            services: {
                economySystem: !!this.economySystemService
            },
            serviceStatus: serviceStatus
        };
    }
}

export default EconomySystemModule;