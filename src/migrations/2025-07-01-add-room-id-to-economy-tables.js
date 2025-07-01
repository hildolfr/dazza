/**
 * Migration: Add room_id to economy-related tables
 * Date: 2025-07-01
 * 
 * This migration adds room_id columns to economy and game-related tables
 * that were missing room support.
 */

export const up = async (db) => {
    // Start transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
        // Check if economy_transactions table exists, create if not
        await db.run(`
            CREATE TABLE IF NOT EXISTS economy_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                balance_before INTEGER,
                balance_after INTEGER,
                description TEXT,
                metadata TEXT,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Add room_id to user_bladder table
        await db.run(`ALTER TABLE user_bladder ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
        
        // Add room_id to economy_transactions table
        await db.run(`ALTER TABLE economy_transactions ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
        
        // Add room_id to mug_stats table
        await db.run(`ALTER TABLE mug_stats ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
        
        // coin_flip_challenges already has room_id from previous migration
        // Just verify it exists
        const coinFlipCheck = await db.get(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='coin_flip_challenges'
        `);
        
        if (coinFlipCheck && !coinFlipCheck.sql.includes('room_id')) {
            await db.run(`ALTER TABLE coin_flip_challenges ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
        }
        
        // Add room_id to coin_flip_stats table
        await db.run(`ALTER TABLE coin_flip_stats ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
        
        // Add room_id to sign_spinning_stats table
        await db.run(`ALTER TABLE sign_spinning_stats ADD COLUMN room_id TEXT NOT NULL DEFAULT 'fatpizza'`);
        
        // Update existing tables that need room_id in their primary key
        // For user_bladder - need to recreate table with new primary key
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
        await db.run(`INSERT INTO user_bladder_new (username, room_id, current_amount, last_drink_time, drinks_since_piss, last_piss_time, created_at, updated_at) 
                     SELECT username, room_id, current_amount, last_drink_time, drinks_since_piss, last_piss_time, created_at, updated_at FROM user_bladder`);
        await db.run(`DROP TABLE user_bladder`);
        await db.run(`ALTER TABLE user_bladder_new RENAME TO user_bladder`);
        
        // For mug_stats - need to recreate table with new primary key
        await db.run(`
            CREATE TABLE mug_stats_new (
                username TEXT NOT NULL,
                room_id TEXT NOT NULL DEFAULT 'fatpizza',
                total_mugs INTEGER DEFAULT 0,
                successful_mugs INTEGER DEFAULT 0,
                failed_mugs INTEGER DEFAULT 0,
                total_stolen INTEGER DEFAULT 0,
                total_lost INTEGER DEFAULT 0,
                biggest_score INTEGER DEFAULT 0,
                times_arrested INTEGER DEFAULT 0,
                times_mugged INTEGER DEFAULT 0,
                hospital_trips INTEGER DEFAULT 0,
                current_heat_level INTEGER DEFAULT 0,
                last_mugged_by TEXT,
                last_mugged_at INTEGER,
                last_played INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (username, room_id)
            )
        `);
        await db.run(`INSERT INTO mug_stats_new (username, room_id, total_mugs, successful_mugs, failed_mugs, total_stolen, total_lost, biggest_score, times_arrested, times_mugged, hospital_trips, current_heat_level, last_mugged_by, last_mugged_at, last_played, created_at, updated_at) 
                     SELECT username, room_id, total_mugs, successful_mugs, failed_mugs, total_stolen, total_lost, biggest_score, times_arrested, times_mugged, hospital_trips, current_heat_level, last_mugged_by, last_mugged_at, last_played, created_at, updated_at FROM mug_stats`);
        await db.run(`DROP TABLE mug_stats`);
        await db.run(`ALTER TABLE mug_stats_new RENAME TO mug_stats`);
        
        // For coin_flip_stats - need to recreate table with new primary key
        await db.run(`
            CREATE TABLE coin_flip_stats_new (
                username TEXT NOT NULL,
                room_id TEXT NOT NULL DEFAULT 'fatpizza',
                total_flips INTEGER DEFAULT 0,
                heads_count INTEGER DEFAULT 0,
                tails_count INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                total_wagered INTEGER DEFAULT 0,
                total_won INTEGER DEFAULT 0,
                total_lost INTEGER DEFAULT 0,
                biggest_win INTEGER DEFAULT 0,
                biggest_loss INTEGER DEFAULT 0,
                current_streak INTEGER DEFAULT 0,
                best_win_streak INTEGER DEFAULT 0,
                worst_loss_streak INTEGER DEFAULT 0,
                last_played INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (username, room_id)
            )
        `);
        await db.run(`INSERT INTO coin_flip_stats_new (username, room_id, total_flips, heads_count, tails_count, wins, losses, total_wagered, total_won, total_lost, biggest_win, biggest_loss, current_streak, best_win_streak, worst_loss_streak, last_played, created_at, updated_at) 
                     SELECT username, room_id, total_flips, heads_count, tails_count, wins, losses, total_wagered, total_won, total_lost, biggest_win, biggest_loss, current_streak, best_win_streak, worst_loss_streak, last_played, created_at, updated_at FROM coin_flip_stats`);
        await db.run(`DROP TABLE coin_flip_stats`);
        await db.run(`ALTER TABLE coin_flip_stats_new RENAME TO coin_flip_stats`);
        
        // For sign_spinning_stats - need to recreate table with new primary key
        await db.run(`
            CREATE TABLE sign_spinning_stats_new (
                username TEXT NOT NULL,
                room_id TEXT NOT NULL DEFAULT 'fatpizza',
                total_spins INTEGER DEFAULT 0,
                total_earnings INTEGER DEFAULT 0,
                cars_hit INTEGER DEFAULT 0,
                cops_called INTEGER DEFAULT 0,
                best_shift INTEGER DEFAULT 0,
                worst_shift INTEGER DEFAULT 0,
                perfect_days INTEGER DEFAULT 0,
                last_played INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (username, room_id)
            )
        `);
        await db.run(`INSERT INTO sign_spinning_stats_new (username, room_id, total_spins, total_earnings, cars_hit, cops_called, best_shift, worst_shift, perfect_days, last_played, created_at, updated_at) 
                     SELECT username, room_id, total_spins, total_earnings, cars_hit, cops_called, best_shift, worst_shift, perfect_days, last_played, created_at, updated_at FROM sign_spinning_stats`);
        await db.run(`DROP TABLE sign_spinning_stats`);
        await db.run(`ALTER TABLE sign_spinning_stats_new RENAME TO sign_spinning_stats`);
        
        // Create indexes for better performance
        await db.run('CREATE INDEX IF NOT EXISTS idx_user_bladder_username_room ON user_bladder(username, room_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_economy_transactions_username_room ON economy_transactions(username, room_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_economy_transactions_room_timestamp ON economy_transactions(room_id, timestamp)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_economy_transactions_type_room ON economy_transactions(transaction_type, room_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_mug_stats_username_room ON mug_stats(username, room_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_mug_stats_room_heat ON mug_stats(room_id, current_heat_level)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_coin_flip_stats_username_room ON coin_flip_stats(username, room_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_sign_spinning_stats_username_room ON sign_spinning_stats(username, room_id)');
        
        // Re-create triggers for updated_at timestamp
        const tables = [
            'mug_stats',
            'coin_flip_stats',
            'sign_spinning_stats'
        ];
        
        for (const table of tables) {
            // Drop old trigger if exists
            await db.run(`DROP TRIGGER IF EXISTS update_${table}_timestamp`);
            
            // Create new trigger with room_id in WHERE clause
            await db.run(`
                CREATE TRIGGER update_${table}_timestamp 
                AFTER UPDATE ON ${table}
                FOR EACH ROW
                BEGIN
                    UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP 
                    WHERE username = NEW.username AND room_id = NEW.room_id;
                END
            `);
        }
        
        // Commit transaction
        await db.run('COMMIT');
        
        console.log('Successfully added room_id to economy-related tables');
    } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        throw error;
    }
};

export const down = async (db) => {
    // This is a major structural change - down migration would lose data
    // Only implement if absolutely necessary
    throw new Error('Down migration not implemented for room_id addition to economy tables - would result in data loss');
};