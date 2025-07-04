#!/usr/bin/env node

import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';
import { WordCountAnalyzer } from './jobs/WordCountAnalyzer.js';

async function main() {
    const logger = createLogger();
    const db = new Database('cytube_stats.db');
    
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    
    try {
        logger.info('Starting manual word count analysis...');
        
        const analyzer = new WordCountAnalyzer(db, logger);
        
        // Check if we need to resume from a previous run
        await analyzer.resumeIfNeeded();
        
        logger.info('Word count analysis completed');
        
        // Show some statistics
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total_messages,
                COUNT(word_count) as processed_messages,
                AVG(word_count) as avg_words,
                MIN(word_count) as min_words,
                MAX(word_count) as max_words,
                SUM(word_count) as total_words
            FROM messages
        `).get();
        
        logger.info('Message Statistics:');
        logger.info(`  Total messages: ${stats.total_messages.toLocaleString()}`);
        logger.info(`  Processed messages: ${stats.processed_messages.toLocaleString()}`);
        logger.info(`  Average words per message: ${Math.round(stats.avg_words || 0)}`);
        logger.info(`  Min words: ${stats.min_words || 0}`);
        logger.info(`  Max words: ${stats.max_words || 0}`);
        logger.info(`  Total words: ${(stats.total_words || 0).toLocaleString()}`);
        
        // Show top 10 users by word count
        const topUsers = db.prepare(`
            SELECT username, total_words, message_count,
                   ROUND(CAST(total_words AS REAL) / message_count, 1) as avg_words_per_msg
            FROM user_stats
            WHERE total_words > 0
            ORDER BY total_words DESC
            LIMIT 10
        `).all();
        
        logger.info('\nTop 10 Users by Total Words:');
        topUsers.forEach((user, index) => {
            logger.info(`  ${index + 1}. ${user.username}: ${user.total_words.toLocaleString()} words ` +
                       `(${user.message_count} messages, avg ${user.avg_words_per_msg} words/msg)`);
        });
        
    } catch (error) {
        logger.error('Error running word count analysis:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    main().catch(error => {
        const logger = createLogger();
        logger.error('Failed to run word count analysis:', error);
        process.exit(1);
    });
}

export default main;