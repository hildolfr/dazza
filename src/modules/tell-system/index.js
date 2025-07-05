import BaseModule from '../../core/BaseModule.js';
import TellService from './services/TellService.js';

/**
 * Tell System Module
 * Handles offline message delivery when users join the chat
 * Extracted from bot.js to provide modular tell functionality
 */
class TellSystemModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'tell-system';
        this.dependencies = ['core-database'];
        this.optionalDependencies = [];
        this.tellService = null;
    }

    async init() {
        await super.init();
        
        // Create TellService
        this.tellService = new TellService(
            this._context.services,
            this.config,
            this.logger
        );
        
        this.logger.info('Tell System module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the tell service
        await this.tellService.initialize();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'tellSystem', 
            service: {
                checkAndDeliverTells: this.tellService.checkAndDeliverTells.bind(this.tellService),
                getStatus: this.tellService.getStatus.bind(this.tellService)
            }
        });
        
        // Subscribe to user join events to trigger tell delivery
        this.subscribe('user:join', this.handleUserJoin.bind(this));
        
        this.logger.info('Tell System module started');
    }

    async stop() {
        this.logger.info('Tell System module stopping');
        
        if (this.tellService) {
            this.tellService.ready = false;
        }
        
        await super.stop();
    }

    /**
     * Handle user join events
     * @param {Object} data - User join event data
     */
    async handleUserJoin(data) {
        const { username, room } = data;
        
        if (!username || !room) {
            this.logger.warn('Invalid user join data for tell delivery', { data });
            return;
        }
        
        try {
            // Check and deliver any pending tells for this user
            await this.tellService.checkAndDeliverTells(username, room);
            
            // Emit event for other modules
            this.emit('tell:checked', { username, room });
        } catch (error) {
            this.logger.error('Error handling user join for tells', {
                error: error.message,
                username
            });
            
            // Emit error event
            this.emit('tell:error', { 
                username, 
                room, 
                error: error.message 
            });
        }
    }

    /**
     * Get module status
     * @returns {Object} - Module status information
     */
    getStatus() {
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.tellService?.ready || false,
            services: {
                tellSystem: !!this.tellService
            }
        };
    }
}

export default TellSystemModule;