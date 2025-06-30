import { BatchJob } from '../BatchJob.js';

export class ChatAchievementCalculator extends BatchJob {
    constructor(db, logger) {
        super('ChatAchievementCalculator', db, logger);
    }

    async execute() {
        const startTime = Date.now();
        
        // Get all achievement definitions
        const achievements = await this.db.all(
            'SELECT * FROM achievement_definitions WHERE category = ?',
            ['chat']
        );

        this.logger.info(`[ChatAchievementCalculator] Processing ${achievements.length} achievement types`);

        let totalAwarded = 0;

        for (const achievement of achievements) {
            const awarded = await this.processAchievement(achievement);
            totalAwarded += awarded;
        }

        // Calculate achievement progress for all users
        await this.calculateAchievementProgress();

        const duration = Date.now() - startTime;
        this.logger.info(
            `[ChatAchievementCalculator] Awarded ${totalAwarded} achievements in ${Math.round(duration / 1000)}s`
        );

        return totalAwarded;
    }

    async processAchievement(achievement) {
        let awarded = 0;
        
        switch (achievement.type) {
            case 'message_count':
                awarded = await this.processMessageCountAchievement(achievement);
                break;
            case 'word_count':
                awarded = await this.processWordCountAchievement(achievement);
                break;
            case 'streak_days':
                awarded = await this.processStreakAchievement(achievement);
                break;
            case 'active_days':
                awarded = await this.processActiveDaysAchievement(achievement);
                break;
            case 'night_owl':
                awarded = await this.processNightOwlAchievement(achievement);
                break;
            case 'early_bird':
                awarded = await this.processEarlyBirdAchievement(achievement);
                break;
            case 'emoji_user':
                awarded = await this.processEmojiAchievement(achievement);
                break;
            case 'caps_lock':
                awarded = await this.processCapsAchievement(achievement);
                break;
            case 'question_asker':
                awarded = await this.processQuestionAchievement(achievement);
                break;
            case 'link_sharer':
                awarded = await this.processLinkAchievement(achievement);
                break;
            case 'vocabulary':
                awarded = await this.processVocabularyAchievement(achievement);
                break;
            case 'longest_msg':
                awarded = await this.processLongestMessageAchievement(achievement);
                break;
        }
        
        return awarded;
    }

    async processMessageCountAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, message_count
                FROM user_stats
                WHERE message_count >= ?
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, achievement.type, tier]);

            for (const user of users) {
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `Reached ${user.message_count} messages`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async processWordCountAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, total_words
                FROM user_stats
                WHERE total_words >= ?
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, achievement.type, tier]);

            for (const user of users) {
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `Typed ${user.total_words} words`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async processStreakAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, current_streak, best_streak
                FROM user_chat_streaks
                WHERE (current_streak >= ? OR best_streak >= ?)
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, threshold, achievement.type, tier]);

            for (const user of users) {
                const streak = Math.max(user.current_streak, user.best_streak);
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `${streak} day chat streak`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async processActiveDaysAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, total_active_days
                FROM user_chat_streaks
                WHERE total_active_days >= ?
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, achievement.type, tier]);

            for (const user of users) {
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `Active for ${user.total_active_days} days`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async processNightOwlAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, night_messages
                FROM user_activity_summary
                WHERE night_messages >= ?
                    AND night_owl_score > 30
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, achievement.type, tier]);

            for (const user of users) {
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `${user.night_messages} late night messages`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async processEarlyBirdAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, morning_messages
                FROM user_activity_summary
                WHERE morning_messages >= ?
                    AND early_bird_score > 30
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, achievement.type, tier]);

            for (const user of users) {
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `${user.morning_messages} early morning messages`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async processEmojiAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, emoji_count
                FROM message_analysis_cache
                WHERE emoji_count >= ?
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, achievement.type, tier]);

            for (const user of users) {
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `Used ${user.emoji_count} emojis`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async processCapsAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, caps_count
                FROM message_analysis_cache
                WHERE caps_count >= ?
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, achievement.type, tier]);

            for (const user of users) {
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `SENT ${user.caps_count} CAPS MESSAGES`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async processQuestionAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, question_count
                FROM message_analysis_cache
                WHERE question_count >= ?
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, achievement.type, tier]);

            for (const user of users) {
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `Asked ${user.question_count} questions`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async processLinkAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, url_count
                FROM message_analysis_cache
                WHERE url_count >= ?
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, achievement.type, tier]);

            for (const user of users) {
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `Shared ${user.url_count} links`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async processVocabularyAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, vocabulary_size
                FROM message_analysis_cache
                WHERE vocabulary_size >= ?
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, achievement.type, tier]);

            for (const user of users) {
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `Vocabulary of ${user.vocabulary_size} unique words`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async processLongestMessageAchievement(achievement) {
        const tiers = ['diamond', 'gold', 'silver', 'bronze'];
        let totalAwarded = 0;

        for (const tier of tiers) {
            const threshold = achievement[`${tier}_threshold`];
            if (!threshold) continue;

            const users = await this.db.all(`
                SELECT username, longest_message
                FROM message_analysis_cache
                WHERE longest_message >= ?
                    AND username NOT IN (
                        SELECT username FROM chat_achievements 
                        WHERE achievement_type = ? AND achievement_level = ?
                    )
            `, [threshold, achievement.type, tier]);

            for (const user of users) {
                await this.awardAchievement(
                    user.username,
                    achievement.type,
                    tier,
                    `Wrote a ${user.longest_message} character message`
                );
                totalAwarded++;
            }
        }

        return totalAwarded;
    }

    async awardAchievement(username, type, level, details) {
        await this.db.run(`
            INSERT OR IGNORE INTO chat_achievements
            (username, achievement_type, achievement_level, achieved_at, details)
            VALUES (?, ?, ?, ?, ?)
        `, [username, type, level, Date.now(), details]);
    }

    async calculateAchievementProgress() {
        // Create progress table if needed
        await this.db.run(`
            CREATE TABLE IF NOT EXISTS achievement_progress (
                username TEXT NOT NULL,
                achievement_type TEXT NOT NULL,
                current_value INTEGER DEFAULT 0,
                next_tier TEXT,
                next_threshold INTEGER,
                progress_percent REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (username, achievement_type)
            )
        `);

        // This would calculate progress towards next achievement tier for each user
        // Implementation depends on specific needs
    }

    // Utility methods
    async getUserAchievements(username) {
        return await this.db.all(`
            SELECT 
                a.*,
                d.name,
                d.description,
                d.icon
            FROM chat_achievements a
            JOIN achievement_definitions d ON a.achievement_type = d.type
            WHERE a.username = ?
            ORDER BY a.achieved_at DESC
        `, [username.toLowerCase()]);
    }

    async getAchievementLeaderboard(type, limit = 10) {
        return await this.db.all(`
            SELECT 
                username,
                COUNT(*) as achievement_count,
                MAX(CASE 
                    WHEN achievement_level = 'diamond' THEN 4
                    WHEN achievement_level = 'gold' THEN 3
                    WHEN achievement_level = 'silver' THEN 2
                    WHEN achievement_level = 'bronze' THEN 1
                    ELSE 0
                END) as highest_tier
            FROM chat_achievements
            WHERE achievement_type = ?
            GROUP BY username
            ORDER BY highest_tier DESC, achievement_count DESC
            LIMIT ?
        `, [type, limit]);
    }

    async getRecentAchievements(limit = 20) {
        return await this.db.all(`
            SELECT 
                a.*,
                d.name,
                d.description,
                d.icon
            FROM chat_achievements a
            JOIN achievement_definitions d ON a.achievement_type = d.type
            ORDER BY a.achieved_at DESC
            LIMIT ?
        `, [limit]);
    }
}