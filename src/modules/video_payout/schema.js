export const videoPayoutSchema = {
    // SQL for creating video_payouts table  
    createVideoPayoutsTable: `
        CREATE TABLE IF NOT EXISTS video_payouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            video_id TEXT NOT NULL,
            payout_amount INTEGER NOT NULL,
            queued_at INTEGER NOT NULL,
            processed_at INTEGER,
            status TEXT DEFAULT 'queued',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, video_id)
        )
    `,

    // SQL for creating payout_history table
    createPayoutHistoryTable: `
        CREATE TABLE IF NOT EXISTS payout_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            video_id TEXT NOT NULL,
            video_title TEXT,
            payout_amount INTEGER NOT NULL,
            processed_at INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,

    // Index creation SQL
    createVideoPayoutsUserIndex: 'CREATE INDEX IF NOT EXISTS idx_video_payouts_username ON video_payouts(username)',
    createVideoPayoutsVideoIndex: 'CREATE INDEX IF NOT EXISTS idx_video_payouts_video_id ON video_payouts(video_id)',
    createVideoPayoutsQueuedIndex: 'CREATE INDEX IF NOT EXISTS idx_video_payouts_queued ON video_payouts(status, queued_at)',
    createVideoPayoutsTimestampIndex: 'CREATE INDEX IF NOT EXISTS idx_video_payouts_timestamp ON video_payouts(created_at)',
    createPayoutHistoryUserIndex: 'CREATE INDEX IF NOT EXISTS idx_payout_history_username ON payout_history(username)',
    createPayoutHistoryTimestampIndex: 'CREATE INDEX IF NOT EXISTS idx_payout_history_timestamp ON payout_history(processed_at)',

    // Keep the initialize method for backward compatibility
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
                room_id TEXT DEFAULT 'default',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Add room_id column if it doesn't exist (for migration)
        try {
            await db.run(`ALTER TABLE video_sessions ADD COLUMN room_id TEXT DEFAULT 'default'`);
        } catch (e) {
            // Column already exists, ignore error
        }

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
        await db.run('CREATE INDEX IF NOT EXISTS idx_video_sessions_room_id ON video_sessions(room_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_video_watchers_session_id ON video_watchers(session_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_video_watchers_username ON video_watchers(username)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_video_watchers_rewarded ON video_watchers(rewarded)');
    }
};