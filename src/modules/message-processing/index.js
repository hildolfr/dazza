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
        
        // Add dependency validation
        this.requiredServices = ['database'];
    }

    async init() {
        await super.init();
        
        
        // Create MessageProcessor service
        this.messageProcessor = new MessageProcessor(
            this._context.services,  // Pass services directly - they're already available
            this.config,
            this.logger
        );
        
        this.logger.info('Message Processing module initialized');
    }

    async start() {
        await super.start();
        
        
        // Initialize the message processor
        await this.messageProcessor.initialize();
        
        // Subscribe to chat messages from core-connection
        this.subscribe('chat:message', this.handleChatMessage.bind(this));
        
        // Register service
        this.eventBus.emit('service:register', { 
            name: 'messageProcessor', 
            service: this.messageProcessor 
        });
        
        this.logger.info('[MESSAGE-PROCESSING] Message Processing module started successfully');
    }
    

    /**
     * Handle chat messages from core-connection
     * @param {Object} data - Chat message data { room, username, message, time, meta }
     */
    async handleChatMessage(data) {
        try {
            this.logger.info('[MESSAGE-PROCESSING] *** CHAT MESSAGE RECEIVED ***', {
                username: data?.username,
                message: data?.message?.substring(0, 50),
                hasData: !!data,
                dataKeys: data ? Object.keys(data) : [],
                fullData: data
            });
            
            if (!data || !data.username || !data.message) {
                this.logger.warn('[MESSAGE-PROCESSING] Invalid chat message data', { data });
                return;
            }
            
            // Skip processing server messages (join/leave announcements)
            if (data.username === '[server]') {
                this.logger.debug('[MESSAGE-PROCESSING] Skipping server message', { message: data.message });
                return;
            }
            
            // Convert core-connection format to MessageProcessor format
            const messageData = {
                username: data.username,
                msg: data.message,
                time: data.time || Date.now(),
                meta: data.meta || {}
            };
            
            // Check service availability before processing
            if (!this._context.services || typeof this._context.services.get !== 'function') {
                this.logger.warn('[MESSAGE-PROCESSING] Services registry not yet available, skipping message', {
                    username: data.username,
                    message: data.message?.substring(0, 50),
                    hasServices: !!this._context.services
                });
                return;
            }
            
            const database = this._context.services.get('database');
            this.logger.debug('[MESSAGE-PROCESSING] Service availability check', {
                hasServices: !!this._context.services,
                hasDatabase: !!database,
                availableServices: this._context.services ? Array.from(this._context.services.keys ? this._context.services.keys() : []) : [],
                databaseMethods: database ? Object.getOwnPropertyNames(database).filter(name => typeof database[name] === 'function') : []
            });
            
            if (!database) {
                this.logger.error('[MESSAGE-PROCESSING] Database service not available, cannot process message', {
                    username: data.username,
                    message: data.message?.substring(0, 50),
                    availableServices: this._context.services ? Array.from(this._context.services.keys ? this._context.services.keys() : []) : []
                });
                return;
            }
            
            
            // Create botContext to satisfy MessageProcessor requirements
            // Include userManagement service to provide userlist access
            const userManagementService = this._context.services.get('userManagement');
            const botContext = {
                username: this.config?.bot?.username || 'dazza',
                db: database,
                logger: this.logger,
                // Add userlist access for normalizeUsernameForDb function
                get userlist() {
                    if (userManagementService) {
                        return userManagementService.getUserlist();
                    }
                    return new Map(); // Return empty Map if service not available
                }
            };
            
            this.logger.info('[MESSAGE-PROCESSING] About to call messageProcessor.processMessage', {
                messageData,
                botContextKeys: Object.keys(botContext),
                hasProcessorReady: this.messageProcessor?.ready
            });
            
            const result = await this.messageProcessor.processMessage(messageData, botContext);
            this.logger.info('[MESSAGE-PROCESSING] Message processed successfully', { 
                username: data.username,
                processed: result.processed,
                reason: result.reason,
                result
            });
            
        } catch (error) {
            this.logger.error('[MESSAGE-PROCESSING] Error processing chat message', {
                error: error.message,
                stack: error.stack,
                username: data?.username,
                message: data?.message?.substring(0, 50),
                hasServices: !!this.services,
                hasDatabase: !!this.services?.get?.('database'),
                hasMessageProcessor: !!this.messageProcessor,
                messageProcessorReady: this.messageProcessor?.ready,
                availableServices: this.services ? Array.from(this.services.keys ? this.services.keys() : []) : [],
                dataStructure: data ? Object.keys(data) : []
            });
        }
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