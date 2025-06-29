export const up = async (db) => {
        // Create pissing_contest_challenges table
        await db.run(`
            CREATE TABLE IF NOT EXISTS pissing_contest_challenges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                challenger TEXT NOT NULL,
                challenged TEXT NOT NULL,
                amount INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                challenger_characteristic TEXT,
                challenged_characteristic TEXT,
                location TEXT,
                weather TEXT,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                completed_at INTEGER,
                winner TEXT,
                challenger_distance REAL,
                challenger_volume REAL,
                challenger_aim REAL,
                challenger_duration REAL,
                challenger_total INTEGER,
                challenged_distance REAL,
                challenged_volume REAL,
                challenged_aim REAL,
                challenged_duration REAL,
                challenged_total INTEGER
            )
        `);

        // Create pissing_contest_stats table
        await db.run(`
            CREATE TABLE IF NOT EXISTS pissing_contest_stats (
                username TEXT PRIMARY KEY,
                total_matches INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                money_won INTEGER DEFAULT 0,
                money_lost INTEGER DEFAULT 0,
                best_distance REAL DEFAULT 0,
                best_volume REAL DEFAULT 0,
                best_aim REAL DEFAULT 0,
                best_duration REAL DEFAULT 0,
                avg_distance REAL DEFAULT 0,
                avg_volume REAL DEFAULT 0,
                avg_aim REAL DEFAULT 0,
                avg_duration REAL DEFAULT 0,
                rarest_characteristic TEXT,
                favorite_location TEXT,
                biggest_upset_win TEXT,
                last_played INTEGER,
                legendary_performances TEXT
            )
        `);

        // Create user_bladder table
        await db.run(`
            CREATE TABLE IF NOT EXISTS user_bladder (
                username TEXT PRIMARY KEY,
                current_amount INTEGER DEFAULT 0,
                last_drink_time INTEGER,
                drinks_since_piss TEXT DEFAULT '[]',
                last_piss_time INTEGER,
                created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
                updated_at INTEGER DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create pissing_contest_records table
        await db.run(`
            CREATE TABLE IF NOT EXISTS pissing_contest_records (
                record_type TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                value REAL NOT NULL,
                characteristic TEXT,
                location TEXT,
                achieved_at INTEGER NOT NULL
            )
        `);

        // Create indexes for performance
        await db.run('CREATE INDEX IF NOT EXISTS idx_pissing_challenges_status ON pissing_contest_challenges(status)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_pissing_challenges_challenger ON pissing_contest_challenges(challenger)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_pissing_challenges_challenged ON pissing_contest_challenges(challenged)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_pissing_stats_wins ON pissing_contest_stats(wins)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_pissing_stats_money_won ON pissing_contest_stats(money_won)');
};

export const down = async (db) => {
        await db.run('DROP TABLE IF EXISTS pissing_contest_challenges');
        await db.run('DROP TABLE IF EXISTS pissing_contest_stats');
        await db.run('DROP TABLE IF EXISTS user_bladder');
        await db.run('DROP TABLE IF EXISTS pissing_contest_records');
};