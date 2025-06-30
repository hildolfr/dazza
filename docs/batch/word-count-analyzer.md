# Word Count Analyzer

## Overview

The Word Count Analyzer is a batch job that processes chat messages to count words and maintain user statistics. It runs every 4 hours by default and processes messages that haven't been analyzed yet.

## Features

- **Batch Processing**: Processes messages in configurable batches (default: 1000)
- **Progress Tracking**: Real-time progress updates with ETA calculation
- **Resilient**: Can resume from interruptions
- **Performance Optimized**: Uses compiled regex patterns and efficient database queries
- **Comprehensive Word Counting**: Handles various edge cases

## Word Counting Algorithm

The analyzer counts words with the following rules:

1. **Regular Words**: Standard alphanumeric sequences count as words
2. **Contractions**: Words like "don't", "it's" count as single words
3. **URLs**: Any URL (http://, https://, www.) counts as 1 word
4. **@Mentions**: User mentions (@username) count as 1 word
5. **Emojis**: Emoji characters are not counted as words
6. **Numbers**: Numeric sequences count as words
7. **Special Characters**: Punctuation and symbols don't count as words

### Examples

- `"Hello world"` → 2 words
- `"Check out https://example.com"` → 4 words (URL = 1 word)
- `"Hey @dazza how's it going? 😊"` → 5 words
- `"I have 123 apples"` → 4 words

## Database Schema

### Updated Tables

#### messages
- `word_count` INTEGER DEFAULT NULL - Number of words in the message

#### user_stats  
- `total_words` INTEGER DEFAULT 0 - Total words across all user's messages

### Indexes
- `idx_messages_word_count` - Optimizes queries for unprocessed messages

## Usage

### Automatic Execution

The analyzer runs automatically every 4 hours when integrated with the BatchScheduler:

```javascript
import BatchScheduler from './batch/BatchScheduler.js';
import { WordCountAnalyzer } from './batch/jobs/index.js';

const scheduler = new BatchScheduler(db, logger);

// Register the word count analyzer to run every 4 hours
scheduler.registerJob(
    'WordCountAnalyzer',
    async () => {
        const analyzer = new WordCountAnalyzer(db, logger);
        return await analyzer.run();
    },
    4 // hours
);

await scheduler.start();
```

### Manual Execution

Run the analyzer manually:

```bash
node src/batch/runWordCount.js
```

### Monitoring

Monitor the analyzer's progress in real-time:

```bash
node src/batch/monitorWordCount.js
```

## Performance

- **Processing Rate**: Typically 5,000-15,000 messages/second
- **Memory Usage**: Constant memory usage regardless of message count
- **Database Load**: Uses transactions and batching to minimize I/O

### Optimization Techniques

1. **Batch Processing**: Processes 1000 messages per transaction
2. **Compiled Regex**: Patterns compiled once during initialization
3. **Efficient Queries**: Uses indexes and limits for pagination
4. **Transaction Management**: Groups updates to reduce disk writes
5. **Progress Tracking**: Checkpoints every 10,000 messages

## Error Handling

- **Transaction Rollback**: Failed batches are rolled back completely
- **State Tracking**: Progress is saved in the database
- **Resume Capability**: Can continue from last successful batch
- **Error Logging**: Detailed error messages with context

## Monitoring Queries

### Check Processing Progress
```sql
SELECT 
    COUNT(*) as total,
    COUNT(word_count) as processed,
    COUNT(*) - COUNT(word_count) as remaining,
    ROUND(COUNT(word_count) * 100.0 / COUNT(*), 2) as percentage
FROM messages;
```

### Top Users by Word Count
```sql
SELECT 
    username, 
    total_words, 
    message_count,
    ROUND(total_words * 1.0 / message_count, 1) as avg_words
FROM user_stats
WHERE total_words > 0
ORDER BY total_words DESC
LIMIT 20;
```

### Word Distribution
```sql
SELECT 
    CASE 
        WHEN word_count = 0 THEN 'Empty'
        WHEN word_count BETWEEN 1 AND 10 THEN '1-10'
        WHEN word_count BETWEEN 11 AND 50 THEN '11-50'
        WHEN word_count BETWEEN 51 AND 100 THEN '51-100'
        ELSE '100+'
    END as word_range,
    COUNT(*) as message_count
FROM messages
WHERE word_count IS NOT NULL
GROUP BY word_range
ORDER BY MIN(word_count);
```

## Troubleshooting

### Job Not Running
1. Check if the job is registered in the scheduler
2. Verify the batch_jobs table has the correct next_run time
3. Check logs for any error messages

### Slow Processing
1. Ensure database indexes exist
2. Check if other processes are locking the database
3. Consider adjusting batch size based on system resources

### Incorrect Word Counts
1. Test specific messages with the test script
2. Review the word counting rules
3. Check for special characters or encoding issues