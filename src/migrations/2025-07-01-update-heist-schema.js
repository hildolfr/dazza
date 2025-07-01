/**
 * Migration: Update heist schema for multiroom support
 * 
 * This migration updates the heist_events and related tables to support
 * the new multiroom HeistManager with proper status tracking and participation.
 */

export const up = async (db) => {
    // Start transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
        // Check if heist_events table exists and has the old schema
        const tableInfo = await db.all(`PRAGMA table_info(heist_events)`);
        const hasStatusColumn = tableInfo.some(col => col.name === 'status');
        
        if (!hasStatusColumn) {
            // Old schema exists, need to migrate
            console.log('Migrating heist_events table to new schema...');
            
            // Create new heist_events table with updated schema
            await db.run(`
                CREATE TABLE IF NOT EXISTS heist_events_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    crime_type TEXT,
                    participant_count INTEGER DEFAULT 0,
                    total_payout INTEGER DEFAULT 0,
                    success INTEGER DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    completed_at INTEGER,
                    FOREIGN KEY (room_id) REFERENCES rooms(id)
                )
            `);
            
            // Check if the old table has room_id column (from previous migration)
            const hasRoomId = tableInfo.some(col => col.name === 'room_id');
            
            // Migrate existing data if any
            if (hasRoomId) {
                await db.run(`
                    INSERT INTO heist_events_new (id, room_id, status, crime_type, total_payout, success, created_at, completed_at)
                    SELECT 
                        id,
                        room_id,
                        CASE 
                            WHEN success = 1 THEN 'completed'
                            ELSE 'completed'
                        END as status,
                        difficulty as crime_type,
                        amount as total_payout,
                        success,
                        timestamp as created_at,
                        timestamp as completed_at
                    FROM heist_events
                `);
            } else {
                await db.run(`
                    INSERT INTO heist_events_new (id, room_id, status, crime_type, total_payout, success, created_at, completed_at)
                    SELECT 
                        id,
                        'fatpizza' as room_id,
                        CASE 
                            WHEN success = 1 THEN 'completed'
                            ELSE 'completed'
                        END as status,
                        difficulty as crime_type,
                        amount as total_payout,
                        success,
                        timestamp as created_at,
                        timestamp as completed_at
                    FROM heist_events
                `);
            }
            
            // Drop old table and rename new one
            await db.run(`DROP TABLE heist_events`);
            await db.run(`ALTER TABLE heist_events_new RENAME TO heist_events`);
        } else {
            console.log('heist_events table already has new schema, skipping migration');
        }
        
        // Create heist_participants table
        await db.run(`
            CREATE TABLE IF NOT EXISTS heist_participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                heist_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                crime_voted TEXT,
                payout INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (heist_id) REFERENCES heist_events(id)
            )
        `);
        
        // Add trust_score column to user_economy table if it doesn't exist
        try {
            await db.run(`ALTER TABLE user_economy ADD COLUMN trust_score INTEGER DEFAULT 0`);
            console.log('Added trust_score column to user_economy table');
        } catch (error) {
            if (!error.message.includes('duplicate column name')) {
                throw error;
            }
            console.log('trust_score column already exists in user_economy table');
        }
        
        // Create user_trust table
        await db.run(`
            CREATE TABLE IF NOT EXISTS user_trust (
                username TEXT PRIMARY KEY,
                trust_level INTEGER DEFAULT 0,
                last_heist_participation INTEGER,
                heists_participated INTEGER DEFAULT 0,
                heists_voted INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create heist_config table
        await db.run(`
            CREATE TABLE IF NOT EXISTS heist_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes for better performance
        await db.run(`CREATE INDEX IF NOT EXISTS idx_heist_events_room_status ON heist_events(room_id, status)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_heist_events_created ON heist_events(created_at)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_heist_participants_heist ON heist_participants(heist_id)`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_heist_participants_username ON heist_participants(username)`);
        
        // Commit transaction
        await db.run('COMMIT');
        
        console.log('Successfully updated heist schema for multiroom support');
    } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        throw error;
    }
}

export const down = async (db) => {
    // This is a major structural change - down migration would lose data
    throw new Error('Down migration not implemented for heist schema update - would result in data loss');
};