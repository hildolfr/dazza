const BaseModule = require('../../core/BaseModule');
const URLCommentService = require('./services/URLCommentService');

/**
 * URL Comment Module
 * Handles automatic URL commenting with drunk personality traits
 * Extracted from bot.js to provide modular URL commenting functionality
 */
class URLCommentModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'url-comment';
        this.dependencies = ['core-database'];
        this.optionalDependencies = ['message-processing'];
        this.urlCommentService = null;
        
        // Default configuration with drunk personality traits
        this.config = {
            responseChance: 0.5,           // 50% chance to respond (drunk and misses half)
            minCooldown: 120000,           // 2 minutes minimum
            maxCooldown: 900000,           // 15 minutes maximum  
            minDrunkDelay: 1000,           // 1 second minimum delay
            maxDrunkDelay: 5000,           // 5 seconds maximum delay
            ...context.userConfig          // Allow override from config
        };
    }

    async init() {
        await super.init();
        
        // Create URLCommentService
        this.urlCommentService = new URLCommentService(
            this._context.services,
            this.config,
            this.logger
        );
        
        this.logger.info('URL Comment module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the URL comment service
        await this.urlCommentService.initialize();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'urlComment', 
            service: {
                processMessage: this.urlCommentService.processMessage.bind(this.urlCommentService),
                getStatus: this.urlCommentService.getStatus.bind(this.urlCommentService),
                getRandomUrlCooldown: this.urlCommentService.getRandomUrlCooldown.bind(this.urlCommentService)
            }
        });
        
        // Subscribe to chat message events
        this.subscribe('chat:message', this.handleChatMessage.bind(this));
        
        this.logger.info('URL Comment module started');
    }

    async stop() {
        this.logger.info('URL Comment module stopping');
        
        if (this.urlCommentService) {
            this.urlCommentService.ready = false;
        }
        
        await super.stop();
    }

    /**
     * Handle chat message events for URL detection
     * @param {Object} data - Chat message event data
     */
    async handleChatMessage(data) {
        const { message, room } = data;
        
        if (!message || !message.msg || !room) {
            return;
        }
        
        try {
            // Process the message for URLs
            await this.urlCommentService.processMessage(message, room);
            
        } catch (error) {
            this.logger.error('Error processing message for URL comments', {
                error: error.message,
                username: message.username,
                messageId: message.id
            });
        }
    }

    /**
     * Get module status
     * @returns {Object} - Module status information
     */
    getStatus() {
        const serviceStatus = this.urlCommentService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.urlCommentService?.ready || false,
            services: {
                urlComment: !!this.urlCommentService
            },
            serviceStatus: serviceStatus
        };
    }
}

module.exports = URLCommentModule;