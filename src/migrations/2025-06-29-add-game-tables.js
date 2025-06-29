/**
 * Migration: Add game-related tables
 * Date: 2025-06-29
 * 
 * This migration adds tables for:
 * - command_cooldowns: Track per-user cooldowns for commands
 * - mystery_box_stats: Track mystery box game statistics
 * - couch_stats: Track couch diving game statistics
 * - coin_flip_stats: Track coin flip game statistics
 * - sign_spinning_stats: Track sign spinning game statistics
 * - mug_stats: Track mug game statistics
 * - coin_flip_challenges: Track coin flip challenges between users
 */

export const up = async (db) => {
    // Create command_cooldowns table
    await db.run(`
        CREATE TABLE IF NOT EXISTS command_cooldowns (
            user_id TEXT NOT NULL,
            command TEXT NOT NULL,
            last_used INTEGER NOT NULL,
            PRIMARY KEY (user_id, command)
        )
    `);
    
    // Create mystery_box_stats table
    await db.run(`
        CREATE TABLE IF NOT EXISTS mystery_box_stats (
            username TEXT PRIMARY KEY,
            total_opens INTEGER DEFAULT 0,
            total_winnings INTEGER DEFAULT 0,
            jackpots_won INTEGER DEFAULT 0,
            bombs_hit INTEGER DEFAULT 0,
            best_win INTEGER DEFAULT 0,
            worst_loss INTEGER DEFAULT 0,
            current_streak INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0,
            last_played INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Create couch_stats table
    await db.run(`
        CREATE TABLE IF NOT EXISTS couch_stats (
            username TEXT PRIMARY KEY,
            total_dives INTEGER DEFAULT 0,
            successful_dives INTEGER DEFAULT 0,
            total_found INTEGER DEFAULT 0,
            best_find INTEGER DEFAULT 0,
            injuries INTEGER DEFAULT 0,
            hospital_trips INTEGER DEFAULT 0,
            last_played INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Create coin_flip_stats table
    await db.run(`
        CREATE TABLE IF NOT EXISTS coin_flip_stats (
            username TEXT PRIMARY KEY,
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
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Create sign_spinning_stats table
    await db.run(`
        CREATE TABLE IF NOT EXISTS sign_spinning_stats (
            username TEXT PRIMARY KEY,
            total_spins INTEGER DEFAULT 0,
            total_earnings INTEGER DEFAULT 0,
            cars_hit INTEGER DEFAULT 0,
            cops_called INTEGER DEFAULT 0,
            best_shift INTEGER DEFAULT 0,
            worst_shift INTEGER DEFAULT 0,
            perfect_days INTEGER DEFAULT 0,
            last_played INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Create mug_stats table
    await db.run(`
        CREATE TABLE IF NOT EXISTS mug_stats (
            username TEXT PRIMARY KEY,
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
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Create coin_flip_challenges table
    await db.run(`
        CREATE TABLE IF NOT EXISTS coin_flip_challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            challenger TEXT NOT NULL,
            challenged TEXT NOT NULL,
            amount INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            challenger_choice TEXT,
            challenged_choice TEXT,
            result TEXT,
            winner TEXT,
            created_at INTEGER NOT NULL,
            resolved_at INTEGER,
            expires_at INTEGER NOT NULL
        )
    `);
    
    // Create indexes for better performance
    await db.run('CREATE INDEX IF NOT EXISTS idx_command_cooldowns_user ON command_cooldowns(user_id)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_command_cooldowns_command ON command_cooldowns(command)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_mystery_box_last_played ON mystery_box_stats(last_played)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_couch_stats_last_played ON couch_stats(last_played)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_coin_flip_stats_last_played ON coin_flip_stats(last_played)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_sign_spinning_last_played ON sign_spinning_stats(last_played)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_mug_stats_last_played ON mug_stats(last_played)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_mug_stats_heat_level ON mug_stats(current_heat_level)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_coin_flip_challenges_status ON coin_flip_challenges(status)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_coin_flip_challenges_challenger ON coin_flip_challenges(challenger)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_coin_flip_challenges_challenged ON coin_flip_challenges(challenged)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_coin_flip_challenges_expires ON coin_flip_challenges(expires_at)');
    
    // Create triggers to update the updated_at timestamp
    const tables = [
        'mystery_box_stats',
        'couch_stats', 
        'coin_flip_stats',
        'sign_spinning_stats',
        'mug_stats'
    ];
    
    for (const table of tables) {
        await db.run(`
            CREATE TRIGGER IF NOT EXISTS update_${table}_timestamp 
            AFTER UPDATE ON ${table}
            FOR EACH ROW
            BEGIN
                UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE username = NEW.username;
            END
        `);
    }
    
    console.log('Successfully created game-related tables and indexes');
};

export const down = async (db) => {
    // Drop triggers first
    const tables = [
        'mystery_box_stats',
        'couch_stats',
        'coin_flip_stats', 
        'sign_spinning_stats',
        'mug_stats'
    ];
    
    for (const table of tables) {
        await db.run(`DROP TRIGGER IF EXISTS update_${table}_timestamp`);
    }
    
    // Drop indexes
    await db.run('DROP INDEX IF EXISTS idx_command_cooldowns_user');
    await db.run('DROP INDEX IF EXISTS idx_command_cooldowns_command');
    await db.run('DROP INDEX IF EXISTS idx_mystery_box_last_played');
    await db.run('DROP INDEX IF EXISTS idx_couch_stats_last_played');
    await db.run('DROP INDEX IF EXISTS idx_coin_flip_stats_last_played');
    await db.run('DROP INDEX IF EXISTS idx_sign_spinning_last_played');
    await db.run('DROP INDEX IF EXISTS idx_mug_stats_last_played');
    await db.run('DROP INDEX IF EXISTS idx_mug_stats_heat_level');
    await db.run('DROP INDEX IF EXISTS idx_coin_flip_challenges_status');
    await db.run('DROP INDEX IF EXISTS idx_coin_flip_challenges_challenger');
    await db.run('DROP INDEX IF EXISTS idx_coin_flip_challenges_challenged');
    await db.run('DROP INDEX IF EXISTS idx_coin_flip_challenges_expires');
    
    // Drop tables
    await db.run('DROP TABLE IF EXISTS command_cooldowns');
    await db.run('DROP TABLE IF EXISTS mystery_box_stats');
    await db.run('DROP TABLE IF EXISTS couch_stats');
    await db.run('DROP TABLE IF EXISTS coin_flip_stats');
    await db.run('DROP TABLE IF EXISTS sign_spinning_stats');
    await db.run('DROP TABLE IF EXISTS mug_stats');
    await db.run('DROP TABLE IF EXISTS coin_flip_challenges');
    
    console.log('Successfully dropped game-related tables');
};