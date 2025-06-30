export async function up(db) {
    // Add hour column to user_bongs
    await db.run(`
        ALTER TABLE user_bongs ADD COLUMN hour INTEGER
    `);
    
    // Create bong_sessions table
    await db.run(`
        CREATE TABLE IF NOT EXISTS bong_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            session_start INTEGER NOT NULL,
            session_end INTEGER NOT NULL,
            cone_count INTEGER NOT NULL,
            max_cones_per_hour REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, session_start)
        )
    `);
    
    await db.run(`CREATE INDEX idx_bong_sessions_username ON bong_sessions(username)`);
    await db.run(`CREATE INDEX idx_bong_sessions_start ON bong_sessions(session_start)`);
    
    // Create user_bong_streaks table
    await db.run(`
        CREATE TABLE IF NOT EXISTS user_bong_streaks (
            username TEXT PRIMARY KEY,
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_bong_date TEXT,
            streak_start_date TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

export async function down(db) {
    // Revert changes in reverse order
    await db.run('DROP TABLE IF EXISTS user_bong_streaks');
    await db.run('DROP TABLE IF EXISTS bong_sessions');
    
    // SQLite doesn't support dropping columns easily, so we'd need to recreate the table
    // For now, we'll leave the hour column in place during rollback
}