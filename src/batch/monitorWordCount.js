#!/usr/bin/env node

import Database from 'better-sqlite3';
import { createLogger } from '../utils/LoggerCompatibilityLayer.js';

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

async function monitor() {
    const logger = createLogger();
    const db = new Database('cytube_stats_modular.db');
    
    try {
        console.clear();
        console.log('Word Count Analyzer Monitor');
        console.log('='.repeat(80));
        
        // Get current status
        const jobStatus = db.prepare(
            'SELECT * FROM batch_jobs WHERE job_name = ?'
        ).get('WordCountAnalyzer');
        
        if (jobStatus) {
            console.log('\nJob Status:');
            console.log(`  Status: ${jobStatus.status}`);
            if (jobStatus.last_run) {
                const lastRun = new Date(jobStatus.last_run);
                console.log(`  Last Run: ${lastRun.toLocaleString()}`);
            }
            if (jobStatus.next_run) {
                const nextRun = new Date(jobStatus.next_run);
                const timeUntil = jobStatus.next_run - Date.now();
                console.log(`  Next Run: ${nextRun.toLocaleString()} (in ${formatDuration(timeUntil)})`);
            }
            if (jobStatus.error_count > 0) {
                console.log(`  Error Count: ${jobStatus.error_count}`);
                console.log(`  Last Error: ${jobStatus.last_error}`);
            }
        }
        
        // Get processing progress
        const progress = db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM messages WHERE word_count IS NOT NULL) as processed,
                (SELECT COUNT(*) FROM messages) as total,
                (SELECT COUNT(*) FROM messages WHERE word_count IS NULL) as remaining
        `).get();
        
        const percentage = progress.total > 0 ? (progress.processed / progress.total * 100).toFixed(2) : 0;
        
        console.log('\nProcessing Progress:');
        console.log(`  Total Messages: ${progress.total.toLocaleString()}`);
        console.log(`  Processed: ${progress.processed.toLocaleString()} (${percentage}%)`);
        console.log(`  Remaining: ${progress.remaining.toLocaleString()}`);
        
        // Progress bar
        const barLength = 50;
        const filled = Math.round(barLength * progress.processed / progress.total);
        const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
        console.log(`  [${bar}]`);
        
        // Get recent history
        const history = db.prepare(`
            SELECT * FROM batch_job_history 
            WHERE job_name = 'WordCountAnalyzer' 
            ORDER BY id DESC 
            LIMIT 5
        `).all();
        
        if (history.length > 0) {
            console.log('\nRecent Job History:');
            history.forEach((run, index) => {
                const startTime = new Date(run.started_at);
                const status = run.status === 'completed' ? '✓' : run.status === 'error' ? '✗' : '⟳';
                const duration = run.duration_ms ? formatDuration(run.duration_ms) : 'N/A';
                const rate = run.records_processed && run.duration_ms 
                    ? Math.round(run.records_processed / (run.duration_ms / 1000)) 
                    : 0;
                
                console.log(`  ${status} ${startTime.toLocaleString()} - ` +
                           `${run.records_processed || 0} records in ${duration}` +
                           (rate > 0 ? ` (${rate} msg/sec)` : ''));
                
                if (run.error_message) {
                    console.log(`     Error: ${run.error_message}`);
                }
            });
        }
        
        // Get word count statistics
        const wordStats = db.prepare(`
            SELECT 
                AVG(word_count) as avg_words,
                MIN(word_count) as min_words,
                MAX(word_count) as max_words,
                SUM(word_count) as total_words,
                COUNT(CASE WHEN word_count = 0 THEN 1 END) as empty_messages,
                COUNT(CASE WHEN word_count > 100 THEN 1 END) as long_messages
            FROM messages
            WHERE word_count IS NOT NULL
        `).get();
        
        if (wordStats.total_words > 0) {
            console.log('\nWord Count Statistics:');
            console.log(`  Average: ${Math.round(wordStats.avg_words || 0)} words/message`);
            console.log(`  Range: ${wordStats.min_words || 0} - ${wordStats.max_words || 0} words`);
            console.log(`  Total Words: ${(wordStats.total_words || 0).toLocaleString()}`);
            console.log(`  Empty Messages: ${(wordStats.empty_messages || 0).toLocaleString()}`);
            console.log(`  Long Messages (>100 words): ${(wordStats.long_messages || 0).toLocaleString()}`);
        }
        
        // Check if job is currently running
        if (jobStatus && jobStatus.status === 'running') {
            console.log('\n⟳ Job is currently running...');
            
            // Estimate completion time based on recent rate
            const recentRate = history.length > 0 && history[0].records_processed && history[0].duration_ms
                ? history[0].records_processed / (history[0].duration_ms / 1000)
                : 0;
            
            if (recentRate > 0 && progress.remaining > 0) {
                const eta = Math.round(progress.remaining / recentRate);
                console.log(`  Estimated time remaining: ${formatDuration(eta * 1000)}`);
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('Press Ctrl+C to exit. Refreshing every 5 seconds...');
        
    } catch (error) {
        logger.error('Error monitoring word count:', error);
    } finally {
        db.close();
    }
}

// Run monitor in a loop
async function main() {
    while (true) {
        await monitor();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Refresh every 5 seconds
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nMonitoring stopped.');
    process.exit(0);
});

main().catch(error => {
    const logger = createLogger();
    logger.error('Monitor failed:', error);
    process.exit(1);
});