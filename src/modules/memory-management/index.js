import BaseModule from '../../core/BaseModule.js';
import MemoryManagementService from './services/MemoryManagementService.js';

/**
 * Memory Management Module
 * Handles comprehensive memory monitoring, cache management, and bot message tracking
 * Extracted from bot.js to provide modular memory management functionality
 */
class MemoryManagementModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'memory-management';
        this.dependencies = [];
        this.optionalDependencies = [];
        this.memoryManagementService = null;
        
        // Data structures that will be registered for monitoring
        this.registeredDataStructures = new Map();
    }

    async init() {
        await super.init();
        
        // Create MemoryManagementService
        this.memoryManagementService = new MemoryManagementService(
            this._context.services,
            this.config,
            this.logger
        );
        
        this.logger.info('Memory Management module initialized');
    }

    async start() {
        await super.start();
        
        // Initialize the memory management service
        await this.memoryManagementService.initialize();
        
        // Register service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'memoryManagement', 
            service: {
                // Memory monitoring interface
                getMemoryStats: this.memoryManagementService.getMemoryStats.bind(this.memoryManagementService),
                getMemoryHistory: this.memoryManagementService.getMemoryHistory.bind(this.memoryManagementService),
                forceGC: this.memoryManagementService.forceGC.bind(this.memoryManagementService),
                
                // Cache management interface
                clearCaches: this.memoryManagementService.clearCaches.bind(this.memoryManagementService),
                forceCleanup: this.memoryManagementService.forceCleanup.bind(this.memoryManagementService),
                
                // Bot message tracking interface
                trackBotMessage: this.memoryManagementService.trackBotMessage.bind(this.memoryManagementService),
                isRecentBotMessage: this.memoryManagementService.isRecentBotMessage.bind(this.memoryManagementService),
                hashMessage: this.memoryManagementService.hashMessage.bind(this.memoryManagementService),
                
                // Data structure registration interface
                registerDataStructures: this.registerDataStructures.bind(this),
                unregisterDataStructure: this.unregisterDataStructure.bind(this),
                
                // Status interface
                getStatus: this.getStatus.bind(this)
            }
        });
        
        // Forward memory events to the event bus
        this.memoryManagementService.on('memory:warning', (data) => {
            this.emit('memory:warning', data);
        });
        
        this.memoryManagementService.on('memory:critical', (data) => {
            this.emit('memory:critical', data);
        });
        
        this.memoryManagementService.on('memory:leak-detected', (data) => {
            this.emit('memory:leak-detected', data);
        });
        
        this.memoryManagementService.on('memory:gc-forced', (data) => {
            this.emit('memory:gc-forced', data);
        });
        
        this.memoryManagementService.on('cache:cleared', (data) => {
            this.emit('cache:cleared', data);
        });
        
        // Subscribe to bot lifecycle events
        this.subscribe('bot:ready', this.handleBotReady.bind(this));
        this.subscribe('bot:stop', this.handleBotStop.bind(this));
        
        this.logger.info('Memory Management module started');
    }

    async stop() {
        this.logger.info('Memory Management module stopping');
        
        if (this.memoryManagementService) {
            await this.memoryManagementService.cleanup();
        }
        
        await super.stop();
    }

    /**
     * Handle bot ready event - register known data structures
     * @param {Object} data - Bot ready event data
     */
    async handleBotReady(data) {
        try {
            // Register any data structures that were added before the service was ready
            if (this.registeredDataStructures.size > 0) {
                this.logger.info(`Registering ${this.registeredDataStructures.size} data structures with memory monitor`);
                
                for (const [name, sizeGetter] of this.registeredDataStructures) {
                    this.memoryManagementService.registerDataStructure(name, sizeGetter);
                }
            }
            
            this.emit('memory:ready', { 
                registeredStructures: this.registeredDataStructures.size 
            });
        } catch (error) {
            this.logger.error('Error handling bot ready for memory management', {
                error: error.message
            });
        }
    }

    /**
     * Handle bot stop event - perform cleanup
     * @param {Object} data - Bot stop event data
     */
    async handleBotStop(data) {
        try {
            // Perform final cleanup
            await this.memoryManagementService.forceCleanup();
            
            this.emit('memory:stopped', { 
                reason: data?.reason || 'normal_shutdown' 
            });
        } catch (error) {
            this.logger.error('Error handling bot stop for memory management', {
                error: error.message
            });
        }
    }

    /**
     * Register data structures for monitoring
     * @param {Object} structures - Map of name -> sizeGetter pairs
     */
    registerDataStructures(structures) {
        if (!structures || typeof structures !== 'object') {
            this.logger.warn('Invalid data structures provided for registration');
            return;
        }
        
        for (const [name, sizeGetter] of Object.entries(structures)) {
            this.registeredDataStructures.set(name, sizeGetter);
            
            // Register immediately if service is ready
            if (this.memoryManagementService?.ready) {
                this.memoryManagementService.registerDataStructure(name, sizeGetter);
            }
        }
        
        this.logger.info(`Registered ${Object.keys(structures).length} data structures for memory monitoring`);
    }

    /**
     * Unregister a data structure from monitoring
     * @param {string} name - Name of the data structure to unregister
     */
    unregisterDataStructure(name) {
        this.registeredDataStructures.delete(name);
        
        if (this.memoryManagementService?.ready) {
            this.memoryManagementService.unregisterDataStructure(name);
        }
        
        this.logger.debug(`Unregistered data structure: ${name}`);
    }

    /**
     * Get module status
     * @returns {Object} - Module status information
     */
    getStatus() {
        const serviceStatus = this.memoryManagementService?.getStatus() || {};
        
        return {
            name: this.name,
            status: this._started ? 'running' : 'stopped',
            ready: this.memoryManagementService?.ready || false,
            services: {
                memoryManagement: !!this.memoryManagementService
            },
            registeredDataStructures: this.registeredDataStructures.size,
            serviceStatus: serviceStatus
        };
    }
}

export default MemoryManagementModule;