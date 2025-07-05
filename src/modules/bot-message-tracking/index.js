const BaseModule = require('../../core/BaseModule');
const MessageTracker = require('./services/MessageTracker');

/**
 * Bot Message Tracking Module
 * Handles bot message tracking, echo prevention, and duplicate detection
 * Extracted from bot.js to provide modular message tracking functionality
 */
class BotMessageTrackingModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'bot-message-tracking';
        this.dependencies = [];
        this.optionalDependencies = [];
        this.messageTracker = null;
        
        // Default configuration for message tracking
        this.config = {
            messageCacheDuration: 30000,    // 30 seconds
            maxProcessedSize: 1000,         // Max processed messages to track
            staleMessageThreshold: 30000,   // Ignore messages older than 30s
            cleanupInterval: 60000,         // Cleanup every minute
            ...context.userConfig           // Allow override from config
        };
    }

    async init() {
        await super.init();
        
        // Create MessageTracker service
        this.messageTracker = new MessageTracker(
            this._context.services,
            this.config,
            this.logger
        );
        
        this.logger.info('Bot Message Tracking module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the message tracker
        await this.messageTracker.initialize();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'messageTracker', 
            service: {
                trackBotMessage: this.messageTracker.trackBotMessage.bind(this.messageTracker),
                isRecentBotMessage: this.messageTracker.isRecentBotMessage.bind(this.messageTracker),
                processMessage: this.messageTracker.processMessage.bind(this.messageTracker),
                isMessageProcessed: this.messageTracker.isMessageProcessed.bind(this.messageTracker),
                markMessageProcessed: this.messageTracker.markMessageProcessed.bind(this.messageTracker),
                isMessageStale: this.messageTracker.isMessageStale.bind(this.messageTracker),
                hashMessage: this.messageTracker.hashMessage.bind(this.messageTracker),
                getStats: this.messageTracker.getStats.bind(this.messageTracker),
                getStatus: this.messageTracker.getStatus.bind(this.messageTracker)
            }
        });
        
        // Subscribe to chat message events for tracking
        this.subscribe('chat:message', this.handleChatMessage.bind(this));
        
        this.logger.info('Bot Message Tracking module started');
    }

    async stop() {
        this.logger.info('Bot Message Tracking module stopping');
        
        if (this.messageTracker) {
            await this.messageTracker.cleanup();
        }
        
        await super.stop();
    }

    /**
     * Handle chat message events for tracking
     * @param {Object} data - Chat message event data
     */
    async handleChatMessage(data) {
        if (!data || !data.message) {
            return;
        }
        
        try {
            // Process the message for tracking
            const result = this.messageTracker.processMessage(data);
            
            // Emit events based on processing result
            if (result.shouldProcess) {
                this.emit('message:tracked', {
                    messageId: data.message.id,
                    username: data.message.username,
                    reason: result.reason
                });
            } else {
                this.emit('message:duplicate', {
                    messageId: data.message.id,
                    username: data.message.username,
                    reason: result.reason
                });
            }
            
        } catch (error) {
            this.logger.error('Error processing message for tracking', {
                error: error.message,
                messageId: data.message.id,
                username: data.message.username
            });
        }
    }

    /**
     * Get module status
     * @returns {Object} - Module status information
     */
    getStatus() {
        const trackerStatus = this.messageTracker?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.messageTracker?.ready || false,
            services: {
                messageTracker: !!this.messageTracker
            },
            trackerStatus: trackerStatus
        };
    }
}

module.exports = BotMessageTrackingModule;