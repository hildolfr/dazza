import { WordCountAnalyzer } from './jobs/WordCountAnalyzer.js';
import { DailyActivityTracker } from './jobs/DailyActivityTracker.js';
import { ChatStreakCalculator } from './jobs/ChatStreakCalculator.js';
import { ActiveHoursAnalyzer } from './jobs/ActiveHoursAnalyzer.js';
import { MessageContentAnalyzer } from './jobs/MessageContentAnalyzer.js';
import { ChatAchievementCalculator } from './jobs/ChatAchievementCalculator.js';

/**
 * Registers all chat analyzers with the batch scheduler
 * @param {BatchScheduler} scheduler - The batch scheduler instance
 * @param {Database} db - The database instance
 * @param {Logger} logger - The logger instance
 * @param {Object} options - Configuration options
 */
export async function registerChatAnalyzers(scheduler, db, logger, options = {}) {
    const {
        intervalHours = 4,
        timezoneOffset = 0,
        runOnStartup = false
    } = options;

    // Register Word Count Analyzer
    scheduler.registerJob(
        'WordCountAnalyzer',
        async () => {
            const analyzer = new WordCountAnalyzer(db, logger);
            return await analyzer.run();
        },
        intervalHours
    );

    // Register Daily Activity Tracker
    scheduler.registerJob(
        'DailyActivityTracker',
        async () => {
            const analyzer = new DailyActivityTracker(db, logger);
            return await analyzer.run();
        },
        intervalHours
    );

    // Register Chat Streak Calculator (depends on DailyActivityTracker)
    scheduler.registerJob(
        'ChatStreakCalculator',
        async () => {
            const analyzer = new ChatStreakCalculator(db, logger, timezoneOffset);
            return await analyzer.run();
        },
        intervalHours
    );

    // Register Active Hours Analyzer
    scheduler.registerJob(
        'ActiveHoursAnalyzer',
        async () => {
            const analyzer = new ActiveHoursAnalyzer(db, logger, timezoneOffset);
            return await analyzer.run();
        },
        intervalHours
    );

    // Register Message Content Analyzer (depends on word counts)
    scheduler.registerJob(
        'MessageContentAnalyzer',
        async () => {
            const analyzer = new MessageContentAnalyzer(db, logger);
            return await analyzer.run();
        },
        intervalHours
    );

    // Register Chat Achievement Calculator (depends on all other analyzers)
    scheduler.registerJob(
        'ChatAchievementCalculator',
        async () => {
            const analyzer = new ChatAchievementCalculator(db, logger);
            return await analyzer.run();
        },
        intervalHours
    );

    logger.info(`Registered 6 chat analyzers with ${intervalHours} hour intervals`);

    // Run all analyzers once on startup if requested
    if (runOnStartup) {
        logger.info('Running initial chat analysis...');
        await runAllAnalyzersOnce(scheduler, db, logger, timezoneOffset);
    }
}

/**
 * Runs all analyzers once in the correct order
 * @param {BatchScheduler} scheduler - The batch scheduler instance
 * @param {Database} db - The database instance
 * @param {Logger} logger - The logger instance
 * @param {number} timezoneOffset - Timezone offset in hours
 */
export async function runAllAnalyzersOnce(scheduler, db, logger, timezoneOffset = 0) {
    const analyzers = [
        { name: 'WordCountAnalyzer', class: WordCountAnalyzer },
        { name: 'DailyActivityTracker', class: DailyActivityTracker },
        { name: 'ChatStreakCalculator', class: ChatStreakCalculator, options: { timezoneOffset } },
        { name: 'ActiveHoursAnalyzer', class: ActiveHoursAnalyzer, options: { timezoneOffset } },
        { name: 'MessageContentAnalyzer', class: MessageContentAnalyzer },
        { name: 'ChatAchievementCalculator', class: ChatAchievementCalculator }
    ];

    for (const { name, class: AnalyzerClass, options = {} } of analyzers) {
        try {
            logger.info(`Running ${name}...`);
            const analyzer = new AnalyzerClass(db, logger, ...Object.values(options));
            const result = await analyzer.run();
            logger.info(`${name} completed: ${result.recordsProcessed} records processed`);
        } catch (error) {
            logger.error(`Failed to run ${name}:`, error);
            // Continue with other analyzers even if one fails
        }
    }
}

/**
 * Gets the status of all cached tables
 * @param {Database} db - The database instance
 * @returns {Promise<Object>} Status of each cache table
 */
export async function getCacheStatus(db) {
    const tables = [
        { name: 'user_stats', key: 'total_words' },
        { name: 'user_daily_activity', key: 'message_count' },
        { name: 'user_chat_streaks', key: 'current_streak' },
        { name: 'user_active_hours', key: 'message_count' },
        { name: 'message_analysis_cache', key: 'total_messages' },
        { name: 'chat_achievements', key: 'achievement_type', hasUpdatedAt: false }
    ];

    const status = {};

    for (const { name, key, hasUpdatedAt = true } of tables) {
        try {
            const count = await db.get(
                `SELECT COUNT(*) as count FROM ${name} WHERE ${key} IS NOT NULL`
            );
            
            let lastUpdate = null;
            if (hasUpdatedAt) {
                const updateResult = await db.get(
                    `SELECT MAX(updated_at) as last_update FROM ${name}`
                );
                lastUpdate = updateResult?.last_update;
            } else {
                // For tables without updated_at, use created_at or achieved_at
                const updateResult = await db.get(
                    `SELECT MAX(created_at) as last_update FROM ${name}`
                );
                lastUpdate = updateResult?.last_update;
            }
            
            status[name] = {
                recordCount: count?.count || 0,
                lastUpdate: lastUpdate || null
            };
        } catch (error) {
            status[name] = {
                recordCount: 0,
                lastUpdate: null,
                error: error.message
            };
        }
    }

    return status;
}