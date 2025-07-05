class MemoryStore {
    constructor(logger = null, config = {}) {
        this.logger = logger || console;
        this.store = new Map();
        this.config = {
            maxEntries: 10000,
            cleanupInterval: 300000, // 5 minutes
            ...config
        };
        this.cleanupTimer = null;
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            cleanups: 0,
            evictions: 0
        };
    }

    /**
     * Initialize the memory store
     */
    init() {
        // Start automatic cleanup
        this.startCleanup();
        this.logger.debug('MemoryStore initialized');
    }

    /**
     * Check if a cooldown is active
     * @param {string} key - The cooldown key
     * @param {number} duration - Cooldown duration in milliseconds
     * @returns {object} - { allowed: boolean, remaining?: number }
     */
    check(key, duration) {
        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry) {
            this.stats.misses++;
            return { allowed: true };
        }

        const elapsed = now - entry.timestamp;
        const remaining = Math.max(0, duration - elapsed);

        if (remaining > 0) {
            this.stats.hits++;
            return { 
                allowed: false, 
                remaining: Math.ceil(remaining / 1000) // Return seconds
            };
        }

        // Cooldown expired, remove it
        this.store.delete(key);
        this.stats.misses++;
        return { allowed: true };
    }

    /**
     * Set a cooldown
     * @param {string} key - The cooldown key
     * @param {number} timestamp - The timestamp when cooldown started (optional)
     */
    set(key, timestamp = null) {
        const now = timestamp || Date.now();
        
        // Check if we need to evict entries to stay under limit
        if (this.store.size >= this.config.maxEntries) {
            this.evictOldest();
        }

        this.store.set(key, {
            timestamp: now,
            setAt: Date.now()
        });

        this.stats.sets++;
        this.logger.debug(`Set cooldown: ${key}`);
    }

    /**
     * Remove a specific cooldown
     * @param {string} key - The cooldown key
     * @returns {boolean} - True if removed, false if not found
     */
    remove(key) {
        const existed = this.store.has(key);
        this.store.delete(key);
        
        if (existed) {
            this.logger.debug(`Removed cooldown: ${key}`);
        }
        
        return existed;
    }

    /**
     * Get remaining cooldown time
     * @param {string} key - The cooldown key
     * @param {number} duration - Cooldown duration in milliseconds
     * @returns {number|null} - Remaining time in seconds, or null if no cooldown
     */
    getRemaining(key, duration) {
        const entry = this.store.get(key);
        if (!entry) {
            return null;
        }

        const elapsed = Date.now() - entry.timestamp;
        const remaining = Math.max(0, duration - elapsed);
        
        return remaining > 0 ? Math.ceil(remaining / 1000) : null;
    }

    /**
     * Get all cooldowns for a user pattern
     * @param {string} pattern - The pattern to match (e.g., "*:username:*")
     * @returns {Array} - Array of { key, timestamp, remaining }
     */
    getByPattern(pattern) {
        const results = [];
        const regex = this.patternToRegex(pattern);

        for (const [key, entry] of this.store) {
            if (regex.test(key)) {
                results.push({
                    key: key,
                    timestamp: entry.timestamp,
                    setAt: entry.setAt
                });
            }
        }

        return results;
    }

    /**
     * Remove all cooldowns matching a pattern
     * @param {string} pattern - The pattern to match
     * @returns {number} - Number of cooldowns removed
     */
    removeByPattern(pattern) {
        const regex = this.patternToRegex(pattern);
        const keysToRemove = [];

        for (const [key] of this.store) {
            if (regex.test(key)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => this.store.delete(key));
        
        this.logger.debug(`Removed ${keysToRemove.length} cooldowns matching pattern: ${pattern}`);
        return keysToRemove.length;
    }

    /**
     * Clean up expired cooldowns
     * @param {number} maxAge - Maximum age in milliseconds (optional)
     * @returns {number} - Number of expired cooldowns removed
     */
    cleanup(maxAge = null) {
        const now = Date.now();
        const cutoff = maxAge ? now - maxAge : null;
        const keysToRemove = [];

        for (const [key, entry] of this.store) {
            // Remove entries older than maxAge if specified
            if (cutoff && entry.setAt < cutoff) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => this.store.delete(key));
        
        this.stats.cleanups++;
        if (keysToRemove.length > 0) {
            this.logger.debug(`Cleaned up ${keysToRemove.length} expired cooldowns`);
        }

        return keysToRemove.length;
    }

    /**
     * Get all cooldowns
     * @returns {Array} - Array of all cooldown entries
     */
    getAll() {
        return Array.from(this.store.entries()).map(([key, entry]) => ({
            key: key,
            timestamp: entry.timestamp,
            setAt: entry.setAt
        }));
    }

    /**
     * Get store statistics
     * @returns {object} - Store statistics
     */
    getStats() {
        return {
            ...this.stats,
            size: this.store.size,
            maxEntries: this.config.maxEntries,
            memoryUsage: this.getMemoryUsage()
        };
    }

    /**
     * Clear all cooldowns
     */
    clear() {
        const size = this.store.size;
        this.store.clear();
        this.logger.debug(`Cleared ${size} cooldowns from memory store`);
    }

    /**
     * Start automatic cleanup
     */
    startCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    /**
     * Stop automatic cleanup
     */
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Evict oldest entries to stay under limit
     */
    evictOldest() {
        const entries = Array.from(this.store.entries());
        
        // Sort by setAt timestamp (oldest first)
        entries.sort((a, b) => a[1].setAt - b[1].setAt);
        
        // Remove oldest 10% or at least 1
        const toEvict = Math.max(1, Math.floor(entries.length * 0.1));
        
        for (let i = 0; i < toEvict; i++) {
            this.store.delete(entries[i][0]);
            this.stats.evictions++;
        }
        
        this.logger.debug(`Evicted ${toEvict} oldest cooldowns`);
    }

    /**
     * Convert pattern to regex
     * @param {string} pattern - Pattern with * wildcards
     * @returns {RegExp} - Regular expression
     */
    patternToRegex(pattern) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexPattern = escaped.replace(/\\\*/g, '.*');
        return new RegExp(`^${regexPattern}$`);
    }

    /**
     * Get estimated memory usage
     * @returns {number} - Estimated memory usage in bytes
     */
    getMemoryUsage() {
        let size = 0;
        for (const [key, entry] of this.store) {
            size += key.length * 2; // Rough estimate for string size
            size += 24; // Rough estimate for entry object
        }
        return size;
    }

    /**
     * Shutdown the store
     */
    shutdown() {
        this.stopCleanup();
        this.clear();
        this.logger.debug('MemoryStore shutdown complete');
    }
}

module.exports = MemoryStore;