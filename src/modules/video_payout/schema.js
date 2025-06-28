export const videoPayoutSchema = {
    async initialize(db) {
        // Track individual video sessions
        await db.run(`
            CREATE TABLE IF NOT EXISTS video_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                media_id TEXT,
                media_title TEXT,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                duration INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Track user participation in video sessions
        await db.run(`
            CREATE TABLE IF NOT EXISTS video_watchers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                join_time INTEGER NOT NULL,
                leave_time INTEGER,
                rewarded INTEGER DEFAULT 0,
                reward_amount INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES video_sessions(id)
            )
        `);

        // Create indexes for performance
        await db.run('CREATE INDEX IF NOT EXISTS idx_video_sessions_start_time ON video_sessions(start_time)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_video_watchers_session_id ON video_watchers(session_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_video_watchers_username ON video_watchers(username)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_video_watchers_rewarded ON video_watchers(rewarded)');
    }
};