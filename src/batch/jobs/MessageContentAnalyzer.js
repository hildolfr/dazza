import { BatchJob } from '../BatchJob.js';

export class MessageContentAnalyzer extends BatchJob {
    constructor(db, logger) {
        super('MessageContentAnalyzer', db, logger);
        this.batchSize = 1000;
        
        // Compiled regex patterns
        this.emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu;
        this.urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+/g;
        this.mentionPattern = /@[a-zA-Z0-9_-]+/g;
        this.wordPattern = /\b[\w']+\b/g;
    }

    async execute() {
        const startTime = Date.now();
        
        // Get all users
        const users = await this.db.all(`
            SELECT DISTINCT LOWER(username) as username
            FROM messages
            WHERE LOWER(username) != ?
                AND username NOT LIKE '[%]'
        `, [this.db.botUsername]);

        this.logger.info(`[MessageContentAnalyzer] Analyzing content for ${users.length} users`);

        let processedCount = 0;

        for (const user of users) {
            await this.analyzeUserMessages(user.username);
            processedCount++;
            
            if (processedCount % 50 === 0) {
                this.logger.debug(`[MessageContentAnalyzer] Processed ${processedCount}/${users.length} users`);
            }
        }

        const duration = Date.now() - startTime;
        this.logger.info(
            `[MessageContentAnalyzer] Analyzed ${processedCount} users in ${Math.round(duration / 1000)}s`
        );

        return processedCount;
    }

    async analyzeUserMessages(username) {
        // Get all messages for user
        const messages = await this.db.all(
            'SELECT message, word_count FROM messages WHERE LOWER(username) = ?',
            [username]
        );

        if (messages.length === 0) {
            return;
        }

        // Initialize counters
        let stats = {
            total_messages: messages.length,
            total_words: 0,
            total_length: 0,
            emoji_count: 0,
            caps_count: 0,
            question_count: 0,
            exclamation_count: 0,
            url_count: 0,
            mention_count: 0,
            longest_message: 0,
            shortest_message: Infinity,
            vocabulary: new Set()
        };

        // Analyze each message
        for (const msg of messages) {
            if (!msg.message) continue;
            
            const analysis = this.analyzeMessage(msg.message);
            
            stats.total_words += msg.word_count || 0;
            stats.total_length += msg.message.length;
            stats.emoji_count += analysis.emojis;
            stats.caps_count += analysis.isCaps ? 1 : 0;
            stats.question_count += analysis.questions;
            stats.exclamation_count += analysis.exclamations;
            stats.url_count += analysis.urls;
            stats.mention_count += analysis.mentions;
            stats.longest_message = Math.max(stats.longest_message, msg.message.length);
            stats.shortest_message = Math.min(stats.shortest_message, msg.message.length);
            
            // Add words to vocabulary
            analysis.words.forEach(word => stats.vocabulary.add(word.toLowerCase()));
        }

        // Calculate rates and averages
        const avgMessageLength = stats.total_length / stats.total_messages;
        const avgWordsPerMessage = stats.total_words / stats.total_messages;
        const emojiUsageRate = (stats.emoji_count / stats.total_messages) * 100;
        const capsUsageRate = (stats.caps_count / stats.total_messages) * 100;
        const vocabularySize = stats.vocabulary.size;

        // Store in cache table
        await this.db.run(`
            INSERT INTO message_analysis_cache
            (username, total_messages, total_words, avg_message_length, avg_words_per_message,
             emoji_count, emoji_usage_rate, caps_count, caps_usage_rate,
             question_count, exclamation_count, url_count, mention_count,
             longest_message, shortest_message, vocabulary_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                total_messages = excluded.total_messages,
                total_words = excluded.total_words,
                avg_message_length = excluded.avg_message_length,
                avg_words_per_message = excluded.avg_words_per_message,
                emoji_count = excluded.emoji_count,
                emoji_usage_rate = excluded.emoji_usage_rate,
                caps_count = excluded.caps_count,
                caps_usage_rate = excluded.caps_usage_rate,
                question_count = excluded.question_count,
                exclamation_count = excluded.exclamation_count,
                url_count = excluded.url_count,
                mention_count = excluded.mention_count,
                longest_message = excluded.longest_message,
                shortest_message = excluded.shortest_message,
                vocabulary_size = excluded.vocabulary_size,
                updated_at = CURRENT_TIMESTAMP
        `, [
            username,
            stats.total_messages,
            stats.total_words,
            Math.round(avgMessageLength),
            Math.round(avgWordsPerMessage * 10) / 10,
            stats.emoji_count,
            Math.round(emojiUsageRate * 10) / 10,
            stats.caps_count,
            Math.round(capsUsageRate * 10) / 10,
            stats.question_count,
            stats.exclamation_count,
            stats.url_count,
            stats.mention_count,
            stats.longest_message,
            stats.shortest_message === Infinity ? 0 : stats.shortest_message,
            vocabularySize
        ]);

        // Store vocabulary data if needed
        await this.updateVocabulary(username, stats.vocabulary);
    }

    analyzeMessage(message) {
        const emojis = (message.match(this.emojiPattern) || []).length;
        const urls = (message.match(this.urlPattern) || []).length;
        const mentions = (message.match(this.mentionPattern) || []).length;
        const words = message.match(this.wordPattern) || [];
        
        // Check if message is mostly caps (>80% uppercase letters)
        const letters = message.replace(/[^a-zA-Z]/g, '');
        const upperLetters = message.replace(/[^A-Z]/g, '');
        const isCaps = letters.length > 5 && upperLetters.length / letters.length > 0.8;
        
        // Count questions and exclamations
        const questions = (message.match(/\?/g) || []).length;
        const exclamations = (message.match(/!/g) || []).length;

        return {
            emojis,
            urls,
            mentions,
            words,
            isCaps,
            questions,
            exclamations
        };
    }

    async updateVocabulary(username, vocabulary) {
        // Create vocabulary table if needed
        await this.db.run(`
            CREATE TABLE IF NOT EXISTS user_vocabulary (
                username TEXT NOT NULL,
                word TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (username, word)
            )
        `);

        // Only store sample of vocabulary (top 1000 words) to prevent bloat
        const vocabArray = Array.from(vocabulary).slice(0, 1000);
        
        // Clear existing vocabulary for user
        await this.db.run('DELETE FROM user_vocabulary WHERE username = ?', [username]);
        
        // Insert new vocabulary in batches
        const batchSize = 100;
        for (let i = 0; i < vocabArray.length; i += batchSize) {
            const batch = vocabArray.slice(i, i + batchSize);
            await this.db.run('BEGIN TRANSACTION');
            try {
                for (const word of batch) {
                    await this.db.run(
                        'INSERT OR IGNORE INTO user_vocabulary (username, word) VALUES (?, ?)',
                        [username, word]
                    );
                }
                await this.db.run('COMMIT');
            } catch (error) {
                await this.db.run('ROLLBACK');
                throw error;
            }
        }
    }

    // Utility methods for getting analysis results
    async getContentStats(username) {
        return await this.db.get(
            'SELECT * FROM message_analysis_cache WHERE username = ?',
            [username.toLowerCase()]
        );
    }

    async getTopEmojiUsers(limit = 10) {
        return await this.db.all(`
            SELECT 
                username,
                emoji_count,
                emoji_usage_rate,
                total_messages
            FROM message_analysis_cache
            WHERE emoji_count > 0
            ORDER BY emoji_usage_rate DESC
            LIMIT ?
        `, [limit]);
    }

    async getCapsUsers(limit = 10) {
        return await this.db.all(`
            SELECT 
                username,
                caps_count,
                caps_usage_rate,
                total_messages
            FROM message_analysis_cache
            WHERE caps_count > 10
            ORDER BY caps_usage_rate DESC
            LIMIT ?
        `, [limit]);
    }

    async getVocabularyLeaders(limit = 10) {
        return await this.db.all(`
            SELECT 
                username,
                vocabulary_size,
                total_words,
                ROUND(CAST(vocabulary_size AS REAL) / total_words * 100, 2) as uniqueness_score
            FROM message_analysis_cache
            WHERE total_words > 100
            ORDER BY vocabulary_size DESC
            LIMIT ?
        `, [limit]);
    }

    async getQuestionAskers(limit = 10) {
        return await this.db.all(`
            SELECT 
                username,
                question_count,
                total_messages,
                ROUND(CAST(question_count AS REAL) / total_messages * 100, 2) as question_rate
            FROM message_analysis_cache
            WHERE question_count > 0
            ORDER BY question_count DESC
            LIMIT ?
        `, [limit]);
    }
}