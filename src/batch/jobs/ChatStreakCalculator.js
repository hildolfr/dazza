import { BatchJob } from '../BatchJob.js';

export class ChatStreakCalculator extends BatchJob {
    constructor(db, logger, timezoneOffset = 0) {
        super('ChatStreakCalculator', db, logger);
        this.timezoneOffset = timezoneOffset; // Hours offset from UTC
    }

    async execute() {
        const startTime = Date.now();
        
        // Get all users who have daily activity
        const users = await this.db.all(`
            SELECT DISTINCT username 
            FROM user_daily_activity
            ORDER BY username
        `);

        this.logger.info(`[ChatStreakCalculator] Processing streaks for ${users.length} users`);

        let processedCount = 0;
        
        await this.db.run('BEGIN TRANSACTION');
        try {
            for (const user of users) {
                await this.calculateUserStreak(user.username);
                processedCount++;
                
                if (processedCount % 100 === 0) {
                    this.logger.debug(`[ChatStreakCalculator] Processed ${processedCount}/${users.length} users`);
                }
            }
            
            await this.db.run('COMMIT');
        } catch (error) {
            await this.db.run('ROLLBACK');
            throw error;
        }

        const duration = Date.now() - startTime;
        this.logger.info(
            `[ChatStreakCalculator] Calculated streaks for ${processedCount} users in ${Math.round(duration / 1000)}s`
        );

        return processedCount;
    }

    async calculateUserStreak(username) {
        // Get user's daily activity in chronological order
        const activities = await this.db.all(`
            SELECT date, message_count
            FROM user_daily_activity
            WHERE username = ?
            ORDER BY date DESC
        `, [username]);

        if (activities.length === 0) {
            return;
        }

        const today = this.getCurrentDate();
        let currentStreak = 0;
        let bestStreak = 0;
        let tempStreak = 0;
        let lastActiveDate = activities[0].date;
        let streakStartDate = null;
        let totalActiveDays = activities.length;
        
        // Check if user was active today or yesterday (grace period)
        const lastDate = new Date(activities[0].date);
        const todayDate = new Date(today);
        const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
        
        // Start calculating current streak if active within last 2 days
        if (daysDiff <= 1) {
            currentStreak = 1;
            streakStartDate = activities[0].date;
            
            // Count consecutive days backwards
            for (let i = 1; i < activities.length; i++) {
                const currentDate = new Date(activities[i-1].date);
                const prevDate = new Date(activities[i].date);
                const diff = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));
                
                if (diff === 1) {
                    currentStreak++;
                    streakStartDate = activities[i].date;
                } else {
                    break;
                }
            }
        }

        // Calculate best streak
        tempStreak = 1;
        for (let i = 1; i < activities.length; i++) {
            const currentDate = new Date(activities[i-1].date);
            const prevDate = new Date(activities[i].date);
            const diff = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));
            
            if (diff === 1) {
                tempStreak++;
            } else {
                bestStreak = Math.max(bestStreak, tempStreak);
                tempStreak = 1;
            }
        }
        bestStreak = Math.max(bestStreak, tempStreak, currentStreak);

        // Update or insert streak data
        await this.db.run(`
            INSERT INTO user_chat_streaks 
            (username, current_streak, best_streak, last_active_date, streak_start_date, total_active_days)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                current_streak = excluded.current_streak,
                best_streak = excluded.best_streak,
                last_active_date = excluded.last_active_date,
                streak_start_date = excluded.streak_start_date,
                total_active_days = excluded.total_active_days,
                updated_at = CURRENT_TIMESTAMP
        `, [
            username,
            currentStreak,
            bestStreak,
            lastActiveDate,
            streakStartDate,
            totalActiveDays
        ]);
    }

    getCurrentDate() {
        const now = new Date();
        now.setHours(now.getHours() + this.timezoneOffset);
        return now.toISOString().split('T')[0];
    }

    // Get users with streaks at risk (haven't chatted today)
    async getStreaksAtRisk() {
        const today = this.getCurrentDate();
        
        return await this.db.all(`
            SELECT 
                s.username,
                s.current_streak,
                s.last_active_date,
                s.streak_start_date
            FROM user_chat_streaks s
            WHERE s.current_streak > 0
                AND s.last_active_date < ?
                AND s.last_active_date >= date(?, '-1 day')
            ORDER BY s.current_streak DESC
        `, [today, today]);
    }

    // Get top streak holders
    async getTopStreaks(limit = 10) {
        return await this.db.all(`
            SELECT 
                username,
                current_streak,
                best_streak,
                last_active_date,
                total_active_days
            FROM user_chat_streaks
            WHERE current_streak > 0
            ORDER BY current_streak DESC, best_streak DESC
            LIMIT ?
        `, [limit]);
    }

    // Get streak statistics
    async getStreakStats() {
        const stats = await this.db.get(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN current_streak > 0 THEN 1 END) as active_streaks,
                MAX(current_streak) as longest_current,
                MAX(best_streak) as longest_ever,
                AVG(current_streak) as avg_current_streak,
                AVG(best_streak) as avg_best_streak,
                COUNT(CASE WHEN current_streak >= 7 THEN 1 END) as week_streaks,
                COUNT(CASE WHEN current_streak >= 30 THEN 1 END) as month_streaks,
                COUNT(CASE WHEN current_streak >= 100 THEN 1 END) as hundred_streaks
            FROM user_chat_streaks
        `);

        const distribution = await this.db.all(`
            SELECT 
                CASE 
                    WHEN current_streak = 0 THEN '0 (Broken)'
                    WHEN current_streak BETWEEN 1 AND 6 THEN '1-6 days'
                    WHEN current_streak BETWEEN 7 AND 29 THEN '7-29 days'
                    WHEN current_streak BETWEEN 30 AND 99 THEN '30-99 days'
                    ELSE '100+ days'
                END as range,
                COUNT(*) as count
            FROM user_chat_streaks
            GROUP BY 1
            ORDER BY 
                CASE 
                    WHEN range = '0 (Broken)' THEN 1
                    WHEN range = '1-6 days' THEN 2
                    WHEN range = '7-29 days' THEN 3
                    WHEN range = '30-99 days' THEN 4
                    ELSE 5
                END
        `);

        return {
            summary: stats,
            distribution
        };
    }
}