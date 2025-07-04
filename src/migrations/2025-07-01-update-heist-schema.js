/**
 * Migration: Update heist schema for multiroom support
 * 
 * This migration updates the heist_events and related tables to support
 * the new multiroom HeistManager with proper status tracking and participation.
 */

export const up = async (db, logger = console) => {
    // Start transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
        // Check if heist_events table needs updates
        const tableInfo = await db.all(`PRAGMA table_info(heist_events)`);
        const hasStatusColumn = tableInfo.some(col => col.name === 'status');
        const hasParticipantCount = tableInfo.some(col => col.name === 'participant_count');
        const hasTotalPayout = tableInfo.some(col => col.name === 'total_payout');
        
        // Add missing columns to heist_events if needed
        if (!hasStatusColumn) {
            await db.run(`ALTER TABLE heist_events ADD COLUMN status TEXT`);
            // Update existing rows to have a status based on their state
            await db.run(`UPDATE heist_events SET status = 'completed' WHERE state IS NOT NULL`);
        }
        
        if (!hasParticipantCount) {
            await db.run(`ALTER TABLE heist_events ADD COLUMN participant_count INTEGER DEFAULT 0`);
            // Update from participants_count if it exists
            const hasParticipantsCount = tableInfo.some(col => col.name === 'participants_count');
            if (hasParticipantsCount) {
                await db.run(`UPDATE heist_events SET participant_count = participants_count`);
            }
        }
        
        if (!hasTotalPayout) {
            await db.run(`ALTER TABLE heist_events ADD COLUMN total_payout INTEGER DEFAULT 0`);
            // Copy from total_haul if it exists
            const hasTotalHaul = tableInfo.some(col => col.name === 'total_haul');
            if (hasTotalHaul) {
                await db.run(`UPDATE heist_events SET total_payout = total_haul`);
            }
        }
        
        // Add trust_score column to user_economy if it doesn't exist
        const economyInfo = await db.all(`PRAGMA table_info(user_economy)`);
        const hasTrustScore = economyInfo.some(col => col.name === 'trust_score');
        
        if (!hasTrustScore) {
            logger.info('Adding trust_score column to user_economy...');
            await db.run(`ALTER TABLE user_economy ADD COLUMN trust_score INTEGER DEFAULT 0`);
            
            // Copy from trust column if it exists
            const hasTrust = economyInfo.some(col => col.name === 'trust');
            if (hasTrust) {
                await db.run(`UPDATE user_economy SET trust_score = trust WHERE trust IS NOT NULL`);
            }
        }
        
        // Create heist_participants table if it doesn't exist
        await db.run(`
            CREATE TABLE IF NOT EXISTS heist_participants (
                heist_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                vote TEXT,
                participated_at INTEGER,
                PRIMARY KEY (heist_id, username),
                FOREIGN KEY (heist_id) REFERENCES heist_events(id)
            )
        `);
        
        // Create user_trust table if needed
        await db.run(`
            CREATE TABLE IF NOT EXISTS user_trust (
                username TEXT PRIMARY KEY,
                trust_score INTEGER DEFAULT 0,
                last_update INTEGER
            )
        `);
        
        // Create heist_config table for state persistence
        await db.run(`
            CREATE TABLE IF NOT EXISTS heist_config (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at INTEGER
            )
        `);
        
        // Create indexes
        await db.run(`CREATE INDEX IF NOT EXISTS idx_heist_events_room_id ON heist_events(room_id)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_heist_events_status ON heist_events(status)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_heist_participants_username ON heist_participants(username)`);
        
        await db.run('COMMIT');
        logger.info('Successfully updated heist schema for multiroom support');
        
    } catch (error) {
        await db.run('ROLLBACK');
        logger.error('Migration error details:', error.message);
        logger.error('Migration error stack:', error.stack);
        throw error;
    }
};

export const down = async (db, logger = console) => {
    // This migration is backward compatible - columns are added, not removed
    // Down migration would only remove the new columns if needed
    logger.info('Down migration not implemented - changes are backward compatible');
};