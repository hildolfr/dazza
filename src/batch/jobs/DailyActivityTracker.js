import { BatchJob } from '../BatchJob.js';

export class DailyActivityTracker extends BatchJob {
    constructor(db, logger) {
        super('DailyActivityTracker', db, logger);
        this.batchSize = 5000;
    }

    async execute() {
        const startTime = Date.now();
        
        // Get the last processed date
        const lastProcessed = await this.db.get(
            'SELECT MAX(date) as last_date FROM user_daily_activity'
        );
        
        const lastDate = lastProcessed?.last_date || '2020-01-01'; // Default start date
        
        // Get messages grouped by user and date since last processed
        const activities = await this.db.all(`
            SELECT 
                LOWER(username) as username,
                DATE(timestamp / 1000, 'unixepoch') as date,
                COUNT(*) as message_count,
                SUM(COALESCE(word_count, 0)) as word_count,
                MIN(timestamp) as first_message_time,
                MAX(timestamp) as last_message_time,
                AVG(LENGTH(message)) as avg_message_length
            FROM messages
            WHERE DATE(timestamp / 1000, 'unixepoch') > ?
                AND LOWER(username) != ?
                AND username NOT LIKE '[%]'
            GROUP BY LOWER(username), DATE(timestamp / 1000, 'unixepoch')
        `, [lastDate, this.db.botUsername]);

        this.logger.info(`[DailyActivityTracker] Found ${activities.length} user-day combinations to process`);

        if (activities.length === 0) {
            return 0;
        }

        // Process in batches
        await this.db.run('BEGIN TRANSACTION');
        try {
            for (const activity of activities) {
                await this.db.run(`
                    INSERT INTO user_daily_activity 
                    (username, date, message_count, word_count, first_message_time, last_message_time)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(username, date) DO UPDATE SET
                        message_count = excluded.message_count,
                        word_count = excluded.word_count,
                        first_message_time = excluded.first_message_time,
                        last_message_time = excluded.last_message_time,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    activity.username,
                    activity.date,
                    activity.message_count,
                    activity.word_count || 0,
                    activity.first_message_time,
                    activity.last_message_time
                ]);
            }
            
            await this.db.run('COMMIT');
            
            // Clean up old data (keep last 90 days for performance)
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);
            const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
            
            await this.db.run(
                'DELETE FROM user_daily_activity WHERE date < ?',
                [cutoffDateStr]
            );
            
        } catch (error) {
            await this.db.run('ROLLBACK');
            throw error;
        }

        const duration = Date.now() - startTime;
        this.logger.info(
            `[DailyActivityTracker] Processed ${activities.length} user-day records in ${Math.round(duration / 1000)}s`
        );

        return activities.length;
    }

    // Utility method to get daily activity stats
    async getDailyActivityStats(username, days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        return await this.db.all(`
            SELECT 
                date,
                message_count,
                word_count,
                first_message_time,
                last_message_time
            FROM user_daily_activity
            WHERE username = ? AND date >= ?
            ORDER BY date DESC
        `, [username.toLowerCase(), cutoffDateStr]);
    }

    // Get weekly patterns
    async getWeeklyPattern(username) {
        return await this.db.all(`
            SELECT 
                CAST(strftime('%w', date) AS INTEGER) as day_of_week,
                AVG(message_count) as avg_messages,
                AVG(word_count) as avg_words,
                COUNT(*) as days_active
            FROM user_daily_activity
            WHERE username = ?
            GROUP BY day_of_week
            ORDER BY day_of_week
        `, [username.toLowerCase()]);
    }

    // Get most active days
    async getMostActiveDays(limit = 10) {
        return await this.db.all(`
            SELECT 
                date,
                COUNT(DISTINCT username) as unique_users,
                SUM(message_count) as total_messages,
                SUM(word_count) as total_words
            FROM user_daily_activity
            GROUP BY date
            ORDER BY total_messages DESC
            LIMIT ?
        `, [limit]);
    }
}