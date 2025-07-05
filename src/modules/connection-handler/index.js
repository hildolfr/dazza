const BaseModule = require('../../core/BaseModule');
const ConnectionHandler = require('./services/ConnectionHandler');

/**
 * Connection Handler Module
 * Manages CyTube connection events, disconnection/reconnection logic,
 * and chat event routing
 */
class ConnectionHandlerModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'connection-handler';
        this.dependencies = ['core-database', 'core-connection'];
        this.optionalDependencies = ['message-processing'];
    }

    async init() {
        await super.init();
        
        // Create ConnectionHandler service
        this.connectionHandler = new ConnectionHandler(
            this._context.services,
            this.config,
            this.logger
        );
        
        this.logger.info('Connection Handler module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the connection handler
        await this.connectionHandler.initialize();
        
        // Register service
        this.eventBus.emit('service:register', { 
            name: 'connectionHandler', 
            service: this.connectionHandler 
        });
        
        this.logger.info('Connection Handler module started');
    }

    async stop() {
        this.logger.info('Connection Handler module stopping');
        
        if (this.connectionHandler) {
            // Cleanup connection handler
            await this.connectionHandler.cleanup();
        }
        
        await super.stop();
    }

    getStatus() {
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.connectionHandler?.ready || false,
            services: {
                connectionHandler: !!this.connectionHandler
            }
        };
    }
}

module.exports = ConnectionHandlerModule;