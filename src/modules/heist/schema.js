/**
 * Database schema for the heist economy system
 * This is imported by database.js to initialize tables
 */

import { createLogger } from '../../utils/LoggerCompatibilityLayer.js';
const logger = createLogger('HeistSchema');

export const heistSchema = {
    // SQL for creating user_economy table
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

    // SQL for creating heist_events table
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

    // SQL for creating coin_flip_challenges table
    createCoinFlipChallengesTable: `
        CREATE TABLE IF NOT EXISTS coin_flip_challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challenger TEXT NOT NULL,
            target TEXT NOT NULL,
            amount INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            winner TEXT,
            completed_at INTEGER
        )
    `,

    // SQL for creating pissing_contest_challenges table
    createPissingContestChallengesTable: `
        CREATE TABLE IF NOT EXISTS pissing_contest_challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challenger TEXT NOT NULL,
            target TEXT NOT NULL,
            amount INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            winner TEXT,
            completed_at INTEGER,
            challenger_stats TEXT,
            target_stats TEXT,
            contest_details TEXT
        )
    `,

    // SQL for creating crime_types table
    createCrimeTypesTable: `
        CREATE TABLE IF NOT EXISTS crime_types (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            min_payout INTEGER NOT NULL CHECK (min_payout >= 0),
            max_payout INTEGER NOT NULL CHECK (max_payout >= min_payout),
            success_rate REAL NOT NULL CHECK (success_rate >= 0 AND success_rate <= 1),
            created_at INTEGER NOT NULL
        )
    `,

    // SQL for inserting default crime types
    insertDefaultCrimeTypes: `
        INSERT OR IGNORE INTO crime_types (id, name, min_payout, max_payout, success_rate, created_at)
        VALUES 
            ('pickpocket', 'pickpocket', 10, 50, 0.7, strftime('%s', 'now') * 1000),
            ('shoplifting', 'shoplifting', 20, 100, 0.6, strftime('%s', 'now') * 1000),
            ('burglary', 'burglary', 50, 300, 0.4, strftime('%s', 'now') * 1000),
            ('robbery', 'robbery', 100, 500, 0.3, strftime('%s', 'now') * 1000),
            ('heist', 'heist', 200, 1000, 0.2, strftime('%s', 'now') * 1000)
    `,

    // Index creation SQL
    createUserEconomyBalanceIndex: 'CREATE INDEX IF NOT EXISTS idx_user_economy_balance ON user_economy(balance)',
    createHeistEventsUsernameIndex: 'CREATE INDEX IF NOT EXISTS idx_heist_events_username ON heist_events(username)',
    createHeistEventsTimestampIndex: 'CREATE INDEX IF NOT EXISTS idx_heist_events_timestamp ON heist_events(timestamp)',
    createCoinFlipChallengesIndex: 'CREATE INDEX IF NOT EXISTS idx_coin_flip_challenges_status ON coin_flip_challenges(status)',
    createPissingContestChallengesIndex: 'CREATE INDEX IF NOT EXISTS idx_pissing_contest_challenges_status ON pissing_contest_challenges(status)',

    // Keep the initialize method for backward compatibility
    async initialize(database) {
        // Create tables
        await database.run(this.createUserEconomyTable);
        await database.run(this.createHeistEventsTable);
        await database.run(this.createCoinFlipChallengesTable);
        await database.run(this.createPissingContestChallengesTable);
        await database.run(this.createCrimeTypesTable);
        
        // Insert default crime types
        await database.run(this.insertDefaultCrimeTypes);
        
        // Create indexes
        await database.run(this.createUserEconomyBalanceIndex);
        await database.run(this.createHeistEventsUsernameIndex);
        await database.run(this.createHeistEventsTimestampIndex);
        await database.run(this.createCoinFlipChallengesIndex);
        await database.run(this.createPissingContestChallengesIndex);
        
        logger.info('Heist tables initialized');
    }
};