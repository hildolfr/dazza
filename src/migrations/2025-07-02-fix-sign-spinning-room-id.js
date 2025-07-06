import { createLogger } from '../utils/LoggerCompatibilityLayer.js';

const logger = createLogger('migrations');

export async function up(db) {
    logger.info('Fixing sign_spinning_stats table to support room_id...');
    
    await db.run('BEGIN TRANSACTION');
    
    try {
        // Create new table with room_id support
        await db.run(`
            CREATE TABLE IF NOT EXISTS sign_spinning_stats_new (
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
        
        // Copy existing data to new table
        await db.run(`
            INSERT INTO sign_spinning_stats_new 
            (username, room_id, total_spins, total_earnings, cars_hit, cops_called, 
             best_shift, worst_shift, perfect_days, last_played, created_at, updated_at)
            SELECT 
                username, 
                'fatpizza' as room_id,
                total_spins, 
                total_earnings, 
                cars_hit, 
                cops_called,
                best_shift, 
                worst_shift, 
                perfect_days, 
                last_played,
                created_at,
                updated_at
            FROM sign_spinning_stats
        `);
        
        // Drop old table
        await db.run('DROP TABLE sign_spinning_stats');
        
        // Rename new table
        await db.run('ALTER TABLE sign_spinning_stats_new RENAME TO sign_spinning_stats');
        
        // Recreate indexes
        await db.run('CREATE INDEX IF NOT EXISTS idx_sign_spinning_last_played ON sign_spinning_stats(last_played)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_sign_spinning_room ON sign_spinning_stats(room_id)');
        
        // Recreate trigger
        await db.run(`
            CREATE TRIGGER IF NOT EXISTS update_sign_spinning_stats_timestamp 
            AFTER UPDATE ON sign_spinning_stats
            FOR EACH ROW
            BEGIN
                UPDATE sign_spinning_stats 
                SET updated_at = CURRENT_TIMESTAMP 
                WHERE username = NEW.username AND room_id = NEW.room_id;
            END
        `);
        
        await db.run('COMMIT');
        logger.info('Successfully fixed sign_spinning_stats table with room_id support');
        
    } catch (error) {
        await db.run('ROLLBACK');
        logger.error('Failed to fix sign_spinning_stats table:', error);
        throw error;
    }
}

export async function down(db) {
    logger.info('Reverting sign_spinning_stats table to single-room version...');
    
    await db.run('BEGIN TRANSACTION');
    
    try {
        // Create old table structure
        await db.run(`
            CREATE TABLE IF NOT EXISTS sign_spinning_stats_old (
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
        
        // Copy data back (aggregating if multiple rooms exist)
        await db.run(`
            INSERT INTO sign_spinning_stats_old 
            (username, total_spins, total_earnings, cars_hit, cops_called, 
             best_shift, worst_shift, perfect_days, last_played, created_at, updated_at)
            SELECT 
                username,
                SUM(total_spins),
                SUM(total_earnings),
                SUM(cars_hit),
                SUM(cops_called),
                MAX(best_shift),
                MIN(worst_shift),
                SUM(perfect_days),
                MAX(last_played),
                MIN(created_at),
                MAX(updated_at)
            FROM sign_spinning_stats
            GROUP BY username
        `);
        
        // Drop new table
        await db.run('DROP TABLE sign_spinning_stats');
        
        // Rename old table
        await db.run('ALTER TABLE sign_spinning_stats_old RENAME TO sign_spinning_stats');
        
        // Recreate original indexes and trigger
        await db.run('CREATE INDEX IF NOT EXISTS idx_sign_spinning_last_played ON sign_spinning_stats(last_played)');
        
        await db.run(`
            CREATE TRIGGER IF NOT EXISTS update_sign_spinning_stats_timestamp 
            AFTER UPDATE ON sign_spinning_stats
            FOR EACH ROW
            BEGIN
                UPDATE sign_spinning_stats SET updated_at = CURRENT_TIMESTAMP WHERE username = NEW.username;
            END
        `);
        
        await db.run('COMMIT');
        logger.info('Successfully reverted sign_spinning_stats table');
        
    } catch (error) {
        await db.run('ROLLBACK');
        logger.error('Failed to revert sign_spinning_stats table:', error);
        throw error;
    }
}

export const meta = {
    version: 1,
    description: 'Fix sign_spinning_stats table to support multiple rooms'
};