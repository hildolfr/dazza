import { BatchJob } from '../BatchJob.js';

export class WordCountAnalyzer extends BatchJob {
    constructor(db, logger) {
        super('WordCountAnalyzer', db, logger);
        
        // Compiled regex patterns for performance
        this.urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+/g;
        this.mentionPattern = /@[a-zA-Z0-9_-]+/g;
        this.emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        this.wordPattern = /\b[\w']+\b/g;
        
        this.batchSize = 1000;
        this.progressCheckpoint = 10000;
    }

    async execute() {
        const startTime = Date.now();
        let totalProcessed = 0;
        let totalWords = 0;

        // First, get count of messages needing processing
        const { count: totalMessages } = await this.db.get(
            'SELECT COUNT(*) as count FROM messages WHERE word_count IS NULL'
        );

        if (totalMessages === 0) {
            this.logger.info('[WordCountAnalyzer] No messages need word count processing');
            return 0;
        }

        this.logger.info(`[WordCountAnalyzer] Processing ${totalMessages} messages`);

        // Process messages in batches
        totalProcessed = await this.processBatch(
            'SELECT id, username, message FROM messages WHERE word_count IS NULL ORDER BY id',
            [],
            this.batchSize,
            async (message) => {
                const wordCount = this.countWords(message.message);
                
                // Update message with word count
                await this.db.run(
                    'UPDATE messages SET word_count = ? WHERE id = ?',
                    [wordCount, message.id]
                );
                
                // Track for user stats update
                totalWords += wordCount;
                
                // Log progress at checkpoints
                if (totalProcessed % this.progressCheckpoint === 0) {
                    const elapsed = Date.now() - startTime;
                    const rate = totalProcessed / (elapsed / 1000);
                    const remaining = totalMessages - totalProcessed;
                    const eta = remaining / rate;
                    
                    this.logger.info(
                        `[WordCountAnalyzer] Progress: ${totalProcessed}/${totalMessages} ` +
                        `(${Math.round(totalProcessed / totalMessages * 100)}%) ` +
                        `Rate: ${Math.round(rate)} msg/s, ETA: ${Math.round(eta)}s`
                    );
                }
                
                totalProcessed++;
            }
        );

        // Now update user stats with aggregated word counts
        await this.updateUserWordCounts();

        const duration = Date.now() - startTime;
        this.logger.info(
            `[WordCountAnalyzer] Completed: ${totalProcessed} messages processed, ` +
            `${totalWords} words counted in ${Math.round(duration / 1000)}s`
        );

        return totalProcessed;
    }

    countWords(message) {
        if (!message || typeof message !== 'string') {
            return 0;
        }

        // Normalize the message
        let processed = message.trim();
        
        if (processed.length === 0) {
            return 0;
        }

        // Replace URLs with placeholder (count as 1 word each)
        const urlCount = (processed.match(this.urlPattern) || []).length;
        processed = processed.replace(this.urlPattern, 'URL');

        // Replace mentions with placeholder (count as 1 word each)
        const mentionCount = (processed.match(this.mentionPattern) || []).length;
        processed = processed.replace(this.mentionPattern, 'MENTION');

        // Remove emojis (don't count as words)
        processed = processed.replace(this.emojiPattern, '');

        // Count actual words (including contractions like "don't")
        const words = processed.match(this.wordPattern) || [];
        
        // Filter out standalone punctuation or single characters that aren't valid words
        const validWords = words.filter(word => {
            // Keep contractions and words with apostrophes
            if (word.includes("'")) return true;
            // Keep numbers
            if (/^\d+$/.test(word)) return true;
            // Keep words longer than 1 character
            if (word.length > 1) return true;
            // Keep single letters that are likely to be words (I, a)
            if (word.length === 1 && /[aAiI]/.test(word)) return true;
            return false;
        });

        return validWords.length;
    }

    async updateUserWordCounts() {
        this.logger.info('[WordCountAnalyzer] Updating user word count totals...');
        
        // Update only existing user_stats records with aggregated word counts
        await this.db.run(`
            UPDATE user_stats
            SET total_words = (
                SELECT SUM(word_count)
                FROM messages
                WHERE LOWER(messages.username) = user_stats.username
                AND word_count IS NOT NULL
            ),
            updated_at = CURRENT_TIMESTAMP
            WHERE username IN (
                SELECT DISTINCT LOWER(username)
                FROM messages
                WHERE word_count IS NOT NULL
            )
        `);

        // Also update for users who might have 0 word count
        await this.db.run(`
            UPDATE user_stats 
            SET total_words = 0 
            WHERE username NOT IN (
                SELECT DISTINCT LOWER(username) 
                FROM messages 
                WHERE word_count > 0
            )
        `);
    }

    // Utility method to get word count statistics
    async getWordCountStats() {
        const stats = await this.db.all(`
            SELECT 
                COUNT(*) as total_messages,
                COUNT(word_count) as processed_messages,
                SUM(word_count) as total_words,
                AVG(word_count) as avg_words_per_message,
                MAX(word_count) as max_words,
                MIN(CASE WHEN word_count > 0 THEN word_count END) as min_words
            FROM messages
        `);

        const topWordy = await this.db.all(`
            SELECT 
                username,
                total_words,
                message_count,
                ROUND(CAST(total_words AS REAL) / message_count, 2) as avg_words_per_message
            FROM user_stats
            WHERE total_words > 0
            ORDER BY total_words DESC
            LIMIT 10
        `);

        return {
            summary: stats[0],
            topUsers: topWordy
        };
    }
}