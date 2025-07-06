import { EventEmitter } from 'events';

/**
 * Memory Cleanup Manager
 * Orchestrates automatic cleanup strategies based on memory pressure levels
 * Implements escalating cleanup strategies from gentle to aggressive
 */
export class MemoryCleanupManager extends EventEmitter {
    constructor(services, config, logger) {
        super();
        this.services = services;
        this.config = config;
        this.logger = logger;
        
        // Cleanup strategies configuration
        this.cleanupStrategies = {
            gentle: {
                // Level 1: Gentle cleanup - clear old/expired data
                enabled: true,
                priority: 1,
                description: 'Clear expired cache entries and old data',
                actions: [
                    'clearExpiredCache',
                    'cleanupOldMessages',
                    'pruneEventHistory',
                    'cleanupOldConnections'
                ]
            },
            moderate: {
                // Level 2: Moderate cleanup - reduce cache sizes
                enabled: true,
                priority: 2,
                description: 'Reduce cache sizes and clear non-essential data',
                actions: [
                    'reduceCacheSizes',
                    'clearProcessingQueues',
                    'cleanupBatchState',
                    'pruneImageHealthHistory'
                ]
            },
            aggressive: {
                // Level 3: Aggressive cleanup - clear large data structures
                enabled: true,
                priority: 3,
                description: 'Clear large data structures and reset components',
                actions: [
                    'clearLargeDataStructures',
                    'resetImageHealthChecker',
                    'clearMediaHistory',
                    'pruneUserStats'
                ]
            },
            emergency: {
                // Level 4: Emergency cleanup - shut down non-essential components
                enabled: true,
                priority: 4,
                description: 'Emergency cleanup - disable non-essential components',
                actions: [
                    'disableNonEssentialComponents',
                    'clearAllCaches',
                    'resetAllCounters',
                    'emergencyGC'
                ]
            }
        };
        
        // Component cleanup configurations
        this.componentCleanupConfig = {
            // Message processing cleanup
            messageProcessing: {
                maxProcessedMessages: 50,
                maxMessageHistory: 500,
                maxRecentMentions: 50,
                maxPendingTimeouts: 25
            },
            
            // Event system cleanup
            eventSystem: {
                maxEventHistory: 100,
                maxSubscriberHistory: 50,
                maxErrorHistory: 25
            },
            
            // Image health checker cleanup
            imageHealthChecker: {
                maxBatchSize: 5,
                maxFailureHistory: 50,
                maxRecheckHistory: 25
            },
            
            // Connection tracking cleanup
            connectionTracking: {
                maxReconnectHistory: 10,
                maxConnectionState: 5,
                maxUserDepartures: 100
            },
            
            // Database cleanup
            database: {
                maxCacheSize: 100,
                maxQueryHistory: 50,
                maxConnectionPool: 3
            }
        };
        
        // Cleanup history and statistics
        this.cleanupHistory = [];
        this.cleanupStats = {
            totalCleanups: 0,
            successfulCleanups: 0,
            failedCleanups: 0,
            totalFreedMB: 0,
            lastCleanupTime: null,
            strategyUsage: {
                gentle: 0,
                moderate: 0,
                aggressive: 0,
                emergency: 0
            }
        };
        
        // Registry of cleanup handlers
        this.cleanupHandlers = new Map();
        this.componentRegistry = new Map();
        
        // Initialize cleanup handlers
        this.initializeCleanupHandlers();
    }
    
    /**
     * Initialize cleanup handlers for different actions
     */
    initializeCleanupHandlers() {
        // Level 1: Gentle cleanup handlers
        this.cleanupHandlers.set('clearExpiredCache', this.clearExpiredCache.bind(this));
        this.cleanupHandlers.set('cleanupOldMessages', this.cleanupOldMessages.bind(this));
        this.cleanupHandlers.set('pruneEventHistory', this.pruneEventHistory.bind(this));
        this.cleanupHandlers.set('cleanupOldConnections', this.cleanupOldConnections.bind(this));
        
        // Level 2: Moderate cleanup handlers
        this.cleanupHandlers.set('reduceCacheSizes', this.reduceCacheSizes.bind(this));
        this.cleanupHandlers.set('clearProcessingQueues', this.clearProcessingQueues.bind(this));
        this.cleanupHandlers.set('cleanupBatchState', this.cleanupBatchState.bind(this));
        this.cleanupHandlers.set('pruneImageHealthHistory', this.pruneImageHealthHistory.bind(this));
        
        // Level 3: Aggressive cleanup handlers
        this.cleanupHandlers.set('clearLargeDataStructures', this.clearLargeDataStructures.bind(this));
        this.cleanupHandlers.set('resetImageHealthChecker', this.resetImageHealthChecker.bind(this));
        this.cleanupHandlers.set('clearMediaHistory', this.clearMediaHistory.bind(this));
        this.cleanupHandlers.set('pruneUserStats', this.pruneUserStats.bind(this));
        
        // Level 4: Emergency cleanup handlers
        this.cleanupHandlers.set('disableNonEssentialComponents', this.disableNonEssentialComponents.bind(this));
        this.cleanupHandlers.set('clearAllCaches', this.clearAllCaches.bind(this));
        this.cleanupHandlers.set('resetAllCounters', this.resetAllCounters.bind(this));
        this.cleanupHandlers.set('emergencyGC', this.emergencyGC.bind(this));
    }
    
    /**
     * Register a component for cleanup management
     */
    registerComponent(name, component) {
        this.componentRegistry.set(name, component);
        this.logger.debug(`Registered component for cleanup: ${name}`);
    }
    
    /**
     * Unregister a component from cleanup management
     */
    unregisterComponent(name) {
        this.componentRegistry.delete(name);
        this.logger.debug(`Unregistered component from cleanup: ${name}`);
    }
    
    /**
     * Execute cleanup strategy based on memory pressure level
     */
    async executeCleanup(pressureLevel, memoryData) {
        const strategy = this.cleanupStrategies[pressureLevel];
        
        if (!strategy || !strategy.enabled) {
            this.logger.warn(`Cleanup strategy not available for pressure level: ${pressureLevel}`);
            return { success: false, reason: 'strategy_not_available' };
        }
        
        const startTime = Date.now();
        const memoryBefore = process.memoryUsage();
        
        this.logger.debug(`Starting ${pressureLevel} cleanup strategy: ${strategy.description}`);
        
        const results = {
            strategy: pressureLevel,
            startTime,
            success: true,
            actions: [],
            errors: [],
            memoryBefore,
            memoryAfter: null,
            memoryFreed: 0,
            duration: 0
        };
        
        try {
            // Execute cleanup actions in order
            for (const actionName of strategy.actions) {
                const handler = this.cleanupHandlers.get(actionName);
                
                if (!handler) {
                    this.logger.warn(`Cleanup handler not found: ${actionName}`);
                    results.errors.push(`Handler not found: ${actionName}`);
                    continue;
                }
                
                try {
                    const actionResult = await handler(memoryData);
                    results.actions.push({
                        name: actionName,
                        success: true,
                        result: actionResult
                    });
                    
                    this.logger.debug(`Cleanup action completed: ${actionName}`, actionResult);
                } catch (error) {
                    this.logger.error(`Cleanup action failed: ${actionName}`, {
                        error: error.message,
                        stack: error.stack
                    });
                    results.errors.push(`${actionName}: ${error.message}`);
                    results.actions.push({
                        name: actionName,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            // Force garbage collection if available
            if (global.gc && (pressureLevel === 'aggressive' || pressureLevel === 'emergency')) {
                this.logger.debug('Forcing garbage collection');
                global.gc();
            }
            
            // Calculate memory freed
            const memoryAfter = process.memoryUsage();
            const memoryFreed = memoryBefore.heapUsed - memoryAfter.heapUsed;
            
            results.memoryAfter = memoryAfter;
            results.memoryFreed = memoryFreed;
            results.duration = Date.now() - startTime;
            
            // Update statistics
            this.cleanupStats.totalCleanups++;
            this.cleanupStats.successfulCleanups++;
            this.cleanupStats.totalFreedMB += Math.round(memoryFreed / 1024 / 1024);
            this.cleanupStats.lastCleanupTime = Date.now();
            this.cleanupStats.strategyUsage[pressureLevel]++;
            
            this.logger.info(`Cleanup completed successfully: ${pressureLevel}`, {
                duration: results.duration,
                memoryFreedMB: Math.round(memoryFreed / 1024 / 1024),
                actionsExecuted: results.actions.length,
                errors: results.errors.length
            });
            
            this.emit('cleanup:completed', results);
            
        } catch (error) {
            results.success = false;
            results.duration = Date.now() - startTime;
            results.errors.push(`Strategy execution failed: ${error.message}`);
            
            this.cleanupStats.failedCleanups++;
            
            this.logger.error(`Cleanup strategy failed: ${pressureLevel}`, {
                error: error.message,
                stack: error.stack,
                duration: results.duration
            });
            
            this.emit('cleanup:failed', results);
        }
        
        // Add to history
        this.cleanupHistory.push(results);
        if (this.cleanupHistory.length > 100) {
            this.cleanupHistory.shift();
        }
        
        return results;
    }
    
    // ==================================================
    // LEVEL 1: GENTLE CLEANUP HANDLERS
    // ==================================================
    
    /**
     * Clear expired cache entries
     */
    async clearExpiredCache(memoryData) {
        let totalCleared = 0;
        
        try {
            // Clear expired bot messages
            const memoryService = this.services.get('memoryManagement');
            if (memoryService) {
                const botMessagesCleared = await memoryService.cleanupBotMessageCache();
                totalCleared += botMessagesCleared;
            }
            
            // Clear expired cooldowns
            const cooldownService = this.services.get('cooldown');
            if (cooldownService) {
                const cooldownsCleared = await cooldownService.clearExpiredCooldowns();
                totalCleared += cooldownsCleared;
            }
            
            return { cleared: totalCleared, type: 'expired_cache' };
        } catch (error) {
            this.logger.error('Error clearing expired cache', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    /**
     * Clean up old messages
     */
    async cleanupOldMessages(memoryData) {
        let totalCleared = 0;
        
        try {
            // Clean message processing history
            const messageProcessor = this.componentRegistry.get('messageProcessor');
            if (messageProcessor && messageProcessor.processedMessages) {
                const maxSize = this.componentCleanupConfig.messageProcessing.maxProcessedMessages;
                const currentSize = messageProcessor.processedMessages.size;
                
                if (currentSize > maxSize) {
                    const toDelete = currentSize - maxSize;
                    const keys = Array.from(messageProcessor.processedMessages.keys());
                    
                    for (let i = 0; i < toDelete; i++) {
                        messageProcessor.processedMessages.delete(keys[i]);
                        totalCleared++;
                    }
                }
            }
            
            // Clean message history
            const messageHistory = this.componentRegistry.get('messageHistory');
            if (messageHistory && Array.isArray(messageHistory)) {
                const maxSize = this.componentCleanupConfig.messageProcessing.maxMessageHistory;
                if (messageHistory.length > maxSize) {
                    const toDelete = messageHistory.length - maxSize;
                    messageHistory.splice(0, toDelete);
                    totalCleared += toDelete;
                }
            }
            
            return { cleared: totalCleared, type: 'old_messages' };
        } catch (error) {
            this.logger.error('Error cleaning old messages', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    /**
     * Prune event history
     */
    async pruneEventHistory(memoryData) {
        let totalCleared = 0;
        
        try {
            // Clean EventBus history
            const eventBus = this.componentRegistry.get('eventBus');
            if (eventBus && eventBus.eventHistory) {
                const maxSize = this.componentCleanupConfig.eventSystem.maxEventHistory;
                const currentSize = eventBus.eventHistory.length;
                
                if (currentSize > maxSize) {
                    const toDelete = currentSize - maxSize;
                    eventBus.eventHistory.splice(0, toDelete);
                    totalCleared += toDelete;
                }
            }
            
            return { cleared: totalCleared, type: 'event_history' };
        } catch (error) {
            this.logger.error('Error pruning event history', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    /**
     * Clean up old connections
     */
    async cleanupOldConnections(memoryData) {
        let totalCleared = 0;
        
        try {
            // Clean connection tracking data
            const connectionHandler = this.componentRegistry.get('connectionHandler');
            if (connectionHandler) {
                // Clean old reconnect history
                if (connectionHandler.reconnectHistory) {
                    const maxSize = this.componentCleanupConfig.connectionTracking.maxReconnectHistory;
                    const currentSize = connectionHandler.reconnectHistory.length;
                    
                    if (currentSize > maxSize) {
                        const toDelete = currentSize - maxSize;
                        connectionHandler.reconnectHistory.splice(0, toDelete);
                        totalCleared += toDelete;
                    }
                }
                
                // Clean user departure times
                if (connectionHandler.userDepartureTimes) {
                    const maxSize = this.componentCleanupConfig.connectionTracking.maxUserDepartures;
                    const currentSize = connectionHandler.userDepartureTimes.size;
                    
                    if (currentSize > maxSize) {
                        const toDelete = currentSize - maxSize;
                        const keys = Array.from(connectionHandler.userDepartureTimes.keys());
                        
                        for (let i = 0; i < toDelete; i++) {
                            connectionHandler.userDepartureTimes.delete(keys[i]);
                            totalCleared++;
                        }
                    }
                }
            }
            
            return { cleared: totalCleared, type: 'old_connections' };
        } catch (error) {
            this.logger.error('Error cleaning old connections', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    // ==================================================
    // LEVEL 2: MODERATE CLEANUP HANDLERS
    // ==================================================
    
    /**
     * Reduce cache sizes
     */
    async reduceCacheSizes(memoryData) {
        let totalCleared = 0;
        
        try {
            // Reduce all registered cache sizes by 50%
            for (const [name, component] of this.componentRegistry) {
                if (component && typeof component === 'object') {
                    // Handle Maps
                    if (component instanceof Map) {
                        const currentSize = component.size;
                        const targetSize = Math.floor(currentSize / 2);
                        const toDelete = currentSize - targetSize;
                        
                        if (toDelete > 0) {
                            const keys = Array.from(component.keys());
                            for (let i = 0; i < toDelete; i++) {
                                component.delete(keys[i]);
                                totalCleared++;
                            }
                        }
                    }
                    
                    // Handle Arrays
                    else if (Array.isArray(component)) {
                        const currentSize = component.length;
                        const targetSize = Math.floor(currentSize / 2);
                        const toDelete = currentSize - targetSize;
                        
                        if (toDelete > 0) {
                            component.splice(0, toDelete);
                            totalCleared += toDelete;
                        }
                    }
                }
            }
            
            return { cleared: totalCleared, type: 'cache_reduction' };
        } catch (error) {
            this.logger.error('Error reducing cache sizes', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    /**
     * Clear processing queues
     */
    async clearProcessingQueues(memoryData) {
        let totalCleared = 0;
        
        try {
            // Clear batch processing queues
            const batchScheduler = this.componentRegistry.get('batchScheduler');
            if (batchScheduler && batchScheduler.pendingJobs) {
                const cleared = batchScheduler.pendingJobs.length;
                batchScheduler.pendingJobs.length = 0;
                totalCleared += cleared;
            }
            
            // Clear processing queues in services
            const services = ['messageProcessor', 'imageHealthChecker', 'mediaTracker'];
            for (const serviceName of services) {
                const service = this.services.get(serviceName);
                if (service && service.processingQueue) {
                    const cleared = service.processingQueue.length;
                    service.processingQueue.length = 0;
                    totalCleared += cleared;
                }
            }
            
            return { cleared: totalCleared, type: 'processing_queues' };
        } catch (error) {
            this.logger.error('Error clearing processing queues', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    /**
     * Clean up batch state
     */
    async cleanupBatchState(memoryData) {
        let totalCleared = 0;
        
        try {
            // Clear batch processing state
            const batchScheduler = this.componentRegistry.get('batchScheduler');
            if (batchScheduler) {
                // Clear completed job history
                if (batchScheduler.completedJobs) {
                    totalCleared += batchScheduler.completedJobs.length;
                    batchScheduler.completedJobs.length = 0;
                }
                
                // Clear failed job history
                if (batchScheduler.failedJobs) {
                    totalCleared += batchScheduler.failedJobs.length;
                    batchScheduler.failedJobs.length = 0;
                }
            }
            
            return { cleared: totalCleared, type: 'batch_state' };
        } catch (error) {
            this.logger.error('Error cleaning batch state', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    /**
     * Prune image health history
     */
    async pruneImageHealthHistory(memoryData) {
        let totalCleared = 0;
        
        try {
            const imageHealthService = this.services.get('imageHealthChecker');
            if (imageHealthService) {
                // Clear failure history
                if (imageHealthService.failureHistory) {
                    const maxSize = this.componentCleanupConfig.imageHealthChecker.maxFailureHistory;
                    const currentSize = imageHealthService.failureHistory.length;
                    
                    if (currentSize > maxSize) {
                        const toDelete = currentSize - maxSize;
                        imageHealthService.failureHistory.splice(0, toDelete);
                        totalCleared += toDelete;
                    }
                }
                
                // Clear recheck history
                if (imageHealthService.recheckHistory) {
                    const maxSize = this.componentCleanupConfig.imageHealthChecker.maxRecheckHistory;
                    const currentSize = imageHealthService.recheckHistory.length;
                    
                    if (currentSize > maxSize) {
                        const toDelete = currentSize - maxSize;
                        imageHealthService.recheckHistory.splice(0, toDelete);
                        totalCleared += toDelete;
                    }
                }
            }
            
            return { cleared: totalCleared, type: 'image_health_history' };
        } catch (error) {
            this.logger.error('Error pruning image health history', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    // ==================================================
    // LEVEL 3: AGGRESSIVE CLEANUP HANDLERS
    // ==================================================
    
    /**
     * Clear large data structures
     */
    async clearLargeDataStructures(memoryData) {
        let totalCleared = 0;
        
        try {
            // Clear large Maps and Arrays
            for (const [name, component] of this.componentRegistry) {
                if (component instanceof Map && component.size > 1000) {
                    totalCleared += component.size;
                    component.clear();
                    this.logger.info(`Cleared large Map: ${name} (${component.size} entries)`);
                } else if (Array.isArray(component) && component.length > 1000) {
                    totalCleared += component.length;
                    component.length = 0;
                    this.logger.info(`Cleared large Array: ${name} (${component.length} entries)`);
                }
            }
            
            return { cleared: totalCleared, type: 'large_data_structures' };
        } catch (error) {
            this.logger.error('Error clearing large data structures', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    /**
     * Reset image health checker
     */
    async resetImageHealthChecker(memoryData) {
        let totalCleared = 0;
        
        try {
            const imageHealthService = this.services.get('imageHealthChecker');
            if (imageHealthService) {
                // Reset batch processing
                if (imageHealthService.currentBatch) {
                    totalCleared += imageHealthService.currentBatch.length;
                    imageHealthService.currentBatch.length = 0;
                }
                
                // Reset processing state
                if (imageHealthService.processingState) {
                    imageHealthService.processingState.clear();
                    totalCleared += 1;
                }
                
                // Reset batch size temporarily
                imageHealthService.batchSize = this.componentCleanupConfig.imageHealthChecker.maxBatchSize;
                
                this.logger.info('Image health checker reset for memory cleanup');
            }
            
            return { cleared: totalCleared, type: 'image_health_reset' };
        } catch (error) {
            this.logger.error('Error resetting image health checker', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    /**
     * Clear media history
     */
    async clearMediaHistory(memoryData) {
        let totalCleared = 0;
        
        try {
            const mediaService = this.services.get('mediaTracker');
            if (mediaService) {
                // Clear media history
                if (mediaService.mediaHistory) {
                    totalCleared += mediaService.mediaHistory.length;
                    mediaService.mediaHistory.length = 0;
                }
                
                // Clear play history
                if (mediaService.playHistory) {
                    totalCleared += mediaService.playHistory.length;
                    mediaService.playHistory.length = 0;
                }
            }
            
            return { cleared: totalCleared, type: 'media_history' };
        } catch (error) {
            this.logger.error('Error clearing media history', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    /**
     * Prune user stats
     */
    async pruneUserStats(memoryData) {
        let totalCleared = 0;
        
        try {
            // Clear user statistics caches
            const userService = this.services.get('userManagement');
            if (userService) {
                // Clear user cache
                if (userService.userCache) {
                    totalCleared += userService.userCache.size;
                    userService.userCache.clear();
                }
                
                // Clear stats cache
                if (userService.statsCache) {
                    totalCleared += userService.statsCache.size;
                    userService.statsCache.clear();
                }
            }
            
            return { cleared: totalCleared, type: 'user_stats' };
        } catch (error) {
            this.logger.error('Error pruning user stats', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    // ==================================================
    // LEVEL 4: EMERGENCY CLEANUP HANDLERS
    // ==================================================
    
    /**
     * Disable non-essential components
     */
    async disableNonEssentialComponents(memoryData) {
        let totalDisabled = 0;
        
        try {
            // List of non-essential components that can be temporarily disabled
            const nonEssentialComponents = [
                'imageHealthChecker',
                'mediaTracker',
                'galleryUpdater',
                'batchScheduler'
            ];
            
            for (const componentName of nonEssentialComponents) {
                const component = this.services.get(componentName);
                if (component && component.enabled !== false) {
                    // Temporarily disable the component
                    if (typeof component.pause === 'function') {
                        await component.pause();
                    } else if (typeof component.stop === 'function') {
                        await component.stop();
                    }
                    
                    component.enabled = false;
                    totalDisabled++;
                    
                    this.logger.warn(`Temporarily disabled component for memory cleanup: ${componentName}`);
                }
            }
            
            return { disabled: totalDisabled, type: 'component_disable' };
        } catch (error) {
            this.logger.error('Error disabling non-essential components', { error: error.message });
            return { disabled: totalDisabled, error: error.message };
        }
    }
    
    /**
     * Clear all caches
     */
    async clearAllCaches(memoryData) {
        let totalCleared = 0;
        
        try {
            // Clear all registered caches
            for (const [name, component] of this.componentRegistry) {
                if (component instanceof Map) {
                    totalCleared += component.size;
                    component.clear();
                } else if (Array.isArray(component)) {
                    totalCleared += component.length;
                    component.length = 0;
                } else if (component instanceof Set) {
                    totalCleared += component.size;
                    component.clear();
                }
            }
            
            // Clear service caches
            for (const [serviceName, service] of this.services) {
                if (service && typeof service.clearCache === 'function') {
                    const cleared = await service.clearCache();
                    totalCleared += cleared;
                }
            }
            
            return { cleared: totalCleared, type: 'all_caches' };
        } catch (error) {
            this.logger.error('Error clearing all caches', { error: error.message });
            return { cleared: totalCleared, error: error.message };
        }
    }
    
    /**
     * Reset all counters
     */
    async resetAllCounters(memoryData) {
        let totalReset = 0;
        
        try {
            // Reset counters in all services
            for (const [serviceName, service] of this.services) {
                if (service && typeof service.resetCounters === 'function') {
                    await service.resetCounters();
                    totalReset++;
                }
            }
            
            return { reset: totalReset, type: 'counter_reset' };
        } catch (error) {
            this.logger.error('Error resetting counters', { error: error.message });
            return { reset: totalReset, error: error.message };
        }
    }
    
    /**
     * Emergency garbage collection
     */
    async emergencyGC(memoryData) {
        try {
            if (!global.gc) {
                return { success: false, reason: 'GC not available' };
            }
            
            const before = process.memoryUsage();
            
            // Force multiple GC cycles
            for (let i = 0; i < 3; i++) {
                global.gc();
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const after = process.memoryUsage();
            const freed = before.heapUsed - after.heapUsed;
            
            return {
                success: true,
                freedMB: Math.round(freed / 1024 / 1024),
                cycles: 3,
                type: 'emergency_gc'
            };
        } catch (error) {
            this.logger.error('Error in emergency GC', { error: error.message });
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get cleanup statistics
     */
    getCleanupStats() {
        return {
            ...this.cleanupStats,
            recentCleanups: this.cleanupHistory.slice(-10),
            availableStrategies: Object.keys(this.cleanupStrategies),
            registeredComponents: this.componentRegistry.size,
            availableHandlers: this.cleanupHandlers.size
        };
    }
    
    /**
     * Get cleanup configuration
     */
    getCleanupConfig() {
        return {
            strategies: this.cleanupStrategies,
            componentConfig: this.componentCleanupConfig,
            registeredComponents: Array.from(this.componentRegistry.keys()),
            availableHandlers: Array.from(this.cleanupHandlers.keys())
        };
    }
}

export default MemoryCleanupManager;