# Dazza's Batch Analysis System

## Overview
The batch analysis system runs automated jobs every 4 hours to analyze chat data and populate cache tables for fast stats retrieval. This replaces on-the-fly calculations with pre-computed metrics.

## Architecture

### Core Components
1. **BatchScheduler** - Main scheduler that manages job execution
2. **BatchJob** - Base class for all batch analyzers
3. **Analyzers** - Individual job implementations
4. **Cache Tables** - SQLite tables storing pre-computed results

### Batch Jobs

#### 1. WordCountAnalyzer
- Counts words in all messages
- Updates `messages.word_count` and `user_stats.total_words`
- Handles URLs, mentions, and emojis properly

#### 2. DailyActivityTracker
- Aggregates messages by user and date
- Populates `user_daily_activity` table
- Tracks message/word counts per day

#### 3. ChatStreakCalculator
- Calculates consecutive chat days
- Updates `user_chat_streaks` table
- Tracks current/best streaks

#### 4. ActiveHoursAnalyzer
- Analyzes activity by hour of day
- Populates `user_active_hours` table
- Calculates night owl/early bird scores

#### 5. MessageContentAnalyzer
- Deep analysis of message content
- Tracks emoji usage, caps, questions, vocabulary
- Updates `message_analysis_cache` table

#### 6. ChatAchievementCalculator
- Awards achievements based on various criteria
- Supports bronze/silver/gold/diamond tiers
- Updates `chat_achievements` table

## Usage

### Manual Execution
```bash
# Run all analyzers
npm run analyze all

# Run specific analyzers
npm run analyze word activity streak

# Check cache status
npm run analyze --status

# Run with timezone offset
npm run analyze all --timezone 10
```

### Bot Integration
The batch system automatically:
- Initializes on bot startup
- Runs all analyzers if `runOnStartup` is true
- Schedules jobs every 4 hours
- Gracefully shuts down when bot stops

### API Endpoints
- `GET /api/v1/stats/batch/status` - View job status and cache health
- `GET /api/v1/stats/users/:username/category/talkers` - Get cached talker stats

## Configuration
In bot config:
```javascript
batch: {
    timezoneOffset: 10,  // Hours offset from UTC
    runOnStartup: true   // Run analyzers on bot start
}
```

## Database Schema

### Cache Tables Created
- `user_daily_activity` - Daily message counts
- `user_chat_streaks` - Streak tracking
- `user_active_hours` - Hourly activity patterns
- `user_activity_summary` - Activity scores
- `message_analysis_cache` - Content analysis
- `user_vocabulary` - Unique words used
- `chat_achievements` - Earned achievements
- `achievement_definitions` - Achievement rules
- `achievement_progress` - Progress tracking
- `batch_jobs` - Job status tracking
- `batch_job_history` - Execution history

## Monitoring

### Check Job Status
```bash
npm run analyze --status
```

### View in API
```bash
curl http://localhost:3001/api/v1/stats/batch/status
```

### Database Queries
```sql
-- View job status
SELECT * FROM batch_jobs;

-- Check last runs
SELECT * FROM batch_job_history ORDER BY started_at DESC LIMIT 10;

-- View cache freshness
SELECT 
    'user_stats' as table_name, 
    COUNT(*) as records, 
    MAX(updated_at) as last_update 
FROM user_stats
UNION ALL
SELECT 'message_analysis_cache', COUNT(*), MAX(updated_at) FROM message_analysis_cache
-- etc for other tables
```

## Troubleshooting

### Jobs Not Running
1. Check if scheduler is started: Look for "Batch scheduler started" in logs
2. Verify job registration: Check `batch_jobs` table
3. Check for errors: Query `batch_job_history` for failed jobs

### Performance Issues
1. Adjust batch sizes in individual analyzers
2. Increase intervals if needed (default 4 hours)
3. Monitor with `npm run analyze --status`

### Data Inconsistencies
1. Run analyzers manually: `npm run analyze all`
2. Check for partial runs in `batch_job_history`
3. Verify source data in messages/user tables

## Maintenance

### Regular Tasks
- Monitor job execution via status endpoint
- Check for failed jobs weekly
- Review cache table sizes monthly

### Backfilling Data
When adding new analyzers or after data gaps:
```bash
# Run all analyzers to backfill
npm run analyze all

# Check results
npm run analyze --status
```

### Adding New Analyzers
1. Create new analyzer extending `BatchJob`
2. Add to `registerAnalyzers.js`
3. Create necessary database tables
4. Add to manual runner in `runAnalyzers.js`
5. Test thoroughly before deploying

## Performance Considerations
- Jobs process in batches to avoid memory issues
- Transactions ensure data consistency
- Indexes on key columns for query performance
- Old data cleanup (e.g., daily activity > 90 days)
- Progress logging for long-running jobs