/**
 * Migration: Add room support to database schema
 * 
 * This migration adds room_id columns to all tables that need room context
 * and sets existing data to 'fatpizza' as the default room.
 */

export const up = async (db) => {
        // Start transaction
        await db.run('BEGIN TRANSACTION');
        
        try {
            // Create rooms table
            await db.run(`
                CREATE TABLE IF NOT EXISTS rooms (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    first_joined INTEGER NOT NULL,
                    last_active INTEGER NOT NULL,
                    is_active INTEGER DEFAULT 1,
                    config TEXT
                )
            `);
            
            // Create room_user_presence table
            await db.run(`
                CREATE TABLE IF NOT EXISTS room_user_presence (
                    room_id TEXT NOT NULL,
                    username TEXT NOT NULL,
                    joined_at INTEGER NOT NULL,
                    last_seen INTEGER NOT NULL,
                    PRIMARY KEY (room_id, username)
                )
            `);
            
            // Add room_id to messages table
            await db.run(`ALTER TABLE messages ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to user_events table
            await db.run(`ALTER TABLE user_events ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to posted_urls table
            await db.run(`ALTER TABLE posted_urls ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to heist_events table
            await db.run(`ALTER TABLE heist_events ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to coin_flip_challenges table
            await db.run(`ALTER TABLE coin_flip_challenges ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to pissing_contest_challenges table
            await db.run(`ALTER TABLE pissing_contest_challenges ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to bong_counter table
            await db.run(`ALTER TABLE bong_counter ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to drink_counter table
            await db.run(`ALTER TABLE drink_counter ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to user_bongs table
            await db.run(`ALTER TABLE user_bongs ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to user_drinks table
            await db.run(`ALTER TABLE user_drinks ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to reminders table
            await db.run(`ALTER TABLE reminders ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to tells table
            await db.run(`ALTER TABLE tells ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Add room_id to cooldowns table
            await db.run(`ALTER TABLE cooldowns ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
            
            // Create composite indexes for better query performance
            await db.run(`CREATE INDEX idx_messages_username_room ON messages(username, room_id)`);
            await db.run(`CREATE INDEX idx_messages_room_timestamp ON messages(room_id, timestamp)`);
            
            await db.run(`CREATE INDEX idx_user_events_username_room ON user_events(username, room_id)`);
            await db.run(`CREATE INDEX idx_user_events_room_timestamp ON user_events(room_id, timestamp)`);
            
            await db.run(`CREATE INDEX idx_posted_urls_room ON posted_urls(room_id)`);
            
            await db.run(`CREATE INDEX idx_heist_events_room ON heist_events(room_id)`);
            
            await db.run(`CREATE INDEX idx_coin_flip_challenges_room ON coin_flip_challenges(room_id)`);
            
            await db.run(`CREATE INDEX idx_pissing_contest_challenges_room ON pissing_contest_challenges(room_id)`);
            
            await db.run(`CREATE INDEX idx_bong_counter_room_date ON bong_counter(room_id, date)`);
            
            await db.run(`CREATE INDEX idx_drink_counter_room_date ON drink_counter(room_id, date)`);
            
            await db.run(`CREATE INDEX idx_user_bongs_username_room ON user_bongs(username, room_id)`);
            await db.run(`CREATE INDEX idx_user_bongs_room_timestamp ON user_bongs(room_id, timestamp)`);
            
            await db.run(`CREATE INDEX idx_user_drinks_username_room ON user_drinks(username, room_id)`);
            await db.run(`CREATE INDEX idx_user_drinks_room_timestamp ON user_drinks(room_id, timestamp)`);
            
            await db.run(`CREATE INDEX idx_reminders_room ON reminders(room_id)`);
            
            await db.run(`CREATE INDEX idx_tells_room ON tells(room_id)`);
            
            await db.run(`CREATE INDEX idx_cooldowns_room ON cooldowns(room_id)`);
            
            // Insert initial room record for fatpizza
            await db.run(`
                INSERT INTO rooms (id, name, first_joined, last_active, is_active)
                VALUES ('fatpizza', 'fatpizza', ${Date.now()}, ${Date.now()}, 1)
            `);
            
            // Update existing primary keys for tables that need room_id in their primary key
            // For bong_counter - need to recreate table with new primary key
            await db.run(`
                CREATE TABLE bong_counter_new (
                    room_id TEXT NOT NULL DEFAULT 'fatpizza',
                    date TEXT NOT NULL,
                    count INTEGER DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (room_id, date)
                )
            `);
            await db.run(`INSERT INTO bong_counter_new (room_id, date, count, updated_at) SELECT room_id, date, count, updated_at FROM bong_counter`);
            await db.run(`DROP TABLE bong_counter`);
            await db.run(`ALTER TABLE bong_counter_new RENAME TO bong_counter`);
            
            // For drink_counter - need to recreate table with new primary key
            await db.run(`
                CREATE TABLE drink_counter_new (
                    room_id TEXT NOT NULL DEFAULT 'fatpizza',
                    date TEXT NOT NULL,
                    count INTEGER DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (room_id, date)
                )
            `);
            await db.run(`INSERT INTO drink_counter_new (room_id, date, count, updated_at) SELECT room_id, date, count, updated_at FROM drink_counter`);
            await db.run(`DROP TABLE drink_counter`);
            await db.run(`ALTER TABLE drink_counter_new RENAME TO drink_counter`);
            
            // Commit transaction
            await db.run('COMMIT');
            
            console.log('Successfully added room support to database schema');
        } catch (error) {
            // Rollback on error
            await db.run('ROLLBACK');
            throw error;
        }
    }

export const down = async (db) => {
    // This is a major structural change - down migration would lose data
    // Only implement if absolutely necessary
    throw new Error('Down migration not implemented for room support - would result in data loss');
};