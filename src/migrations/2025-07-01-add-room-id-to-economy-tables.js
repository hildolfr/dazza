import { createLogger } from '../utils/logger.js';

const logger = createLogger('migrations');

export async function up(db) {
    logger.info('Adding room_id to economy-related tables...');
    
    // Start transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
        // 1. Check and add room_id to economy_transactions table
        const econTable = await db.get(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='economy_transactions'
        `);
        
        if (econTable && !econTable.sql.includes('room_id')) {
            await db.run(`ALTER TABLE economy_transactions ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            logger.info('Added room_id to economy_transactions');
        }
        
        // 2. Check and add room_id to coin_flip_challenges table
        const coinFlipChallengesTable = await db.get(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='coin_flip_challenges'
        `);
        
        if (coinFlipChallengesTable && !coinFlipChallengesTable.sql.includes('room_id')) {
            await db.run(`ALTER TABLE coin_flip_challenges ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            logger.info('Added room_id to coin_flip_challenges');
        }
        
        // For tables that need composite primary keys (username, room_id), we'll handle them differently
        // These tables will continue to function with the existing schema for now
        // Future migrations can handle the primary key changes if needed
        
        logger.info('Note: user_bladder, mug_stats, coin_flip_stats, and sign_spinning_stats tables will need separate handling for room support');
        
        // Commit transaction
        await db.run('COMMIT');
        logger.info('Successfully added room_id to economy-related tables where possible');
        
    } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        throw error;
    }
}

export async function down(db) {
    logger.info('Removing room_id from economy-related tables...');
    
    // This is a destructive operation that would lose room data
    // Only proceed if absolutely necessary
    
    await db.run('BEGIN TRANSACTION');
    
    try {
        // SQLite doesn't support DROP COLUMN directly
        // Would need to recreate tables without room_id
        logger.warn('Down migration not implemented - would require table recreation');
        
        await db.run('COMMIT');
        
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
}

export const meta = {
    version: 1,
    description: 'Add room_id to economy-related tables'
};