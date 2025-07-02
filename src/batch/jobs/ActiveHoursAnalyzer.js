import { BatchJob } from '../BatchJob.js';

export class ActiveHoursAnalyzer extends BatchJob {
    constructor(db, logger, timezoneOffset = 0) {
        super('ActiveHoursAnalyzer', db, logger);
        // Ensure timezoneOffset is a valid number
        this.timezoneOffset = parseInt(timezoneOffset) || 0; // Hours offset from UTC
        this.batchSize = 10000;
    }

    async execute() {
        const startTime = Date.now();
        
        try {
            // Clear existing data (we'll rebuild it completely for accuracy)
            await this.db.run('DELETE FROM user_active_hours');
        } catch (error) {
            this.logger.error(`[ActiveHoursAnalyzer] Failed to delete from user_active_hours: ${error.message}`);
            throw error;
        }
        
        // Process messages grouped by user and hour
        let hourlyStats;
        try {
            hourlyStats = await this.db.all(`
                SELECT 
                    LOWER(username) as username,
                    CAST(strftime('%H', datetime(timestamp / 1000, 'unixepoch', ? || ' hours')) AS INTEGER) as hour,
                    COUNT(*) as message_count,
                    SUM(COALESCE(word_count, 0)) as word_count,
                    AVG(LENGTH(message)) as avg_message_length
                FROM messages
                WHERE LOWER(username) != ?
                    AND username NOT LIKE '[%]'
                GROUP BY LOWER(username), hour
            `, [this.timezoneOffset >= 0 ? `+${this.timezoneOffset}` : `${this.timezoneOffset}`, this.db.botUsername]);
        } catch (error) {
            this.logger.error(`[ActiveHoursAnalyzer] Failed to query messages: ${error.message}`);
            // Check if it's the word_count column issue
            if (error.message.includes('word_count')) {
                this.logger.error(`[ActiveHoursAnalyzer] The messages table is missing the word_count column. Migration may not have run properly.`);
            }
            throw error;
        }

        this.logger.info(`[ActiveHoursAnalyzer] Processing ${hourlyStats.length} user-hour combinations`);

        if (hourlyStats.length === 0) {
            return 0;
        }

        // Insert in batches
        await this.db.run('BEGIN TRANSACTION');
        try {
            for (const stat of hourlyStats) {
                await this.db.run(`
                    INSERT INTO user_active_hours 
                    (username, hour, message_count, word_count, avg_message_length)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    stat.username,
                    stat.hour,
                    stat.message_count,
                    stat.word_count || 0,
                    Math.round(stat.avg_message_length || 0)
                ]);
            }
            
            await this.db.run('COMMIT');
            
            // Calculate and store user activity summaries
            await this.calculateActivitySummaries();
            
        } catch (error) {
            await this.db.run('ROLLBACK');
            throw error;
        }

        const duration = Date.now() - startTime;
        this.logger.info(
            `[ActiveHoursAnalyzer] Processed ${hourlyStats.length} records in ${Math.round(duration / 1000)}s`
        );

        return hourlyStats.length;
    }

    async calculateActivitySummaries() {
        // Create a summary table if it doesn't exist
        await this.db.run(`
            CREATE TABLE IF NOT EXISTS user_activity_summary (
                username TEXT PRIMARY KEY,
                most_active_hour INTEGER,
                least_active_hour INTEGER,
                morning_messages INTEGER DEFAULT 0,
                afternoon_messages INTEGER DEFAULT 0,
                evening_messages INTEGER DEFAULT 0,
                night_messages INTEGER DEFAULT 0,
                night_owl_score REAL DEFAULT 0,
                early_bird_score REAL DEFAULT 0,
                consistency_score REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Calculate summaries for each user
        const users = await this.db.all(
            'SELECT DISTINCT username FROM user_active_hours'
        );

        for (const user of users) {
            const stats = await this.getUserHourlyStats(user.username);
            await this.db.run(`
                INSERT INTO user_activity_summary 
                (username, most_active_hour, least_active_hour, 
                 morning_messages, afternoon_messages, evening_messages, night_messages,
                 night_owl_score, early_bird_score, consistency_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    most_active_hour = excluded.most_active_hour,
                    least_active_hour = excluded.least_active_hour,
                    morning_messages = excluded.morning_messages,
                    afternoon_messages = excluded.afternoon_messages,
                    evening_messages = excluded.evening_messages,
                    night_messages = excluded.night_messages,
                    night_owl_score = excluded.night_owl_score,
                    early_bird_score = excluded.early_bird_score,
                    consistency_score = excluded.consistency_score,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                user.username,
                stats.mostActiveHour,
                stats.leastActiveHour,
                stats.morningMessages,
                stats.afternoonMessages,
                stats.eveningMessages,
                stats.nightMessages,
                stats.nightOwlScore,
                stats.earlyBirdScore,
                stats.consistencyScore
            ]);
        }
    }

    async getUserHourlyStats(username) {
        const hourlyData = await this.db.all(`
            SELECT hour, message_count
            FROM user_active_hours
            WHERE username = ?
            ORDER BY hour
        `, [username]);

        // Initialize hours with 0 messages
        const hourMap = new Map();
        for (let i = 0; i < 24; i++) {
            hourMap.set(i, 0);
        }

        // Fill in actual data
        let totalMessages = 0;
        for (const data of hourlyData) {
            hourMap.set(data.hour, data.message_count);
            totalMessages += data.message_count;
        }

        // Calculate time period totals
        let morningMessages = 0; // 6-12
        let afternoonMessages = 0; // 12-18
        let eveningMessages = 0; // 18-24
        let nightMessages = 0; // 0-6

        let maxHour = 0;
        let maxCount = 0;
        let minHour = 0;
        let minCount = totalMessages;

        for (let [hour, count] of hourMap) {
            if (hour >= 6 && hour < 12) morningMessages += count;
            else if (hour >= 12 && hour < 18) afternoonMessages += count;
            else if (hour >= 18) eveningMessages += count;
            else nightMessages += count;

            if (count > maxCount) {
                maxCount = count;
                maxHour = hour;
            }
            if (count < minCount && count > 0) {
                minCount = count;
                minHour = hour;
            }
        }

        // Calculate scores
        const nightOwlScore = totalMessages > 0 
            ? (nightMessages / totalMessages) * 100 
            : 0;
        
        const earlyBirdScore = totalMessages > 0 
            ? (morningMessages / totalMessages) * 100 
            : 0;

        // Calculate consistency (standard deviation)
        const avgPerHour = totalMessages / 24;
        let variance = 0;
        for (let count of hourMap.values()) {
            variance += Math.pow(count - avgPerHour, 2);
        }
        const stdDev = Math.sqrt(variance / 24);
        const consistencyScore = avgPerHour > 0 
            ? Math.max(0, 100 - (stdDev / avgPerHour * 100))
            : 0;

        return {
            mostActiveHour: maxHour,
            leastActiveHour: minHour,
            morningMessages,
            afternoonMessages,
            eveningMessages,
            nightMessages,
            nightOwlScore: Math.round(nightOwlScore * 10) / 10,
            earlyBirdScore: Math.round(earlyBirdScore * 10) / 10,
            consistencyScore: Math.round(consistencyScore * 10) / 10
        };
    }

    // Get user's activity heatmap
    async getUserActivityHeatmap(username) {
        return await this.db.all(`
            SELECT 
                hour,
                message_count,
                word_count,
                avg_message_length
            FROM user_active_hours
            WHERE username = ?
            ORDER BY hour
        `, [username.toLowerCase()]);
    }

    // Get peak hours across all users
    async getGlobalPeakHours() {
        return await this.db.all(`
            SELECT 
                hour,
                SUM(message_count) as total_messages,
                COUNT(DISTINCT username) as active_users,
                AVG(message_count) as avg_messages_per_user
            FROM user_active_hours
            GROUP BY hour
            ORDER BY total_messages DESC
        `);
    }

    // Get night owls and early birds
    async getTimePatternUsers(limit = 10) {
        const nightOwls = await this.db.all(`
            SELECT 
                username,
                night_owl_score,
                night_messages as messages_0_to_6am
            FROM user_activity_summary
            WHERE night_owl_score > 30
            ORDER BY night_owl_score DESC
            LIMIT ?
        `, [limit]);

        const earlyBirds = await this.db.all(`
            SELECT 
                username,
                early_bird_score,
                morning_messages as messages_6am_to_noon
            FROM user_activity_summary
            WHERE early_bird_score > 30
            ORDER BY early_bird_score DESC
            LIMIT ?
        `, [limit]);

        return { nightOwls, earlyBirds };
    }
}