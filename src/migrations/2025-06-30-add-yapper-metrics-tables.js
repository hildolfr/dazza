export const up = async (db, logger = console) => {
        // Add word count columns to existing tables
        await db.run(`
            ALTER TABLE user_stats 
            ADD COLUMN total_words INTEGER DEFAULT 0
        `);
        
        await db.run(`
            ALTER TABLE messages 
            ADD COLUMN word_count INTEGER DEFAULT NULL
        `);

        // User daily activity for streak tracking
        await db.run(`
            CREATE TABLE IF NOT EXISTS user_daily_activity (
                username TEXT NOT NULL,
                date TEXT NOT NULL,
                message_count INTEGER DEFAULT 0,
                word_count INTEGER DEFAULT 0,
                first_message_time INTEGER,
                last_message_time INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (username, date)
            )
        `);

        // User chat streaks
        await db.run(`
            CREATE TABLE IF NOT EXISTS user_chat_streaks (
                username TEXT PRIMARY KEY,
                current_streak INTEGER DEFAULT 0,
                best_streak INTEGER DEFAULT 0,
                last_active_date TEXT,
                streak_start_date TEXT,
                total_active_days INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // User active hours (aggregated by hour of day)
        await db.run(`
            CREATE TABLE IF NOT EXISTS user_active_hours (
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

        // Message analysis cache
        await db.run(`
            CREATE TABLE IF NOT EXISTS message_analysis_cache (
                username TEXT PRIMARY KEY,
                total_messages INTEGER DEFAULT 0,
                total_words INTEGER DEFAULT 0,
                avg_message_length REAL DEFAULT 0,
                avg_words_per_message REAL DEFAULT 0,
                emoji_count INTEGER DEFAULT 0,
                emoji_usage_rate REAL DEFAULT 0,
                caps_count INTEGER DEFAULT 0,
                caps_usage_rate REAL DEFAULT 0,
                question_count INTEGER DEFAULT 0,
                exclamation_count INTEGER DEFAULT 0,
                url_count INTEGER DEFAULT 0,
                mention_count INTEGER DEFAULT 0,
                longest_message INTEGER DEFAULT 0,
                shortest_message INTEGER DEFAULT 0,
                vocabulary_size INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Chat achievements
        await db.run(`
            CREATE TABLE IF NOT EXISTS chat_achievements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                achievement_type TEXT NOT NULL,
                achievement_level TEXT DEFAULT 'bronze',
                achieved_at INTEGER NOT NULL,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, achievement_type, achievement_level)
            )
        `);

        // Achievement definitions
        await db.run(`
            CREATE TABLE IF NOT EXISTS achievement_definitions (
                type TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                bronze_threshold INTEGER,
                silver_threshold INTEGER,
                gold_threshold INTEGER,
                diamond_threshold INTEGER,
                icon TEXT,
                category TEXT DEFAULT 'chat',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert achievement definitions for chat
        await db.run(`
            INSERT OR IGNORE INTO achievement_definitions 
            (type, name, description, bronze_threshold, silver_threshold, gold_threshold, diamond_threshold, icon, category)
            VALUES
            ('message_count', 'Chatterbox', 'Send messages in chat', 100, 1000, 10000, 50000, '💬', 'chat'),
            ('word_count', 'Wordsmith', 'Type words in chat', 1000, 10000, 100000, 1000000, '📝', 'chat'),
            ('streak_days', 'Dedicated', 'Chat consecutive days', 7, 30, 100, 365, '🔥', 'chat'),
            ('active_days', 'Regular', 'Total days active', 10, 50, 200, 500, '📅', 'chat'),
            ('night_owl', 'Night Owl', 'Messages sent 12AM-6AM', 50, 250, 1000, 5000, '🦉', 'chat'),
            ('early_bird', 'Early Bird', 'Messages sent 6AM-9AM', 50, 250, 1000, 5000, '🐦', 'chat'),
            ('emoji_user', 'Emoji Master', 'Use emojis in messages', 100, 500, 2000, 10000, '😄', 'chat'),
            ('caps_lock', 'LOUD TALKER', 'MESSAGES IN ALL CAPS', 20, 100, 500, 2000, '📢', 'chat'),
            ('question_asker', 'Curious Mind', 'Ask questions', 50, 250, 1000, 5000, '❓', 'chat'),
            ('link_sharer', 'Link Master', 'Share URLs', 25, 100, 500, 2000, '🔗', 'chat'),
            ('vocabulary', 'Vocabulary King', 'Unique words used', 500, 2000, 5000, 10000, '📚', 'chat'),
            ('longest_msg', 'Essay Writer', 'Longest single message', 100, 250, 500, 1000, '📜', 'chat')
        `);

        // Create indexes for performance
        await db.run('CREATE INDEX IF NOT EXISTS idx_user_daily_activity_username ON user_daily_activity(username)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_user_daily_activity_date ON user_daily_activity(date)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_user_active_hours_username ON user_active_hours(username)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_chat_achievements_username ON chat_achievements(username)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_messages_word_count ON messages(word_count) WHERE word_count IS NOT NULL');
};

export const down = async (db, logger = console) => {
        // Drop new tables
        await db.run('DROP TABLE IF EXISTS chat_achievements');
        await db.run('DROP TABLE IF EXISTS achievement_definitions');
        await db.run('DROP TABLE IF EXISTS message_analysis_cache');
        await db.run('DROP TABLE IF EXISTS user_active_hours');
        await db.run('DROP TABLE IF EXISTS user_chat_streaks');
        await db.run('DROP TABLE IF EXISTS user_daily_activity');
        
        // Remove columns (SQLite doesn't support DROP COLUMN, would need to recreate tables)
        // For now, we'll leave the columns as they don't hurt
        logger.info('Note: word_count columns in messages and user_stats tables were not removed (SQLite limitation)');
};