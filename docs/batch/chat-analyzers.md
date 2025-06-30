# Chat Batch Analyzers Documentation

This document describes the five batch analyzers that run every 4 hours to analyze chat data and maintain cached statistics tables.

## Overview

All analyzers extend the `BatchJob` base class and follow these patterns:
- Process data in batches to handle large datasets efficiently
- Use transactions for data integrity
- Support incremental updates (only process new data since last run)
- Include progress logging for monitoring
- Handle edge cases and errors gracefully

## 1. DailyActivityTracker

**Purpose**: Aggregates messages by user and date to track daily activity patterns.

### Cache Table: `user_daily_activity`
```sql
CREATE TABLE user_daily_activity (
    username TEXT NOT NULL,
    date TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    first_message_time INTEGER,
    last_message_time INTEGER,
    avg_message_length REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (username, date)
)
```

### Key Features
- Processes messages incrementally based on last processed timestamp
- Aggregates messages by user and date (YYYY-MM-DD format)
- Tracks message count, word count, and timing information
- Automatically cleans up data older than 90 days
- Provides weekly pattern analysis

### Algorithm
1. Get last processed timestamp from cache
2. Query messages newer than last processed
3. Group messages by username and date
4. Calculate aggregates (counts, averages, first/last times)
5. Update cache table with UPSERT pattern
6. Clean up old data if configured

### Performance Considerations
- Batch size: 5000 messages per database query
- Progress checkpoint: Every 10,000 messages
- Indexes on date, username, and last_message_time
- Memory-efficient Map-based aggregation

### Edge Cases Handled
- Empty messages or null word counts
- Users with no messages
- Date boundary handling
- Timezone considerations

## 2. ChatStreakCalculator

**Purpose**: Calculates consecutive chat days for streak tracking.

### Cache Table: `user_chat_streaks`
```sql
CREATE TABLE user_chat_streaks (
    username TEXT PRIMARY KEY,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    last_active_date TEXT,
    streak_start_date TEXT,
    total_active_days INTEGER DEFAULT 0,
    streak_breaks INTEGER DEFAULT 0,
    longest_break INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Key Features
- Depends on `user_daily_activity` table
- Handles timezone-aware streak calculations
- Tracks both current and best streaks
- Identifies streak breaks and patterns
- Maintains global streak statistics

### Algorithm
1. Get all users from daily activity table
2. For each user:
   - Sort their daily activities chronologically
   - Calculate consecutive day streaks
   - Track breaks and gaps
   - Determine if current streak is active
3. Update user streak records
4. Calculate global statistics

### Performance Considerations
- Processes one user at a time (sequential)
- Progress logging every 100 users
- Lightweight date calculations
- Single pass through user's activity

### Edge Cases Handled
- Single-day gaps (streak continues)
- Multiple-day gaps (streak breaks)
- Timezone boundary crossings
- Users with no activity
- Leap years and month boundaries

## 3. ActiveHoursAnalyzer

**Purpose**: Analyzes chat patterns by hour of day.

### Cache Tables

#### `user_active_hours`
```sql
CREATE TABLE user_active_hours (
    username TEXT NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    message_count INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    avg_message_length REAL DEFAULT 0,
    total_length INTEGER DEFAULT 0,
    last_updated INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (username, hour)
)
```

#### `user_activity_summary`
```sql
CREATE TABLE user_activity_summary (
    username TEXT PRIMARY KEY,
    most_active_hour INTEGER,
    least_active_hour INTEGER,
    peak_messages_per_hour INTEGER,
    total_active_hours INTEGER,
    activity_variance REAL,
    night_owl_score REAL,
    early_bird_score REAL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Key Features
- Timezone-normalized hour calculations
- Identifies night owls and early birds
- Calculates activity variance (consistency)
- Supports incremental updates
- Provides global activity patterns

### Algorithm
1. Process messages with timezone adjustment
2. Group by username and hour (0-23)
3. Calculate hourly aggregates
4. Update hourly cache with cumulative values
5. Calculate derived statistics:
   - Night owl score (22:00-03:59 activity)
   - Early bird score (05:00-08:59 activity)
   - Activity variance (standard deviation)

### Performance Considerations
- Batch size: 5000 messages
- Map-based aggregation for memory efficiency
- Incremental updates using UPSERT
- Separate summary calculation phase

### Edge Cases Handled
- Timezone offset configuration
- Users with activity in few hours
- 24-hour boundary wrapping
- Empty or minimal activity periods

## 4. MessageContentAnalyzer

**Purpose**: Deep analysis of message content including vocabulary, emojis, and patterns.

### Cache Tables

#### `message_analysis_cache`
```sql
CREATE TABLE message_analysis_cache (
    username TEXT PRIMARY KEY,
    total_messages INTEGER DEFAULT 0,
    avg_message_length REAL DEFAULT 0,
    avg_words_per_message REAL DEFAULT 0,
    emoji_count INTEGER DEFAULT 0,
    emoji_usage_rate REAL DEFAULT 0,
    caps_count INTEGER DEFAULT 0,
    caps_usage_rate REAL DEFAULT 0,
    question_count INTEGER DEFAULT 0,
    exclamation_count INTEGER DEFAULT 0,
    url_count INTEGER DEFAULT 0,
    mention_count INTEGER DEFAULT 0,
    longest_message INTEGER DEFAULT 0,
    shortest_message INTEGER DEFAULT 0,
    vocabulary_size INTEGER DEFAULT 0,
    unique_emojis INTEGER DEFAULT 0,
    avg_punctuation_per_message REAL DEFAULT 0,
    repeated_char_usage REAL DEFAULT 0,
    last_analyzed INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### `user_vocabulary`
```sql
CREATE TABLE user_vocabulary (
    username TEXT NOT NULL,
    word TEXT NOT NULL,
    usage_count INTEGER DEFAULT 1,
    first_used INTEGER,
    last_used INTEGER,
    PRIMARY KEY (username, word)
)
```

### Key Features
- Comprehensive regex-based pattern matching
- Vocabulary tracking and analysis
- Emoji usage patterns
- URL and mention detection
- Character pattern analysis (caps, repeated chars)

### Algorithm
1. Get users needing content analysis updates
2. For each user:
   - Load messages since last analysis
   - Apply regex patterns for content extraction
   - Build vocabulary map
   - Calculate statistics and rates
   - Update vocabulary table
   - Merge with existing statistics
3. Update global content statistics

### Performance Considerations
- Batch size: 2000 messages (smaller due to regex processing)
- Compiled regex patterns for efficiency
- Set-based unique tracking (emojis)
- Map-based vocabulary aggregation
- Batch vocabulary updates with prepared statements

### Edge Cases Handled
- Empty messages
- Unicode emoji handling
- URL variations (http/https/www)
- Mention format variations
- Very long messages
- Special characters and punctuation

## 5. ChatAchievementCalculator

**Purpose**: Awards achievement badges based on various chat statistics.

### Cache Tables

#### `achievement_definitions`
```sql
CREATE TABLE achievement_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'diamond')),
    criteria_type TEXT NOT NULL,
    criteria_value INTEGER,
    icon TEXT,
    points INTEGER DEFAULT 10,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### `chat_achievements`
```sql
CREATE TABLE chat_achievements (
    username TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    earned_at INTEGER NOT NULL,
    progress INTEGER DEFAULT 0,
    tier_earned TEXT,
    notified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (username, achievement_id)
)
```

### Key Features
- Multiple achievement categories (messages, streaks, vocabulary, patterns, content)
- Tiered achievements (bronze, silver, gold, diamond)
- Progress tracking for unearned achievements
- Rarity scoring based on earn rates
- Global achievement statistics

### Algorithm
1. Initialize achievement definitions if needed
2. For each user:
   - Gather stats from all analyzer tables
   - Check each active achievement criteria
   - Award new achievements
   - Update progress for unearned achievements
3. Calculate global statistics and rarity scores

### Achievement Categories
- **Messages**: First message, message count milestones
- **Streaks**: Consecutive day achievements
- **Vocabulary**: Unique word usage milestones
- **Patterns**: Night owl, early bird, 24/7 activity
- **Content**: Emoji usage, questions, URLs, caps lock
- **Special**: Long messages, activity span, social mentions

### Performance Considerations
- Batch size: 100 users (due to multiple table joins)
- Caches earned achievements to avoid re-checking
- Single pass per user through achievements
- Prepared statements for bulk operations

### Edge Cases Handled
- Users with no stats in some tables
- Achievement criteria changes
- Progress tracking for partial completion
- Duplicate achievement prevention
- Missing data gracefully handled with defaults

## Batch Processing Strategy

All analyzers follow these best practices:

1. **Incremental Processing**: Track last processed timestamp/state to avoid reprocessing
2. **Transaction Management**: Use transactions for batch updates to ensure consistency
3. **Progress Monitoring**: Regular logging of progress for long-running jobs
4. **Error Recovery**: Graceful handling of errors with transaction rollback
5. **Memory Management**: Process data in chunks to avoid memory issues
6. **Index Optimization**: Strategic indexes on frequently queried columns

## Historical Data Handling

For first run with existing data:

1. **DailyActivityTracker**: Processes all messages, may take significant time
2. **ChatStreakCalculator**: Depends on daily activity, runs after
3. **ActiveHoursAnalyzer**: Processes all messages independently
4. **MessageContentAnalyzer**: Most intensive, processes all message content
5. **ChatAchievementCalculator**: Runs last, depends on other analyzers

Recommended first-run strategy:
- Run during low-activity period
- Consider smaller batch sizes initially
- Monitor system resources
- Run analyzers sequentially first time
- Enable progress logging for visibility

## Integration Example

```javascript
import BatchScheduler from './batch/BatchScheduler.js';
import { 
    DailyActivityTracker,
    ChatStreakCalculator,
    ActiveHoursAnalyzer,
    MessageContentAnalyzer,
    ChatAchievementCalculator
} from './batch/jobs/index.js';

// Initialize scheduler
const scheduler = new BatchScheduler(db, logger);
await scheduler.init();

// Register analyzers with 4-hour intervals
scheduler.registerJob('DailyActivityTracker', 
    () => new DailyActivityTracker(db, logger).run(), 4);
scheduler.registerJob('ChatStreakCalculator', 
    () => new ChatStreakCalculator(db, logger).run(), 4);
scheduler.registerJob('ActiveHoursAnalyzer', 
    () => new ActiveHoursAnalyzer(db, logger).run(), 4);
scheduler.registerJob('MessageContentAnalyzer', 
    () => new MessageContentAnalyzer(db, logger).run(), 4);
scheduler.registerJob('ChatAchievementCalculator', 
    () => new ChatAchievementCalculator(db, logger).run(), 4);

// Start scheduler
await scheduler.start();
```

## Monitoring and Maintenance

- Check `batch_job_history` table for execution history
- Monitor `batch_jobs` table for job status and errors
- Use utility methods for querying cached data
- Regular cleanup of old data (configurable retention)
- Index maintenance for optimal performance