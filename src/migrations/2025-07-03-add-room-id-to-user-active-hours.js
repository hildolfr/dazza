export const up = async (db) => {
    // Drop the existing table and recreate with new schema
    // SQLite doesn't support adding columns with constraints easily
    await db.run('DROP TABLE IF EXISTS user_active_hours');
    
    // Recreate with the new schema that matches ActiveHoursAnalyzer expectations
    await db.run(`
        CREATE TABLE user_active_hours (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            room_id TEXT NOT NULL DEFAULT 'fatpizza',
            hour INTEGER NOT NULL,
            message_count INTEGER DEFAULT 0,
            word_count INTEGER DEFAULT 0,
            avg_message_length INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, room_id, hour)
        )
    `);
    
    // Recreate the index
    await db.run('CREATE INDEX idx_user_active_hours_username ON user_active_hours(username)');
};

export const down = async (db) => {
    // Revert to original schema
    await db.run('DROP TABLE IF EXISTS user_active_hours');
    
    await db.run(`
        CREATE TABLE user_active_hours (
            username TEXT NOT NULL,
            hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
            message_count INTEGER DEFAULT 0,
            word_count INTEGER DEFAULT 0,
            avg_message_length REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (username, hour)
        )
    `);
    
    await db.run('CREATE INDEX idx_user_active_hours_username ON user_active_hours(username)');
};