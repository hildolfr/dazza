const BaseModule = require('../../core/BaseModule');
const CooldownManager = require('./services/CooldownManager');

class CooldownModule extends BaseModule {
    constructor(context) {
        super(context);
        this.cooldownManager = null;
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
            ...context.userConfig
        };
    }

    async init() {
        await super.init();
        
        // Debug: Check if database service is available
        this.logger.info('Checking database service availability...', {
            hasDb: !!this.db,
            dbType: typeof this.db
        });
        
        // Wait for database service to be available if needed
        if (!this.db) {
            this.logger.info('Database service not available, waiting...');
            // Wait for database service
            await new Promise(resolve => {
                const checkService = () => {
                    if (this.db) {
                        this.logger.info('Database service is now available');
                        resolve();
                    } else {
                        setTimeout(checkService, 100);
                    }
                };
                checkService();
            });
        }
        
        // Initialize cooldown manager
        this.cooldownManager = new CooldownManager(
            this.db,
            this.logger,
            this.config
        );
        
        await this.cooldownManager.init();
        
        this.logger.info('Cooldown module initialized');
    }

    async start() {
        await super.start();
        
        // Register cooldown service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'cooldown', 
            service: {
                check: this.checkCooldown.bind(this),
                set: this.setCooldown.bind(this),
                reset: this.resetCooldown.bind(this),
                getRemaining: this.getRemaining.bind(this),
                getUserCooldowns: this.getUserCooldowns.bind(this),
                getCommandCooldowns: this.getCommandCooldowns.bind(this),
                cleanup: this.cleanupCooldowns.bind(this),
                getStats: this.getStats.bind(this),
                checkLegacy: this.checkLegacy.bind(this),
                getLegacyInterface: this.getLegacyInterface.bind(this),
                getBotInterface: this.getBotInterface.bind(this),
                migrateFromLegacy: this.migrateFromLegacy.bind(this)
            }
        });
        
        // Provide cooldown services via events (legacy)
        this.eventBus.on('cooldown.check', this.checkCooldown.bind(this));
        this.eventBus.on('cooldown.set', this.setCooldown.bind(this));
        this.eventBus.on('cooldown.reset', this.resetCooldown.bind(this));
        this.eventBus.on('cooldown.cleanup', this.cleanupCooldowns.bind(this));
        
        // Subscribe to bot cleanup events
        this.subscribe('bot.cleanup', this.handleCleanup.bind(this));
        this.subscribe('module.shutdown', this.handleShutdown.bind(this));
        
        this.logger.info('Cooldown module started');
    }

    async stop() {
        await super.stop();
        
        if (this.cooldownManager) {
            await this.cooldownManager.shutdown();
        }
        
        this.logger.info('Cooldown module stopped');
    }

    // Public API Methods

    /**
     * Check if a cooldown is active
     * @param {string} commandName - The command name
     * @param {string} username - The username
     * @param {number} duration - Cooldown duration in milliseconds
     * @param {object} options - Additional options
     * @returns {object} - { allowed: boolean, remaining?: number, message?: string }
     */
    async checkCooldown(commandName, username, duration, options = {}) {
        try {
            const result = await this.cooldownManager.check(commandName, username, duration, options);
            
            // Emit event
            this.emit('cooldown.checked', {
                commandName: commandName,
                username: username,
                duration: duration,
                result: result,
                options: options
            });
            
            return result;
        } catch (error) {
            this.logger.error('Error checking cooldown:', error);
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
    async setCooldown(commandName, username, duration, options = {}) {
        try {
            await this.cooldownManager.set(commandName, username, duration, options);
            
            // Emit event
            this.emit('cooldown.started', {
                commandName: commandName,
                username: username,
                duration: duration,
                options: options
            });
            
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
    async resetCooldown(commandName, username, options = {}) {
        try {
            const removed = await this.cooldownManager.reset(commandName, username, options);
            
            if (removed) {
                // Emit event
                this.emit('cooldown.reset', {
                    commandName: commandName,
                    username: username,
                    options: options
                });
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
        try {
            return await this.cooldownManager.getRemaining(commandName, username, duration, options);
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
        try {
            return await this.cooldownManager.getUserCooldowns(username, options);
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
        try {
            return await this.cooldownManager.getCommandCooldowns(commandName, options);
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
    async cleanupCooldowns(maxAge = null) {
        try {
            const result = await this.cooldownManager.cleanup(maxAge);
            
            if (result.total > 0) {
                // Emit event
                this.emit('cooldown.expired', {
                    cleaned: result.total,
                    memory: result.memory,
                    persistent: result.persistent
                });
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
        try {
            return await this.cooldownManager.getStats();
        } catch (error) {
            this.logger.error('Error getting cooldown stats:', error);
            return {};
        }
    }

    // Legacy compatibility methods

    /**
     * Legacy check method for backward compatibility
     * @param {string} key - Legacy key format (command:username)
     * @param {number} duration - Cooldown duration
     * @returns {object} - Check result
     */
    async checkLegacy(key, duration) {
        try {
            return await this.cooldownManager.checkLegacy(key, duration);
        } catch (error) {
            this.logger.error('Error checking legacy cooldown:', error);
            return { allowed: true };
        }
    }

    /**
     * Legacy compatibility: provide the old cooldown manager interface
     * @returns {object} - Legacy interface
     */
    getLegacyInterface() {
        return {
            check: (key, duration) => this.checkLegacy(key, duration),
            set: async (key, timestamp = null) => {
                // Parse legacy key and use new interface
                const parts = key.split(':');
                if (parts.length >= 2) {
                    await this.setCooldown(parts[0], parts[1], 0, { timestamp });
                }
            },
            cleanup: () => this.cleanupCooldowns()
        };
    }

    // Event handlers

    async handleCleanup(data) {
        // Perform periodic cleanup
        await this.cleanupCooldowns();
    }

    async handleShutdown(data) {
        // Graceful shutdown
        await this.stop();
    }

    // Context integration

    /**
     * Provide cooldown interface to bot context
     * This method can be called by the bot to get a simplified cooldown interface
     * @returns {object} - Simplified cooldown interface
     */
    getBotInterface() {
        return {
            check: (key, duration) => {
                // Support both legacy and new formats
                if (key.includes(':')) {
                    return this.checkLegacy(key, duration);
                } else {
                    throw new Error('New format requires commandName and username separately');
                }
            },
            
            // New interface methods
            checkCooldown: (commandName, username, duration, options) => 
                this.checkCooldown(commandName, username, duration, options),
            
            setCooldown: (commandName, username, duration, options) =>
                this.setCooldown(commandName, username, duration, options),
            
            resetCooldown: (commandName, username, options) =>
                this.resetCooldown(commandName, username, options),
            
            getUserCooldowns: (username, options) =>
                this.getUserCooldowns(username, options),
            
            getStats: () => this.getStats(),
            
            cleanup: () => this.cleanupCooldowns()
        };
    }

    /**
     * Migration helper: convert from old cooldown system
     * @param {object} oldCooldowns - Old cooldown data
     */
    async migrateFromLegacy(oldCooldowns) {
        try {
            let migrated = 0;
            
            for (const [legacyKey, timestamp] of Object.entries(oldCooldowns)) {
                try {
                    const parts = legacyKey.split(':');
                    if (parts.length >= 2) {
                        await this.setCooldown(
                            parts[0], 
                            parts[1], 
                            0, // Duration doesn't matter for migration
                            { 
                                timestamp: timestamp,
                                roomId: parts[2] || 'fatpizza'
                            }
                        );
                        migrated++;
                    }
                } catch (error) {
                    this.logger.warn(`Failed to migrate cooldown ${legacyKey}:`, error);
                }
            }
            
            this.logger.info(`Migrated ${migrated} cooldowns from legacy system`);
            return migrated;
            
        } catch (error) {
            this.logger.error('Error migrating from legacy cooldowns:', error);
            return 0;
        }
    }
}

module.exports = CooldownModule;