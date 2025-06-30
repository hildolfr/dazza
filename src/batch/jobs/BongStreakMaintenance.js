import { BatchJob } from '../BatchJob.js';

export class BongStreakMaintenance extends BatchJob {
    constructor(db, logger) {
        super('BongStreakMaintenance', db, logger);
        // UTC+10 timezone offset (server is UTC-8, so +18 hours)
        this.TIMEZONE_OFFSET = 18 * 60 * 60 * 1000;
    }

    async execute() {
        const startTime = Date.now();
        
        // Get all users with active streaks
        const activeStreaks = await this.db.all(`
            SELECT username, current_streak, last_bong_date, streak_start_date
            FROM user_bong_streaks
            WHERE current_streak > 0
        `);

        this.logger.info(`[BongStreakMaintenance] Checking ${activeStreaks.length} active streaks`);

        let streaksBroken = 0;
        let errors = 0;
        
        // Get current date in UTC+10
        const now = new Date();
        const todayUTC10 = new Date(now.getTime() + this.TIMEZONE_OFFSET).toISOString().split('T')[0];
        
        await this.db.run('BEGIN TRANSACTION');
        try {
            for (const streak of activeStreaks) {
                try {
                    const lastBongDate = new Date(streak.last_bong_date);
                    const todayDate = new Date(todayUTC10);
                    const daysSinceLastBong = Math.floor((todayDate - lastBongDate) / (1000 * 60 * 60 * 24));
                    
                    // If more than 1 day has passed, the streak is broken
                    if (daysSinceLastBong > 1) {
                        await this.db.run(`
                            UPDATE user_bong_streaks
                            SET current_streak = 0,
                                streak_start_date = NULL,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE username = ?
                        `, [streak.username]);
                        
                        streaksBroken++;
                        
                        this.logger.debug(
                            `[BongStreakMaintenance] Streak broken for ${streak.username} - ` +
                            `Last bong: ${streak.last_bong_date}, Days since: ${daysSinceLastBong}`
                        );
                    }
                } catch (error) {
                    this.logger.error(
                        `[BongStreakMaintenance] Error processing streak for ${streak.username}:`, 
                        error
                    );
                    errors++;
                }
            }
            
            await this.db.run('COMMIT');
        } catch (error) {
            await this.db.run('ROLLBACK');
            throw error;
        }

        const duration = Date.now() - startTime;
        this.logger.info(
            `[BongStreakMaintenance] Checked ${activeStreaks.length} streaks, ` +
            `broke ${streaksBroken} streaks, ${errors} errors in ${Math.round(duration / 1000)}s`
        );

        return activeStreaks.length;
    }
}