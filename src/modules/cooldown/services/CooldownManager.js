import MemoryStore from './MemoryStore.js';
import PersistentStore from './PersistentStore.js';
import KeyGenerator from './KeyGenerator.js';

class CooldownManager {
    constructor(database, logger = null, config = {}) {
        this.db = database;
        this.logger = logger || console;
        this.config = {
            thresholds: {
                memory: 600000,      // < 10 minutes = memory
                persistent: 600000   // >= 10 minutes = database
            },
            cleanup: {
                memoryInterval: 300000,     // 5 minutes
                persistentInterval: 86400000, // 24 hours
                maxAge: 604800000           // 7 days
            },
            storage: {
                memoryLimit: 10000,
                persistentBatchSize: 100
            },
            messages: {
                useCustomMessages: true,
                placeholder: "{time}",
                defaultTemplate: "hold ya horses champion, {time} more seconds"
            },
            ...config
        };

        this.keyGenerator = new KeyGenerator();
        this.memoryStore = null;
        this.persistentStore = null;
        this.initialized = false;
        this.cleanupTimers = new Map();
        this.isShuttingDown = false;
        
        // Bind cleanup for emergency shutdown
        this.boundCleanup = this.cleanup.bind(this);
        process.on('SIGINT', this.boundCleanup);
        process.on('SIGTERM', this.boundCleanup);
        
        // Default cooldown messages (keeping the Australian flavor)
        this.defaultMessages = [
            `fuckin hell mate that command's still coolin down, {time}s left`,
            `slow down speedy, {time} seconds left on the clock`,
            `jesus mate, let me catch me breath - {time}s`,
            `hold ya horses champion, {time} more seconds`,
            `patience of a saint ain't ya? wait {time}s`,
            `chill ya beans for another {time} seconds`,
            `settle down turbo, ya gotta wait {time}s`,
            `cool ya jets speedy gonzales, {time}s to go`,
            `keep ya pants on, {time} seconds left`,
            `fuck me dead give it {time}s will ya`,
            `calm ya tits, {time} more seconds`,
            `ease up on the gas pedal, {time}s remaining`,
            `ya gotta wait {time}s, go have a cone`,
            `{time}s left, perfect time for a quick wank`,
            `hold ya cock for {time} more seconds`,
            `{time}s to go, smoke a dart while ya wait`,
            `bloody hell wait {time}s ya impatient cunt`,
            `{time} seconds mate, I ain't a fuckin machine`,
            `gimme {time}s to recover from that last one`,
            `wait {time}s or I'll tell shazza`,
            `{time}s left, bout as long as I last in bed`,
            `chill for {time}s, I'm not ya personal slave`,
            `{time} seconds left, longer than me attention span`,
            `slow ya roll for {time}s dickhead`,
            `{time}s to go, perfect time to scratch ya balls`
        ];
    }

    /**
     * Initialize the cooldown manager
     */
    async init() {
        if (this.initialized) {
            return;
        }

        try {
            // Initialize memory store
            this.memoryStore = new MemoryStore(
                this.logger, 
                this.config.storage
            );
            this.memoryStore.init();

            // Initialize persistent store
            this.persistentStore = new PersistentStore(
                this.db, 
                this.logger, 
                this.config.storage
            );
            await this.persistentStore.init();

            // Start cleanup timers
            this.startCleanupTimers();

            this.initialized = true;
            this.logger.info('CooldownManager initialized');

        } catch (error) {
            this.logger.error('Failed to initialize CooldownManager:', error);
            throw error;
        }
    }

    /**
     * Check if a cooldown is active
     * @param {string} commandName - The command name
     * @param {string} username - The username
     * @param {number} duration - Cooldown duration in milliseconds
     * @param {object} options - Additional options
     * @returns {object} - { allowed: boolean, remaining?: number, message?: string }
     */
    async check(commandName, username, duration, options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const {
            roomId = 'fatpizza',
            customMessage = null,
            usePersistent = null
        } = options;

        try {
            const key = this.keyGenerator.generate(commandName, username, roomId);
            const store = this.getStore(duration, usePersistent);
            const result = await store.check(key, duration);

            if (!result.allowed && this.config.messages.useCustomMessages) {
                result.message = this.generateCooldownMessage(
                    result.remaining, 
                    customMessage
                );
            }

            return result;

        } catch (error) {
            this.logger.error('Error checking cooldown:', error);
            // Fail open - allow command on error
            return { allowed: true };
        }
    }

    /**
     * Set a cooldown
     * @param {string} commandName - The command name
     * @param {string} username - The username
     * @param {number} duration - Cooldown duration in milliseconds
     * @param {object} options - Additional options
     */
    async set(commandName, username, duration, options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const {
            roomId = 'fatpizza',
            timestamp = null,
            usePersistent = null
        } = options;

        try {
            const key = this.keyGenerator.generate(commandName, username, roomId);
            const store = this.getStore(duration, usePersistent);
            
            await store.set(key, timestamp);
            
            this.logger.debug(`Set cooldown: ${commandName} for ${username} (${duration}ms)`);

        } catch (error) {
            this.logger.error('Error setting cooldown:', error);
            throw error;
        }
    }

    /**
     * Reset a specific cooldown
     * @param {string} commandName - The command name
     * @param {string} username - The username
     * @param {object} options - Additional options
     * @returns {boolean} - True if removed
     */
    async reset(commandName, username, options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const { roomId = 'fatpizza' } = options;

        try {
            const key = this.keyGenerator.generate(commandName, username, roomId);
            
            // Try removing from both stores to be safe
            const memoryResult = this.memoryStore.remove(key);
            const persistentResult = await this.persistentStore.remove(key);
            
            const removed = memoryResult || persistentResult;
            
            if (removed) {
                this.logger.debug(`Reset cooldown: ${commandName} for ${username}`);
            }
            
            return removed;

        } catch (error) {
            this.logger.error('Error resetting cooldown:', error);
            return false;
        }
    }

    /**
     * Get remaining cooldown time
     * @param {string} commandName - The command name
     * @param {string} username - The username
     * @param {number} duration - Cooldown duration in milliseconds
     * @param {object} options - Additional options
     * @returns {number|null} - Remaining time in seconds
     */
    async getRemaining(commandName, username, duration, options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const {
            roomId = 'fatpizza',
            usePersistent = null
        } = options;

        try {
            const key = this.keyGenerator.generate(commandName, username, roomId);
            const store = this.getStore(duration, usePersistent);
            
            return await store.getRemaining(key, duration);

        } catch (error) {
            this.logger.error('Error getting remaining cooldown:', error);
            return null;
        }
    }

    /**
     * Get all cooldowns for a user
     * @param {string} username - The username
     * @param {object} options - Additional options
     * @returns {Array} - Array of user cooldowns
     */
    async getUserCooldowns(username, options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const { roomId = null } = options;

        try {
            const pattern = this.keyGenerator.getUserPattern(username, roomId);
            
            // Get from both stores
            const memoryResults = this.memoryStore.getByPattern(pattern);
            const persistentResults = await this.persistentStore.getByPattern(pattern);
            
            return [...memoryResults, ...persistentResults];

        } catch (error) {
            this.logger.error('Error getting user cooldowns:', error);
            return [];
        }
    }

    /**
     * Get all cooldowns for a command
     * @param {string} commandName - The command name
     * @param {object} options - Additional options
     * @returns {Array} - Array of command cooldowns
     */
    async getCommandCooldowns(commandName, options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const { roomId = null } = options;

        try {
            const pattern = this.keyGenerator.getCommandPattern(commandName, roomId);
            
            // Get from both stores
            const memoryResults = this.memoryStore.getByPattern(pattern);
            const persistentResults = await this.persistentStore.getByPattern(pattern);
            
            return [...memoryResults, ...persistentResults];

        } catch (error) {
            this.logger.error('Error getting command cooldowns:', error);
            return [];
        }
    }

    /**
     * Clean up old cooldowns
     * @param {number} maxAge - Maximum age in milliseconds (optional)
     * @returns {object} - Cleanup results
     */
    async cleanup(maxAge = null) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const memoryCount = this.memoryStore.cleanup(maxAge);
            const persistentCount = await this.persistentStore.cleanup(maxAge);
            
            const result = {
                memory: memoryCount,
                persistent: persistentCount,
                total: memoryCount + persistentCount
            };
            
            if (result.total > 0) {
                this.logger.info(`Cleaned up ${result.total} expired cooldowns`);
            }
            
            return result;

        } catch (error) {
            this.logger.error('Error cleaning up cooldowns:', error);
            return { memory: 0, persistent: 0, total: 0 };
        }
    }

    /**
     * Get cooldown statistics
     * @returns {object} - Combined statistics from both stores
     */
    async getStats() {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const memoryStats = this.memoryStore.getStats();
            const persistentStats = await this.persistentStore.getStats();
            
            return {
                memory: memoryStats,
                persistent: persistentStats,
                config: this.config,
                initialized: this.initialized
            };

        } catch (error) {
            this.logger.error('Error getting cooldown stats:', error);
            return { memory: {}, persistent: {}, config: this.config };
        }
    }

    /**
     * Legacy compatibility: check cooldown with key
     * @param {string} key - Legacy key format (command:username)
     * @param {number} duration - Cooldown duration
     * @returns {object} - Check result
     */
    async checkLegacy(key, duration) {
        try {
            const newKey = this.keyGenerator.migrateLegacyKey(key);
            const store = this.getStore(duration);
            return await store.check(newKey, duration);
        } catch (error) {
            this.logger.error('Error checking legacy cooldown:', error);
            return { allowed: true };
        }
    }

    /**
     * Determine which store to use based on duration
     * @param {number} duration - Cooldown duration in milliseconds
     * @param {boolean} usePersistent - Force persistent storage (optional)
     * @returns {object} - The appropriate store
     */
    getStore(duration, usePersistent = null) {
        if (usePersistent === true) {
            return this.persistentStore;
        }
        
        if (usePersistent === false) {
            return this.memoryStore;
        }
        
        // Auto-determine based on duration
        return duration >= this.config.thresholds.persistent 
            ? this.persistentStore 
            : this.memoryStore;
    }

    /**
     * Generate cooldown message
     * @param {number} remaining - Remaining time in seconds
     * @param {string} customMessage - Custom message template (optional)
     * @returns {string} - Formatted cooldown message
     */
    generateCooldownMessage(remaining, customMessage = null) {
        const template = customMessage || 
            this.defaultMessages[Math.floor(Math.random() * this.defaultMessages.length)];
        
        return template.replace(
            new RegExp(this.config.messages.placeholder, 'g'), 
            remaining
        );
    }

    /**
     * Start cleanup timers
     */
    startCleanupTimers() {
        if (this.isShuttingDown) return;
        
        // Memory cleanup timer
        const memoryTimer = setInterval(() => {
            if (!this.isShuttingDown && this.memoryStore) {
                this.memoryStore.cleanup();
            }
        }, this.config.cleanup.memoryInterval);
        
        this.cleanupTimers.set('memory', memoryTimer);

        // Persistent cleanup timer
        const persistentTimer = setInterval(async () => {
            if (!this.isShuttingDown && this.persistentStore) {
                try {
                    await this.persistentStore.cleanup();
                } catch (error) {
                    this.logger.error('Error in persistent cleanup timer:', error);
                }
            }
        }, this.config.cleanup.persistentInterval);
        
        this.cleanupTimers.set('persistent', persistentTimer);

        this.logger.debug('Cleanup timers started');
    }

    /**
     * Stop cleanup timers
     */
    stopCleanupTimers() {
        for (const [name, timer] of this.cleanupTimers) {
            clearInterval(timer);
            this.logger.debug(`Stopped ${name} cleanup timer`);
        }
        this.cleanupTimers.clear();
    }

    /**
     * Shutdown the cooldown manager
     */
    async shutdown() {
        if (this.isShuttingDown) return; // Prevent duplicate shutdown
        
        this.isShuttingDown = true;
        this.logger.info('CooldownManager shutdown initiated');
        
        this.stopCleanupTimers();

        if (this.memoryStore) {
            this.memoryStore.shutdown();
        }

        if (this.persistentStore) {
            await this.persistentStore.shutdown();
        }

        this.initialized = false;
        
        // Remove process listeners
        process.removeListener('SIGINT', this.boundCleanup);
        process.removeListener('SIGTERM', this.boundCleanup);
        
        this.logger.info('CooldownManager shutdown complete');
    }
    
    /**
     * Emergency cleanup method
     */
    async cleanup() {
        if (this.isShuttingDown) return;
        
        this.logger.info('CooldownManager: Emergency cleanup initiated');
        
        await this.shutdown();
        
        this.logger.info('CooldownManager: Emergency cleanup completed');
    }
    
    /**
     * Get current timer statistics for monitoring
     */
    getTimerStats() {
        return {
            activeCleanupTimers: this.cleanupTimers.size,
            cleanupTimerNames: Array.from(this.cleanupTimers.keys()),
            initialized: this.initialized,
            isShuttingDown: this.isShuttingDown,
            memoryStoreActive: !!this.memoryStore,
            persistentStoreActive: !!this.persistentStore,
            config: {
                memoryInterval: this.config.cleanup.memoryInterval,
                persistentInterval: this.config.cleanup.persistentInterval,
                maxAge: this.config.cleanup.maxAge
            }
        };
    }
    
    /**
     * Check for timer leaks
     */
    detectTimerLeaks() {
        const leaks = [];
        
        // Check for timers without proper tracking
        if (this.cleanupTimers.size > 2) {
            leaks.push({
                type: 'excessive_cleanup_timers',
                count: this.cleanupTimers.size,
                expected: 2
            });
        }
        
        // Check for timers running when not initialized
        if (!this.initialized && this.cleanupTimers.size > 0) {
            leaks.push({
                type: 'timers_without_initialization',
                count: this.cleanupTimers.size
            });
        }
        
        // Check for shutdown state inconsistency
        if (this.isShuttingDown && this.cleanupTimers.size > 0) {
            leaks.push({
                type: 'timers_during_shutdown',
                count: this.cleanupTimers.size
            });
        }
        
        return leaks;
    }
}

export default CooldownManager;