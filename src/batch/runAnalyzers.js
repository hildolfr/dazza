#!/usr/bin/env node

import Database from '../services/database.js';
import { createLogger } from '../utils/logger.js';
import { WordCountAnalyzer } from './jobs/WordCountAnalyzer.js';
import { DailyActivityTracker } from './jobs/DailyActivityTracker.js';
import { ChatStreakCalculator } from './jobs/ChatStreakCalculator.js';
import { ActiveHoursAnalyzer } from './jobs/ActiveHoursAnalyzer.js';
import { MessageContentAnalyzer } from './jobs/MessageContentAnalyzer.js';
import { ChatAchievementCalculator } from './jobs/ChatAchievementCalculator.js';
import { getCacheStatus } from './registerAnalyzers.js';
import config from '../config/index.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    timezoneOffset: 0,
    showStatus: args.includes('--status'),
    help: args.includes('--help') || args.includes('-h')
};

// Extract timezone offset if provided
const tzIndex = args.indexOf('--timezone');
if (tzIndex !== -1 && args[tzIndex + 1]) {
    options.timezoneOffset = parseInt(args[tzIndex + 1]) || 0;
    // Remove timezone args from the list
    args.splice(tzIndex, 2);
}

// Get analyzers to run (after removing option args)
const analyzersToRun = args.filter(arg => !arg.startsWith('--'));

// Show help
if (options.help) {
    console.log(`
Dazza's Chat Analyzer Runner
Usage: npm run analyze [analyzers...] [options]

Analyzers:
  word        - Count words in all messages
  activity    - Track daily user activity
  streak      - Calculate chat streaks
  hours       - Analyze active hours patterns
  content     - Analyze message content (emojis, caps, etc)
  achievement - Calculate and award achievements
  all         - Run all analyzers in sequence

Options:
  --timezone N    Set timezone offset in hours (default: 0)
  --status        Show cache table status only
  --help, -h      Show this help message

Examples:
  npm run analyze all                    # Run all analyzers
  npm run analyze word activity          # Run specific analyzers
  npm run analyze --status               # Show cache status
  npm run analyze all --timezone 10     # Run all with +10 hour timezone
`);
    process.exit(0);
}

async function main() {
    const logger = createLogger({ level: 'info', console: true });
    
    // Initialize database
    const db = new Database(config.database.path, config.bot.username);
    await db.init();
    
    // Show status if requested
    if (options.showStatus) {
        console.log('\n📊 Cache Table Status:\n');
        const status = await getCacheStatus(db);
        
        for (const [table, info] of Object.entries(status)) {
            console.log(`${table}:`);
            console.log(`  Records: ${info.recordCount}`);
            console.log(`  Last Update: ${info.lastUpdate || 'Never'}`);
            if (info.error) {
                console.log(`  Error: ${info.error}`);
            }
            console.log();
        }
        
        process.exit(0);
    }
    
    // Define available analyzers
    const analyzers = {
        word: { name: 'WordCountAnalyzer', class: WordCountAnalyzer },
        activity: { name: 'DailyActivityTracker', class: DailyActivityTracker },
        streak: { name: 'ChatStreakCalculator', class: ChatStreakCalculator, options: [options.timezoneOffset] },
        hours: { name: 'ActiveHoursAnalyzer', class: ActiveHoursAnalyzer, options: [options.timezoneOffset] },
        content: { name: 'MessageContentAnalyzer', class: MessageContentAnalyzer },
        achievement: { name: 'ChatAchievementCalculator', class: ChatAchievementCalculator }
    };
    
    // Determine which analyzers to run
    let selectedAnalyzers = [];
    
    if (analyzersToRun.length === 0 || analyzersToRun.includes('all')) {
        // Run all analyzers in order
        selectedAnalyzers = ['word', 'activity', 'streak', 'hours', 'content', 'achievement'];
    } else {
        // Run specific analyzers
        selectedAnalyzers = analyzersToRun.filter(name => analyzers[name]);
        
        // Check for invalid analyzer names
        const invalid = analyzersToRun.filter(name => !analyzers[name]);
        if (invalid.length > 0) {
            console.error(`❌ Unknown analyzers: ${invalid.join(', ')}`);
            console.log('Run with --help to see available analyzers');
            process.exit(1);
        }
    }
    
    console.log(`\n🚀 Running ${selectedAnalyzers.length} analyzer(s)...\n`);
    
    const startTime = Date.now();
    let totalRecords = 0;
    
    // Run each analyzer
    for (const analyzerKey of selectedAnalyzers) {
        const { name, class: AnalyzerClass, options: analyzerOptions = [] } = analyzers[analyzerKey];
        
        try {
            console.log(`\n▶️  Running ${name}...`);
            const analyzer = new AnalyzerClass(db, logger, ...analyzerOptions);
            const result = await analyzer.run();
            
            console.log(`✅ ${name} completed: ${result.recordsProcessed} records processed`);
            totalRecords += result.recordsProcessed;
            
            // Show some stats for specific analyzers
            if (analyzerKey === 'word') {
                const stats = await analyzer.getWordCountStats();
                console.log(`   Total words: ${stats.summary.total_words}`);
                console.log(`   Average words per message: ${Math.round(stats.summary.avg_words_per_message)}`);
            } else if (analyzerKey === 'streak') {
                const stats = await analyzer.getStreakStats();
                console.log(`   Active streaks: ${stats.summary.active_streaks}`);
                console.log(`   Longest current streak: ${stats.summary.longest_current} days`);
            } else if (analyzerKey === 'achievement') {
                const recent = await analyzer.getRecentAchievements(5);
                console.log(`   Recent achievements: ${recent.length}`);
            }
            
        } catch (error) {
            console.error(`❌ ${name} failed:`, error.message);
            logger.error(`${name} failed:`, error);
        }
    }
    
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n✨ All analyzers completed in ${totalTime}s (${totalRecords} total records processed)\n`);
    
    process.exit(0);
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});