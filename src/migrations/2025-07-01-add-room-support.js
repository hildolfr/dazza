/**
 * Migration: Add room support to database schema
 * 
 * This migration adds room_id columns to all tables that need room context
 * and sets existing data to 'fatpizza' as the default room.
 */

export const up = async (db, logger = console) => {
        // Start transaction
        await db.run('BEGIN TRANSACTION');
        
        try {
            // Helper function to check if column exists
            const columnExists = async (tableName, columnName) => {
                const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
                return tableInfo.some(col => col.name === columnName);
            };
            
            // Helper function to check if table exists
            const tableExists = async (tableName) => {
                const result = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName]);
                return !!result;
            };
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
            
            // Add room_id to tables that need it
            const tables = [
                'messages', 'user_events', 'posted_urls', 'heist_events', 
                'coin_flip_challenges', 'pissing_contest_challenges', 
                'bong_counter', 'drink_counter', 'user_bongs', 'user_drinks',
                'reminders', 'tells', 'cooldowns'
            ];
            
            for (const table of tables) {
                if (await tableExists(table) && !(await columnExists(table, 'room_id'))) {
                    await db.run(`ALTER TABLE ${table} ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
                }
            }
            
            // Create composite indexes for better query performance
            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_messages_username_room ON messages(username, room_id)',
                'CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp ON messages(room_id, timestamp)',
                'CREATE INDEX IF NOT EXISTS idx_user_events_username_room ON user_events(username, room_id)',
                'CREATE INDEX IF NOT EXISTS idx_user_events_room_timestamp ON user_events(room_id, timestamp)',
                'CREATE INDEX IF NOT EXISTS idx_posted_urls_room ON posted_urls(room_id)',
                'CREATE INDEX IF NOT EXISTS idx_heist_events_room ON heist_events(room_id)',
                'CREATE INDEX IF NOT EXISTS idx_coin_flip_challenges_room ON coin_flip_challenges(room_id)',
                'CREATE INDEX IF NOT EXISTS idx_pissing_contest_challenges_room ON pissing_contest_challenges(room_id)',
                'CREATE INDEX IF NOT EXISTS idx_bong_counter_room_date ON bong_counter(room_id, date)',
                'CREATE INDEX IF NOT EXISTS idx_drink_counter_room_date ON drink_counter(room_id, date)',
                'CREATE INDEX IF NOT EXISTS idx_user_bongs_username_room ON user_bongs(username, room_id)',
                'CREATE INDEX IF NOT EXISTS idx_user_bongs_room_timestamp ON user_bongs(room_id, timestamp)',
                'CREATE INDEX IF NOT EXISTS idx_user_drinks_username_room ON user_drinks(username, room_id)',
                'CREATE INDEX IF NOT EXISTS idx_user_drinks_room_timestamp ON user_drinks(room_id, timestamp)',
                'CREATE INDEX IF NOT EXISTS idx_reminders_room ON reminders(room_id)',
                'CREATE INDEX IF NOT EXISTS idx_tells_room ON tells(room_id)',
                'CREATE INDEX IF NOT EXISTS idx_cooldowns_room ON cooldowns(room_id)'
            ];
            
            for (const indexSQL of indexes) {
                await db.run(indexSQL);
            }
            
            // Insert initial room record for fatpizza if it doesn't exist
            const existingRoom = await db.get('SELECT id FROM rooms WHERE id = ?', ['fatpizza']);
            if (!existingRoom) {
                await db.run(`
                    INSERT INTO rooms (id, name, first_joined, last_active, is_active)
                    VALUES ('fatpizza', 'fatpizza', ${Date.now()}, ${Date.now()}, 1)
                `);
            }
            
            // Update existing primary keys for tables that need room_id in their primary key
            // Only do this if the table doesn't already have room_id in primary key
            
            // Check bong_counter primary key
            const bongCounterInfo = await db.all("PRAGMA table_info(bong_counter)");
            const bongCounterPK = bongCounterInfo.filter(col => col.pk > 0).map(col => col.name);
            if (await tableExists('bong_counter') && !bongCounterPK.includes('room_id')) {
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
            }
            
            // Check drink_counter primary key
            const drinkCounterInfo = await db.all("PRAGMA table_info(drink_counter)");
            const drinkCounterPK = drinkCounterInfo.filter(col => col.pk > 0).map(col => col.name);
            if (await tableExists('drink_counter') && !drinkCounterPK.includes('room_id')) {
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
            }
            
            // Commit transaction
            await db.run('COMMIT');
            
            logger.info('Successfully added room support to database schema');
        } catch (error) {
            // Rollback on error
            await db.run('ROLLBACK');
            throw error;
        }
    }

export const down = async (db, logger = console) => {
    // This is a major structural change - down migration would lose data
    // Only implement if absolutely necessary
    throw new Error('Down migration not implemented for room support - would result in data loss');
};