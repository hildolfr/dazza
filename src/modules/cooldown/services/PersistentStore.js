class PersistentStore {
    constructor(database, logger = null, config = {}) {
        this.db = database;
        this.logger = logger || console;
        this.config = {
            batchSize: 100,
            maxAge: 604800000, // 7 days
            ...config
        };
        this.initialized = false;
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            cleanups: 0,
            errors: 0
        };
    }

    /**
     * Initialize the persistent store
     */
    async init() {
        if (this.initialized) {
            return;
        }

        try {
            await this.createTable();
            this.initialized = true;
            this.logger.debug('PersistentStore initialized');
        } catch (error) {
            this.logger.error('Failed to initialize PersistentStore:', error);
            throw error;
        }
    }

    /**
     * Create the cooldowns table
     */
    async createTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS cooldowns (
                command_name TEXT NOT NULL,
                username TEXT NOT NULL,
                last_used INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                room_id TEXT NOT NULL DEFAULT 'fatpizza',
                PRIMARY KEY (command_name, username, room_id)
            )
        `;
        
        await this.db.run(query);
        
        // Create indexes for better performance
        await this.db.run('CREATE INDEX IF NOT EXISTS idx_cooldowns_last_used ON cooldowns(last_used)');
        await this.db.run('CREATE INDEX IF NOT EXISTS idx_cooldowns_username ON cooldowns(username)');
        await this.db.run('CREATE INDEX IF NOT EXISTS idx_cooldowns_room_id ON cooldowns(room_id)');
        
        this.logger.debug('Cooldowns table created/verified');
    }

    /**
     * Check if a cooldown is active
     * @param {string} key - The cooldown key (command:username:room)
     * @param {number} duration - Cooldown duration in milliseconds
     * @returns {object} - { allowed: boolean, remaining?: number }
     */
    async check(key, duration) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const { commandName, username, roomId } = this.parseKey(key);
            const now = Date.now();
            
            const query = `
                SELECT last_used 
                FROM cooldowns 
                WHERE command_name = ? AND username = ? AND room_id = ?
            `;
            
            const row = await this.db.get(query, [commandName, username, roomId]);
            
            if (!row) {
                this.stats.misses++;
                return { allowed: true };
            }
            
            const elapsed = now - row.last_used;
            const remaining = Math.max(0, duration - elapsed);
            
            if (remaining > 0) {
                this.stats.hits++;
                return { 
                    allowed: false, 
                    remaining: Math.ceil(remaining / 1000) // Return seconds
                };
            }
            
            // Cooldown expired, remove it
            await this.remove(key);
            this.stats.misses++;
            return { allowed: true };
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Error checking persistent cooldown:', error);
            // Fail open - allow command on error
            return { allowed: true };
        }
    }

    /**
     * Set a cooldown
     * @param {string} key - The cooldown key
     * @param {number} timestamp - The timestamp when cooldown started (optional)
     */
    async set(key, timestamp = null) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const { commandName, username, roomId } = this.parseKey(key);
            const now = timestamp || Date.now();
            
            const query = `
                INSERT OR REPLACE INTO cooldowns (command_name, username, room_id, last_used)
                VALUES (?, ?, ?, ?)
            `;
            
            await this.db.run(query, [commandName, username, roomId, now]);
            
            this.stats.sets++;
            this.logger.debug(`Set persistent cooldown: ${key}`);
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Error setting persistent cooldown:', error);
            throw error;
        }
    }

    /**
     * Remove a specific cooldown
     * @param {string} key - The cooldown key
     * @returns {boolean} - True if removed, false if not found
     */
    async remove(key) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const { commandName, username, roomId } = this.parseKey(key);
            
            const query = `
                DELETE FROM cooldowns 
                WHERE command_name = ? AND username = ? AND room_id = ?
            `;
            
            const result = await this.db.run(query, [commandName, username, roomId]);
            
            if (result.changes > 0) {
                this.logger.debug(`Removed persistent cooldown: ${key}`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Error removing persistent cooldown:', error);
            return false;
        }
    }

    /**
     * Get remaining cooldown time
     * @param {string} key - The cooldown key
     * @param {number} duration - Cooldown duration in milliseconds
     * @returns {number|null} - Remaining time in seconds, or null if no cooldown
     */
    async getRemaining(key, duration) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const { commandName, username, roomId } = this.parseKey(key);
            
            const query = `
                SELECT last_used 
                FROM cooldowns 
                WHERE command_name = ? AND username = ? AND room_id = ?
            `;
            
            const row = await this.db.get(query, [commandName, username, roomId]);
            
            if (!row) {
                return null;
            }
            
            const elapsed = Date.now() - row.last_used;
            const remaining = Math.max(0, duration - elapsed);
            
            return remaining > 0 ? Math.ceil(remaining / 1000) : null;
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Error getting remaining cooldown:', error);
            return null;
        }
    }

    /**
     * Get cooldowns by pattern
     * @param {string} pattern - Pattern to match (e.g., "*:username:*")
     * @returns {Array} - Array of cooldown entries
     */
    async getByPattern(pattern) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const whereClause = this.buildWhereClause(pattern);
            const query = `
                SELECT command_name, username, room_id, last_used, created_at
                FROM cooldowns
                ${whereClause.clause}
                ORDER BY last_used DESC
            `;
            
            const rows = await this.db.all(query, whereClause.params);
            
            return rows.map(row => ({
                key: this.buildKey(row.command_name, row.username, row.room_id),
                commandName: row.command_name,
                username: row.username,
                roomId: row.room_id,
                timestamp: row.last_used,
                createdAt: row.created_at
            }));
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Error getting cooldowns by pattern:', error);
            return [];
        }
    }

    /**
     * Remove cooldowns by pattern
     * @param {string} pattern - Pattern to match
     * @returns {number} - Number of cooldowns removed
     */
    async removeByPattern(pattern) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const whereClause = this.buildWhereClause(pattern);
            const query = `
                DELETE FROM cooldowns
                ${whereClause.clause}
            `;
            
            const result = await this.db.run(query, whereClause.params);
            
            this.logger.debug(`Removed ${result.changes} persistent cooldowns matching pattern: ${pattern}`);
            return result.changes;
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Error removing cooldowns by pattern:', error);
            return 0;
        }
    }

    /**
     * Clean up old cooldowns
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {number} - Number of cooldowns removed
     */
    async cleanup(maxAge = null) {
        if (!this.initialized) {
            await this.init();
        }

        const cutoffTime = Date.now() - (maxAge || this.config.maxAge);
        
        try {
            const query = 'DELETE FROM cooldowns WHERE last_used < ?';
            const result = await this.db.run(query, [cutoffTime]);
            
            this.stats.cleanups++;
            if (result.changes > 0) {
                this.logger.debug(`Cleaned up ${result.changes} old persistent cooldowns`);
            }
            
            return result.changes;
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Error cleaning up old cooldowns:', error);
            return 0;
        }
    }

    /**
     * Get all cooldowns
     * @returns {Array} - Array of all cooldown entries
     */
    async getAll() {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const query = `
                SELECT command_name, username, room_id, last_used, created_at
                FROM cooldowns
                ORDER BY last_used DESC
            `;
            
            const rows = await this.db.all(query);
            
            return rows.map(row => ({
                key: this.buildKey(row.command_name, row.username, row.room_id),
                commandName: row.command_name,
                username: row.username,
                roomId: row.room_id,
                timestamp: row.last_used,
                createdAt: row.created_at
            }));
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Error getting all cooldowns:', error);
            return [];
        }
    }

    /**
     * Get store statistics
     * @returns {object} - Store statistics
     */
    async getStats() {
        try {
            const countQuery = 'SELECT COUNT(*) as count FROM cooldowns';
            const sizeQuery = `
                SELECT 
                    COUNT(*) as total_entries,
                    MIN(last_used) as oldest,
                    MAX(last_used) as newest
                FROM cooldowns
            `;
            
            const countResult = await this.db.get(countQuery);
            const sizeResult = await this.db.get(sizeQuery);
            
            return {
                ...this.stats,
                totalEntries: countResult.count,
                oldestEntry: sizeResult.oldest,
                newestEntry: sizeResult.newest,
                maxAge: this.config.maxAge
            };
            
        } catch (error) {
            this.logger.error('Error getting persistent store stats:', error);
            return this.stats;
        }
    }

    /**
     * Clear all cooldowns
     */
    async clear() {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const result = await this.db.run('DELETE FROM cooldowns');
            this.logger.debug(`Cleared ${result.changes} cooldowns from persistent store`);
            return result.changes;
            
        } catch (error) {
            this.stats.errors++;
            this.logger.error('Error clearing persistent cooldowns:', error);
            return 0;
        }
    }

    /**
     * Parse cooldown key into components
     * @param {string} key - The cooldown key
     * @returns {object} - { commandName, username, roomId }
     */
    parseKey(key) {
        const parts = key.split(':');
        if (parts.length < 2) {
            throw new Error(`Invalid cooldown key format: ${key}`);
        }
        
        return {
            commandName: parts[0],
            username: parts[1],
            roomId: parts[2] || 'fatpizza'
        };
    }

    /**
     * Build cooldown key from components
     * @param {string} commandName - Command name
     * @param {string} username - Username
     * @param {string} roomId - Room ID
     * @returns {string} - Cooldown key
     */
    buildKey(commandName, username, roomId) {
        return `${commandName}:${username}:${roomId}`;
    }

    /**
     * Build WHERE clause for pattern matching
     * @param {string} pattern - Pattern with wildcards
     * @returns {object} - { clause, params }
     */
    buildWhereClause(pattern) {
        const parts = pattern.split(':');
        const conditions = [];
        const params = [];
        
        if (parts[0] && parts[0] !== '*') {
            conditions.push('command_name = ?');
            params.push(parts[0]);
        }
        
        if (parts[1] && parts[1] !== '*') {
            conditions.push('username = ?');
            params.push(parts[1]);
        }
        
        if (parts[2] && parts[2] !== '*') {
            conditions.push('room_id = ?');
            params.push(parts[2]);
        }
        
        const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        return { clause, params };
    }

    /**
     * Shutdown the store
     */
    async shutdown() {
        this.initialized = false;
        this.logger.debug('PersistentStore shutdown complete');
    }
}

module.exports = PersistentStore;