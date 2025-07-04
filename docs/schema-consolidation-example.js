/**
 * Example of consolidated schema pattern
 * This shows how to merge schema.js and schema_compat.js into a single file
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('UnifiedSchema');

export const unifiedHeistSchema = {
    // SQL definitions remain the same
    createUserEconomyTable: `
        CREATE TABLE IF NOT EXISTS user_economy (
            username TEXT PRIMARY KEY,
            balance INTEGER DEFAULT 0,
            last_heist INTEGER DEFAULT 0,
            heist_count INTEGER DEFAULT 0,
            total_earned INTEGER DEFAULT 0,
            total_lost INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,

    createHeistEventsTable: `
        CREATE TABLE IF NOT EXISTS heist_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            amount INTEGER NOT NULL,
            success INTEGER NOT NULL,
            difficulty TEXT NOT NULL,
            message TEXT,
            timestamp INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,

    // Index definitions
    indexes: [
        'CREATE INDEX IF NOT EXISTS idx_user_economy_balance ON user_economy(balance)',
        'CREATE INDEX IF NOT EXISTS idx_heist_events_username ON heist_events(username)',
        'CREATE INDEX IF NOT EXISTS idx_heist_events_timestamp ON heist_events(timestamp)'
    ],

    /**
     * Initialize schema with mode support
     * @param {Database} database - Database instance
     * @param {Object} options - Initialization options
     * @param {string} options.mode - 'full' for new installations, 'compat' for existing databases (default)
     * @param {boolean} options.skipIndexes - Skip index creation (useful for testing)
     */
    async initialize(database, options = {}) {
        const { mode = 'compat', skipIndexes = false } = options;
        
        logger.info(`Initializing heist schema in ${mode} mode`);

        try {
            if (mode === 'full') {
                // Full initialization for new databases
                logger.info('Creating heist tables...');
                await database.run(this.createUserEconomyTable);
                await database.run(this.createHeistEventsTable);
                
                // Insert default data
                logger.info('Inserting default crime types...');
                await database.run(this.insertDefaultCrimeTypes);
            }

            if (!skipIndexes) {
                // Always safe to create indexes with IF NOT EXISTS
                logger.info('Creating indexes...');
                for (const indexSql of this.indexes) {
                    try {
                        await database.run(indexSql);
                    } catch (error) {
                        // Log but don't fail if index already exists
                        logger.debug(`Index may already exist: ${error.message}`);
                    }
                }
            }

            logger.info(`Heist schema initialization completed (${mode} mode)`);
        } catch (error) {
            logger.error(`Schema initialization failed: ${error.message}`);
            throw error;
        }
    },

    /**
     * Check if tables exist (useful for determining initialization mode)
     */
    async checkTablesExist(database) {
        try {
            const result = await database.get(`
                SELECT COUNT(*) as count 
                FROM sqlite_master 
                WHERE type='table' AND name IN ('user_economy', 'heist_events')
            `);
            return result.count === 2; // Both tables exist
        } catch (error) {
            logger.error('Error checking tables:', error);
            return false;
        }
    }
};

// Usage example in database.js:
/*
import { unifiedHeistSchema } from '../modules/heist/unifiedSchema.js';

// In createTables method:
const tablesExist = await unifiedHeistSchema.checkTablesExist(this);
await unifiedHeistSchema.initialize(this, { 
    mode: tablesExist ? 'compat' : 'full' 
});
*/