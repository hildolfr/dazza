import BaseModule from '../../core/BaseModule.js';
import PissingContestService from './services/PissingContestService.js';

/**
 * Pissing Contest Module
 * Interactive pissing contest game system with Australian bogan personality
 * Converted from legacy PissingContestManager to modular architecture
 */
class PissingContestModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'pissing_contest';
        this.dependencies = ['core-database', 'economy-system'];
        this.optionalDependencies = ['user-management'];
        this.contestService = null;
        
        // Default configuration for pissing contest system
        this.config = {
            contestTimeout: 30000,      // 30 seconds for contest
            cooldownTime: 300000,       // 5 minutes cooldown
            enableAnalytics: true,      // Enable match analytics
            enableCommentary: true,     // Enable Dazza commentary
            ...context.userConfig       // Allow override from config
        };
    }

    async init() {
        await super.init();
        
        // Create PissingContestService
        this.contestService = new PissingContestService(
            this._context,
            this.config,
            this.logger
        );
        
        this.logger.info('Pissing contest module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize and start the contest service
        await this.contestService.initialize();
        await this.contestService.start();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'pissingContest', 
            service: {
                createChallenge: this.contestService.createChallenge.bind(this.contestService),
                acceptChallenge: this.contestService.acceptChallenge.bind(this.contestService),
                declineChallenge: this.contestService.declineChallenge.bind(this.contestService),
                handleMessage: this.contestService.handleMessage.bind(this.contestService),
                getStatus: this.contestService.getStatus.bind(this.contestService),
                getManager: this.contestService.getManager.bind(this.contestService)
            }
        });
        
        // Subscribe to chat message events
        this.subscribe('chat:message', this.handleChatMessage.bind(this));
        this.subscribe('user:join', this.handleUserJoin.bind(this));
        
        this.logger.info('Pissing contest module started');
    }

    async stop() {
        this.logger.info('Pissing contest module stopping');
        
        if (this.contestService) {
            await this.contestService.stop();
        }
        
        await super.stop();
    }

    /**
     * Handle chat message events for contest commands
     * @param {Object} data - Chat message event data
     */
    async handleChatMessage(data) {
        if (!data || !data.message) {
            return;
        }
        
        try {
            await this.contestService.handleMessage(data);
            
        } catch (error) {
            this.logger.error('Error processing contest message', {
                error: error.message,
                messageId: data.message.id,
                username: data.message.username
            });
        }
    }

    /**
     * Handle user join events for contest notifications
     * @param {Object} data - User join event data
     */
    async handleUserJoin(data) {
        if (!data || !data.username) {
            return;
        }
        
        try {
            // Notify contest manager of user join if needed
            const contestManager = this.contestService.getManager();
            if (contestManager && typeof contestManager.handleUserJoin === 'function') {
                await contestManager.handleUserJoin(data);
            }
            
        } catch (error) {
            this.logger.error('Error handling user join for contest', {
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
        const contestStatus = this.contestService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.contestService?.ready || false,
            services: {
                contestService: !!this.contestService
            },
            contestStatus: contestStatus,
            config: this.config
        };
    }
}

export default PissingContestModule;