import BaseModule from '../../core/BaseModule.js';
import MessageProcessor from './services/MessageProcessor.js';

/**
 * Message Processing Module
 * Handles core message filtering, validation, routing, and processing
 * Extracted from bot.js to provide modular message handling
 */
class MessageProcessingModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'message-processing';
        this.dependencies = ['core-database'];
        this.optionalDependencies = ['permissions', 'cooldown'];
    }

    async init() {
        await super.init();
        
        // Create MessageProcessor service
        this.messageProcessor = new MessageProcessor(
            this._context.services,
            this.config,
            this.logger
        );
        
        this.logger.info('Message Processing module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the message processor
        await this.messageProcessor.initialize();
        
        // Register service
        this.eventBus.emit('service:register', { 
            name: 'messageProcessor', 
            service: this.messageProcessor 
        });
        
        this.logger.info('Message Processing module started');
    }

    async stop() {
        this.logger.info('Message Processing module stopping');
        
        if (this.messageProcessor) {
            // Perform any cleanup needed
            this.messageProcessor.ready = false;
        }
        
        await super.stop();
    }

    getStatus() {
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.messageProcessor?.ready || false,
            services: {
                messageProcessor: !!this.messageProcessor
            }
        };
    }
}

export default MessageProcessingModule;