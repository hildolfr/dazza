import { createLogger } from '../utils/LoggerCompatibilityLayer.js';

const logger = createLogger('migrations');

export async function up(db) {
    logger.info('Adding room_id to user_bladder table...');
    
    // Start transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
        // Check if room_id column already exists
        const tableInfo = await db.all('PRAGMA table_info(user_bladder)');
        const hasRoomId = tableInfo.some(col => col.name === 'room_id');
        
        if (!hasRoomId) {
            // Create a new table with room_id
            await db.run(`
                CREATE TABLE user_bladder_new (
                    username TEXT NOT NULL,
                    room_id TEXT NOT NULL DEFAULT 'fatpizza',
                    current_amount INTEGER DEFAULT 0,
                    last_drink_time INTEGER,
                    drinks_since_piss TEXT DEFAULT '[]',
                    last_piss_time INTEGER,
                    created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
                    updated_at INTEGER DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (username, room_id)
                )
            `);
            
            // Copy existing data with default room_id
            await db.run(`
                INSERT INTO user_bladder_new (username, room_id, current_amount, last_drink_time, drinks_since_piss, last_piss_time, created_at, updated_at)
                SELECT username, 'fatpizza', current_amount, last_drink_time, drinks_since_piss, last_piss_time, created_at, updated_at
                FROM user_bladder
            `);
            
            // Drop the old table
            await db.run('DROP TABLE user_bladder');
            
            // Rename the new table
            await db.run('ALTER TABLE user_bladder_new RENAME TO user_bladder');
            
            // Create indexes
            await db.run('CREATE INDEX IF NOT EXISTS idx_user_bladder_username ON user_bladder(username)');
            await db.run('CREATE INDEX IF NOT EXISTS idx_user_bladder_room_id ON user_bladder(room_id)');
            
            logger.info('Successfully added room_id to user_bladder table');
        } else {
            logger.info('room_id column already exists in user_bladder table');
        }
        
        // Commit transaction
        await db.run('COMMIT');
        
    } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        logger.error('Failed to add room_id to user_bladder table:', error);
        throw error;
    }
}

export async function down(db) {
    logger.info('Removing room_id from user_bladder table...');
    
    await db.run('BEGIN TRANSACTION');
    
    try {
        // Create original table structure
        await db.run(`
            CREATE TABLE user_bladder_old (
                username TEXT PRIMARY KEY,
                current_amount INTEGER DEFAULT 0,
                last_drink_time INTEGER,
                drinks_since_piss TEXT DEFAULT '[]',
                last_piss_time INTEGER,
                created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
                updated_at INTEGER DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Copy data from the first room only (data loss warning)
        await db.run(`
            INSERT INTO user_bladder_old (username, current_amount, last_drink_time, drinks_since_piss, last_piss_time, created_at, updated_at)
            SELECT username, current_amount, last_drink_time, drinks_since_piss, last_piss_time, created_at, updated_at
            FROM user_bladder
            WHERE room_id = 'fatpizza'
            GROUP BY username
        `);
        
        // Drop the table with room_id
        await db.run('DROP TABLE user_bladder');
        
        // Rename old table back
        await db.run('ALTER TABLE user_bladder_old RENAME TO user_bladder');
        
        await db.run('COMMIT');
        logger.info('Successfully removed room_id from user_bladder table');
        
    } catch (error) {
        await db.run('ROLLBACK');
        logger.error('Failed to remove room_id from user_bladder table:', error);
        throw error;
    }
}

export const meta = {
    version: 1,
    description: 'Add room_id support to user_bladder table for multi-room support'
};