import BaseModule from '../../core/BaseModule.js';
import HeistService from './services/HeistService.js';

/**
 * Heist Module
 * Interactive heist game system with Australian bogan personality
 * Converted from legacy HeistManager to modular architecture
 */
class HeistModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'heist';
        this.dependencies = ['core-database', 'economy-system'];
        this.optionalDependencies = ['user-management'];
        this.heistService = null;
        
        // Default configuration for heist system
        this.config = {
            heistInterval: 300000,      // 5 minutes between heists
            crimeCheckInterval: 60000,  // 1 minute crime checks
            maxParticipants: 10,        // Max players per heist
            enableAnnouncements: true,  // Enable heist announcements
            ...context.userConfig       // Allow override from config
        };
    }

    async init() {
        await super.init();
        
        // Create HeistService
        this.heistService = new HeistService(
            this._context,
            this.config,
            this.logger
        );
        
        this.logger.info('Heist module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize and start the heist service
        await this.heistService.initialize();
        await this.heistService.start();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'heist', 
            service: {
                handleMessage: this.heistService.handleMessage.bind(this.heistService),
                getStatus: this.heistService.getStatus.bind(this.heistService),
                getManager: this.heistService.getManager.bind(this.heistService)
            }
        });
        
        // Subscribe to chat message events
        this.subscribe('chat:message', this.handleChatMessage.bind(this));
        this.subscribe('user:join', this.handleUserJoin.bind(this));
        
        this.logger.info('Heist module started');
    }

    async stop() {
        this.logger.info('Heist module stopping');
        
        if (this.heistService) {
            await this.heistService.stop();
        }
        
        await super.stop();
    }

    /**
     * Handle chat message events for heist commands
     * @param {Object} data - Chat message event data
     */
    async handleChatMessage(data) {
        if (!data || !data.message) {
            return;
        }
        
        try {
            await this.heistService.handleMessage(data);
            
        } catch (error) {
            this.logger.error('Error processing heist message', {
                error: error.message,
                messageId: data.message.id,
                username: data.message.username
            });
        }
    }

    /**
     * Handle user join events for heist notifications
     * @param {Object} data - User join event data
     */
    async handleUserJoin(data) {
        if (!data || !data.username) {
            return;
        }
        
        try {
            // Notify heist manager of user join if needed
            const heistManager = this.heistService.getManager();
            if (heistManager && typeof heistManager.handleUserJoin === 'function') {
                await heistManager.handleUserJoin(data);
            }
            
        } catch (error) {
            this.logger.error('Error handling user join for heist', {
                error: error.message,
                username: data.username
            });
        }
    }

    /**
     * Get module status
     * @returns {Object} - Module status information
     */
    getStatus() {
        const heistStatus = this.heistService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.heistService?.ready || false,
            services: {
                heistService: !!this.heistService
            },
            heistStatus: heistStatus,
            config: this.config
        };
    }
}

export default HeistModule;