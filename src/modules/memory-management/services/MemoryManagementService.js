import { EventEmitter } from 'events';
import { MemoryManager } from '../../../utils/memoryManager.js';
import { MemoryMonitor } from '../../../utils/MemoryMonitor.js';
import { MemoryManager as CoreMemoryManager } from '../../../core/MemoryManager.js';

/**
 * Memory Management Service
 * Consolidates all memory monitoring, cache management, and bot message tracking functionality
 * Extracted from bot.js to provide modular memory management
 */
class MemoryManagementService extends EventEmitter {
    constructor(services, config, logger) {
        super();
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.ready = false;
        
        // Memory management components
        this.memoryManager = null;
        this.memoryMonitor = null;
        this.coreMemoryManager = null;
        
        // Bot message tracking
        this.recentBotMessages = new Map();
        this.MESSAGE_CACHE_DURATION = this.config.botMessageTracking?.cacheDuration || 30000; // 30 seconds
        
        // Cache management intervals
        this.botMessageCleanupInterval = null;
        this.cacheCleanupInterval = null;
        
        // Data structures for monitoring (will be injected)
        this.dataStructures = new Map();
    }

    /**
     * Initialize the memory management service
     */
    async initialize() {
        try {
            // Initialize legacy memory manager
            this.memoryManager = new MemoryManager();
            
            // Initialize core memory manager with enhanced features
            this.coreMemoryManager = new CoreMemoryManager(
                this.services,
                this.config,
                this.logger
            );
            
            // Initialize the core memory manager
            await this.coreMemoryManager.initialize();
            
            // Initialize legacy memory monitor for backward compatibility
            this.memoryMonitor = new MemoryMonitor({
                warningThreshold: this.config.memory?.thresholds?.warning || 0.85,
                criticalThreshold: this.config.memory?.thresholds?.critical || 0.95,
                checkInterval: this.config.memory?.monitoring?.checkInterval || 60000,
                historySize: this.config.memory?.monitoring?.historySize || 60,
                warningCooldown: this.config.memory?.alerts?.cooldown || 300000,
                leakDetectionWindow: this.config.memory?.monitoring?.leakDetectionWindow || 10,
                leakGrowthThreshold: this.config.memory?.monitoring?.leakGrowthThreshold || 0.05
            });
            
            // Setup memory monitor event handlers (legacy)
            this.setupMemoryMonitorHandlers();
            
            // Setup core memory manager event handlers
            this.setupCoreMemoryHandlers();
            
            // Start legacy memory monitoring for backward compatibility
            this.memoryMonitor.start();
            this.logger.debug('Legacy memory monitor started for backward compatibility');
            
            // Start periodic cleanup tasks
            this.startCleanupTasks();
            
            this.ready = true;
            this.logger.info('Memory Management Service initialized successfully with enhanced pressure monitoring');
            
        } catch (error) {
            this.logger.error('Failed to initialize Memory Management Service', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Setup memory monitor event handlers
     */
    setupMemoryMonitorHandlers() {
        // Handle memory warnings
        this.memoryMonitor.on('warning', (data) => {
            this.logger.warn(`Memory Warning: ${data.heapPercent}% heap usage (${data.heapUsedMB}MB/${data.heapLimitMB}MB)\n   ${data.suggestion}`, data);
            this.emit('memory:warning', data);
        });
        
        // Handle critical memory situations
        this.memoryMonitor.on('critical', (data) => {
            this.logger.error(`Critical Memory: ${data.heapPercent}% heap usage (${data.heapUsedMB}MB/${data.heapLimitMB}MB)\n   ${data.suggestion}`, data);
            this.emit('memory:critical', data);
            
            // Force GC in critical situations
            if (global.gc) {
                this.logger.debug('Forcing garbage collection due to critical memory');
                this.memoryMonitor.forceGC();
            }
            
            // Clear non-essential caches
            this.clearNonEssentialCaches();
        });
        
        // Handle memory leak detection
        this.memoryMonitor.on('leak-detected', (data) => {
            this.logger.error(`Memory Leak Detected: ${data.suggestion}\n   Average growth: ${data.avgGrowthPercent}% per sample\n   Total increase: ${data.totalIncreaseMB}MB over ${data.windowSizeMinutes} minutes`, data);
            this.emit('memory:leak-detected', data);
        });
        
        // Log when GC is forced
        this.memoryMonitor.on('gc-forced', (data) => {
            this.logger.debug('Garbage collection forced', data);
            this.emit('memory:gc-forced', data);
        });
    }
    
    /**
     * Setup core memory manager event handlers
     */
    setupCoreMemoryHandlers() {
        // Handle memory pressure events
        this.coreMemoryManager.on('memory:pressure:warning', (data) => {
            this.logger.warn('Memory pressure warning (enhanced)', data);
            this.emit('memory:pressure:warning', data);
        });
        
        this.coreMemoryManager.on('memory:pressure:critical', (data) => {
            this.logger.error('Memory pressure critical (enhanced)', data);
            this.emit('memory:pressure:critical', data);
        });
        
        this.coreMemoryManager.on('memory:pressure:emergency', (data) => {
            this.logger.error('Memory pressure emergency (enhanced)', data);
            this.emit('memory:pressure:emergency', data);
        });
        
        // Handle memory leak detection
        this.coreMemoryManager.on('memory:leak-detected', (data) => {
            this.logger.error('Memory leak detected (enhanced)', data);
            this.emit('memory:leak-detected', data);
        });
        
        // Handle cleanup events
        this.coreMemoryManager.on('memory:cleanup-completed', (data) => {
            this.logger.debug('Memory cleanup completed (enhanced)', data);
            this.emit('memory:cleanup-completed', data);
        });
        
        this.coreMemoryManager.on('memory:cleanup-failed', (data) => {
            this.logger.error('Memory cleanup failed (enhanced)', data);
            this.emit('memory:cleanup-failed', data);
        });
        
        // Handle emergency events
        this.coreMemoryManager.on('memory:emergency-shutdown-considered', (data) => {
            this.logger.error('Emergency shutdown considered (enhanced)', data);
            this.emit('memory:emergency-shutdown-considered', data);
        });
        
        this.coreMemoryManager.on('memory:emergency-shutdown-executed', (data) => {
            this.logger.error('Emergency shutdown executed (enhanced)', data);
            this.emit('memory:emergency-shutdown-executed', data);
        });
        
        this.coreMemoryManager.on('memory:components-restarted', (data) => {
            this.logger.debug('Components restarted after emergency (enhanced)', data);
            this.emit('memory:components-restarted', data);
        });
    }

    /**
     * Start periodic cleanup tasks
     */
    startCleanupTasks() {
        // Clean up bot message cache periodically
        this.botMessageCleanupInterval = setInterval(() => {
            this.cleanupBotMessageCache();
        }, this.config.botMessageTracking?.cleanupInterval || 60000);
        
        // General cache cleanup
        this.cacheCleanupInterval = setInterval(() => {
            this.clearNonEssentialCaches();
        }, this.config.cache?.cleanupInterval || 300000); // Every 5 minutes
        
        this.logger.debug('Cleanup tasks started');
    }

    /**
     * Register a data structure for monitoring
     * @param {string} name - Name of the data structure
     * @param {*} sizeGetter - Function, Map, Set, Array, or direct value to get size
     */
    registerDataStructure(name, sizeGetter) {
        if (!this.memoryMonitor) {
            this.logger.warn('Cannot register data structure - memory monitor not initialized');
            return;
        }
        
        this.dataStructures.set(name, sizeGetter);
        
        // Register with both legacy and enhanced systems
        this.memoryMonitor.trackDataStructure(name, sizeGetter);
        
        if (this.coreMemoryManager) {
            this.coreMemoryManager.registerComponent(name, sizeGetter);
        }
        
        this.logger.debug(`Registered data structure for monitoring: ${name}`);
    }

    /**
     * Unregister a data structure from monitoring
     * @param {string} name - Name of the data structure
     */
    unregisterDataStructure(name) {
        this.dataStructures.delete(name);
        
        // Unregister from both systems
        if (this.memoryMonitor) {
            this.memoryMonitor.untrackDataStructure(name);
        }
        
        if (this.coreMemoryManager) {
            this.coreMemoryManager.unregisterComponent(name);
        }
        
        this.logger.debug(`Unregistered data structure: ${name}`);
    }

    /**
     * Clear non-essential caches to free memory
     */
    clearNonEssentialCaches() {
        let totalCleared = 0;
        let cachesClearedCount = 0;
        
        try {
            // Clear old bot messages
            const botMessagesCleared = this.cleanupBotMessageCache();
            totalCleared += botMessagesCleared;
            if (botMessagesCleared > 0) cachesClearedCount++;
            
            // Clear other caches if data structures are registered
            for (const [name, sizeGetter] of this.dataStructures) {
                try {
                    const cleared = this.clearDataStructureCache(name, sizeGetter);
                    totalCleared += cleared;
                    if (cleared > 0) cachesClearedCount++;
                } catch (error) {
                    this.logger.warn(`Error clearing cache for ${name}`, {
                        error: error.message
                    });
                }
            }
            
            if (totalCleared > 0) {
                this.logger.info(`Cache cleanup completed: cleared ${totalCleared} items from ${cachesClearedCount} caches`);
                this.emit('cache:cleared', {
                    totalCleared,
                    cachesClearedCount,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            this.logger.error('Error during cache cleanup', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * Clear cache for a specific data structure
     * @param {string} name - Name of the data structure
     * @param {*} sizeGetter - The data structure or size getter
     * @returns {number} Number of items cleared
     */
    clearDataStructureCache(name, sizeGetter) {
        let cleared = 0;
        
        try {
            // Handle different types of data structures
            if (typeof sizeGetter === 'function') {
                // Can't clear function-based size getters
                return 0;
            } else if (sizeGetter instanceof Map) {
                // Clear old entries based on cache configuration
                cleared = this.clearMapCache(name, sizeGetter);
            } else if (sizeGetter instanceof Set) {
                // Clear old entries for Sets
                cleared = this.clearSetCache(name, sizeGetter);
            } else if (Array.isArray(sizeGetter)) {
                // Clear old entries for Arrays
                cleared = this.clearArrayCache(name, sizeGetter);
            }
            
            return cleared;
            
        } catch (error) {
            this.logger.warn(`Error clearing cache for ${name}`, {
                error: error.message
            });
            return 0;
        }
    }

    /**
     * Clear old entries from a Map
     * @param {string} name - Name of the map
     * @param {Map} map - The map to clear
     * @returns {number} Number of items cleared
     */
    clearMapCache(name, map) {
        const maxSize = this.getMaxSizeForCache(name);
        let cleared = 0;
        
        if (map.size > maxSize) {
            const toDelete = map.size - maxSize;
            const iterator = map.keys();
            
            for (let i = 0; i < toDelete; i++) {
                const key = iterator.next().value;
                if (key !== undefined) {
                    map.delete(key);
                    cleared++;
                }
            }
        }
        
        return cleared;
    }

    /**
     * Clear old entries from a Set
     * @param {string} name - Name of the set
     * @param {Set} set - The set to clear
     * @returns {number} Number of items cleared
     */
    clearSetCache(name, set) {
        const maxSize = this.getMaxSizeForCache(name);
        let cleared = 0;
        
        if (set.size > maxSize) {
            const toDelete = set.size - maxSize;
            const iterator = set.values();
            
            for (let i = 0; i < toDelete; i++) {
                const value = iterator.next().value;
                if (value !== undefined) {
                    set.delete(value);
                    cleared++;
                }
            }
        }
        
        return cleared;
    }

    /**
     * Clear old entries from an Array
     * @param {string} name - Name of the array
     * @param {Array} array - The array to clear
     * @returns {number} Number of items cleared
     */
    clearArrayCache(name, array) {
        const maxSize = this.getMaxSizeForCache(name);
        let cleared = 0;
        
        if (array.length > maxSize) {
            const toDelete = array.length - maxSize;
            array.splice(0, toDelete);
            cleared = toDelete;
        }
        
        return cleared;
    }

    /**
     * Get maximum size for a cache based on configuration
     * @param {string} name - Name of the cache
     * @returns {number} Maximum size
     */
    getMaxSizeForCache(name) {
        // Default sizes for different cache types
        const defaults = {
            'processedMessages': this.config.cache?.maxProcessedMessages || 100,
            'lastGreetings': 100,
            'recentMentions': 100,
            'messageHistory': this.config.cache?.historyMaxSize || 1000,
            'pendingMentionTimeouts': 50,
            'userDepartureTimes': 200,
            'recentBotMessages': this.config.botMessageTracking?.maxTrackedMessages || 1000
        };
        
        return defaults[name] || 100; // Default fallback
    }

    /**
     * Generate a hash for a message to track bot's own messages
     * @param {string} message - The message to hash
     * @returns {string} A simple hash of the message
     */
    hashMessage(message) {
        // Normalize the message: lowercase, trim, remove extra spaces
        const normalized = message.toLowerCase().trim().replace(/\s+/g, ' ');
        
        // Create a simple hash using the message content and length
        // This is sufficient for our use case of detecting recent duplicates
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Include length to help differentiate similar messages
        return `${Math.abs(hash)}_${normalized.length}`;
    }

    /**
     * Track a message sent by the bot to prevent self-replies
     * @param {string} message - The message being sent
     */
    trackBotMessage(message) {
        const hash = this.hashMessage(message);
        const now = Date.now();
        
        this.recentBotMessages.set(hash, now);
        
        // Log for debugging
        this.logger.debug('Tracking bot message', {
            hash,
            messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            totalTracked: this.recentBotMessages.size
        });
    }

    /**
     * Check if a message was recently sent by the bot
     * @param {string} message - The message to check
     * @returns {boolean} True if this was a recent bot message
     */
    isRecentBotMessage(message) {
        const hash = this.hashMessage(message);
        const timestamp = this.recentBotMessages.get(hash);
        
        if (!timestamp) {
            return false;
        }
        
        const age = Date.now() - timestamp;
        const isRecent = age <= this.MESSAGE_CACHE_DURATION;
        
        if (isRecent) {
            this.logger.debug('Message identified as recent bot message', {
                hash,
                ageMs: age,
                messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
            });
        }
        
        return isRecent;
    }

    /**
     * Clean up old bot messages from tracking
     * @returns {number} Number of messages cleaned up
     */
    cleanupBotMessageCache() {
        const now = Date.now();
        const expired = [];
        
        for (const [hash, timestamp] of this.recentBotMessages) {
            if (now - timestamp > this.MESSAGE_CACHE_DURATION) {
                expired.push(hash);
            }
        }
        
        for (const hash of expired) {
            this.recentBotMessages.delete(hash);
        }
        
        if (expired.length > 0) {
            this.logger.debug(`Cleaned up ${expired.length} expired bot messages, ${this.recentBotMessages.size} remaining`);
        }
        
        return expired.length;
    }

    /**
     * Get current memory statistics
     * @returns {Object} Memory statistics
     */
    getMemoryStats() {
        const legacyStats = this.memoryMonitor ? this.memoryMonitor.getStats() : null;
        const enhancedStats = this.coreMemoryManager ? this.coreMemoryManager.getMemoryStats() : null;
        
        return {
            legacy: legacyStats,
            enhanced: enhancedStats,
            botMessageTracking: {
                trackedMessages: this.recentBotMessages.size,
                cacheDuration: this.MESSAGE_CACHE_DURATION
            },
            ready: this.ready,
            hasEnhancedMonitoring: !!this.coreMemoryManager
        };
    }

    /**
     * Get memory history for charts
     * @returns {Array} Memory history data
     */
    getMemoryHistory() {
        const legacyHistory = this.memoryMonitor ? this.memoryMonitor.getHistory() : [];
        const enhancedHistory = this.coreMemoryManager ? this.coreMemoryManager.getMemoryHistory() : [];
        
        return {
            legacy: legacyHistory,
            enhanced: enhancedHistory
        };
    }

    /**
     * Force garbage collection
     * @returns {boolean} True if GC was forced, false if not available
     */
    forceGC() {
        let result = { success: false, reason: 'no_gc_available' };
        
        // Try enhanced system first
        if (this.coreMemoryManager) {
            result = this.coreMemoryManager.forceGC();
        }
        // Fallback to legacy system
        else if (this.memoryMonitor) {
            const success = this.memoryMonitor.forceGC();
            result = { success };
        }
        
        return result;
    }

    /**
     * Force emergency cleanup
     */
    async forceCleanup(level = 'moderate') {
        this.logger.info(`Performing ${level} memory cleanup`);
        
        // Use enhanced cleanup if available
        if (this.coreMemoryManager) {
            const result = await this.coreMemoryManager.forceCleanup(level);
            this.logger.info('Enhanced cleanup completed', result);
            return result;
        }
        
        // Fallback to legacy cleanup
        this.clearNonEssentialCaches();
        
        // Force GC if available
        if (global.gc) {
            this.logger.info('Forcing garbage collection');
            this.forceGC();
        }
        
        this.logger.info('Legacy cleanup completed');
        return { success: true, type: 'legacy_cleanup' };
    }

    /**
     * Clear all caches manually
     */
    clearCaches() {
        this.clearNonEssentialCaches();
        this.logger.info('Manual cache clearing completed');
    }

    /**
     * Get service status
     * @returns {Object} Service status
     */
    getStatus() {
        const legacyStatus = {
            running: !!this.memoryMonitor?.monitorInterval,
            samples: this.memoryMonitor?.history?.length || 0
        };
        
        const enhancedStatus = this.coreMemoryManager ? this.coreMemoryManager.getMemoryStats() : null;
        
        return {
            ready: this.ready,
            memoryMonitor: {
                legacy: legacyStatus,
                enhanced: enhancedStatus
            },
            botMessageTracking: {
                trackedMessages: this.recentBotMessages.size,
                cacheDuration: this.MESSAGE_CACHE_DURATION
            },
            dataStructures: {
                registered: this.dataStructures.size,
                names: Array.from(this.dataStructures.keys())
            },
            cleanup: {
                botMessageCleanup: !!this.botMessageCleanupInterval,
                cacheCleanup: !!this.cacheCleanupInterval
            },
            hasEnhancedMonitoring: !!this.coreMemoryManager
        };
    }

    /**
     * Cleanup service resources
     */
    async cleanup() {
        this.logger.info('Memory Management Service cleanup started');
        
        // Clear intervals
        if (this.botMessageCleanupInterval) {
            clearInterval(this.botMessageCleanupInterval);
            this.botMessageCleanupInterval = null;
        }
        
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
            this.cacheCleanupInterval = null;
        }
        
        // Stop enhanced memory manager
        if (this.coreMemoryManager) {
            await this.coreMemoryManager.shutdown();
        }
        
        // Stop legacy memory monitor
        if (this.memoryMonitor) {
            this.memoryMonitor.stop();
        }
        
        // Clear tracking data
        this.recentBotMessages.clear();
        this.dataStructures.clear();
        
        this.ready = false;
        this.logger.info('Memory Management Service cleanup completed');
    }
}

export default MemoryManagementService;