export async function up(db) {
    console.log('Adding original_poster and most_recent_poster columns to user_images...');
    
    // SQLite doesn't support dropping constraints directly, so we need to recreate the table
    await db.run('BEGIN TRANSACTION');
    
    try {
        // Create new table with updated schema
        await db.run(`
            CREATE TABLE user_images_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                url TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                is_active INTEGER DEFAULT 1,
                pruned_reason TEXT,
                failure_count INTEGER DEFAULT 0,
                first_failure_at INTEGER,
                last_check_at INTEGER,
                next_check_at INTEGER,
                recheck_count INTEGER DEFAULT 0,
                original_poster TEXT,
                most_recent_poster TEXT,
                original_timestamp INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(url)
            )
        `);
        
        // Copy data to new table, setting new columns to match existing username/timestamp
        await db.run(`
            INSERT INTO user_images_new 
            SELECT 
                id, username, url, timestamp, is_active, pruned_reason,
                failure_count, first_failure_at, last_check_at, next_check_at,
                recheck_count, username, username, timestamp,
                created_at
            FROM user_images
        `);
        
        // Drop old table
        await db.run('DROP TABLE user_images');
        
        // Rename new table
        await db.run('ALTER TABLE user_images_new RENAME TO user_images');
        
        // Recreate all indexes
        await db.run('CREATE INDEX idx_user_images_username ON user_images(username)');
        await db.run('CREATE INDEX idx_user_images_timestamp ON user_images(timestamp)');
        await db.run('CREATE INDEX idx_user_images_active ON user_images(is_active)');
        await db.run('CREATE INDEX idx_user_images_next_check ON user_images(next_check_at) WHERE is_active = 0 AND next_check_at IS NOT NULL');
        await db.run('CREATE INDEX idx_user_images_original_poster ON user_images(original_poster)');
        await db.run('CREATE INDEX idx_user_images_most_recent_poster ON user_images(most_recent_poster)');
        await db.run('CREATE INDEX idx_user_images_url ON user_images(url)');
        
        await db.run('COMMIT');
        console.log('Successfully updated user_images table schema');
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
}

export async function down(db) {
    console.log('Reverting user_images table to previous schema...');
    
    await db.run('BEGIN TRANSACTION');
    
    try {
        // Create table with old schema
        await db.run(`
            CREATE TABLE user_images_old (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                url TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                is_active INTEGER DEFAULT 1,
                pruned_reason TEXT,
                failure_count INTEGER DEFAULT 0,
                first_failure_at INTEGER,
                last_check_at INTEGER,
                next_check_at INTEGER,
                recheck_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, url)
            )
        `);
        
        // Copy data back (using username as the owner)
        await db.run(`
            INSERT INTO user_images_old 
            SELECT 
                id, username, url, timestamp, is_active, pruned_reason,
                failure_count, first_failure_at, last_check_at, next_check_at,
                recheck_count, created_at
            FROM user_images
        `);
        
        // Drop new table
        await db.run('DROP TABLE user_images');
        
        // Rename old table
        await db.run('ALTER TABLE user_images_old RENAME TO user_images');
        
        // Recreate original indexes
        await db.run('CREATE INDEX idx_user_images_username ON user_images(username)');
        await db.run('CREATE INDEX idx_user_images_timestamp ON user_images(timestamp)');
        await db.run('CREATE INDEX idx_user_images_active ON user_images(is_active)');
        await db.run('CREATE INDEX idx_user_images_next_check ON user_images(next_check_at) WHERE is_active = 0 AND next_check_at IS NOT NULL');
        
        await db.run('COMMIT');
        console.log('Successfully reverted user_images table schema');
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    }
}