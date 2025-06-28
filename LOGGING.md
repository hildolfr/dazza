# Dazza Bot Logging Guide

## Overview
The bot has comprehensive logging with automatic rotation and timestamp management.

## Log Files

### Console Log (`logs/console_log.txt`)
- **ALL** console output (stdout + stderr) with timestamps
- Rotates at 10MB
- Keeps last 10 rotated files
- Old logs are compressed with gzip (if available)
- Includes millisecond timestamps
- Color codes preserved in terminal, stripped in logs

### Application Logs (`logs/cytube-bot-YYYY-MM-DD.log`)
- Structured JSON logs from the Logger class
- Daily rotation
- Contains command executions, errors, user events
- 10MB size limit per file
- Keeps last 5 files

## Starting the Bot

### Option 1: Full Logging (Recommended)
```bash
npm start
# or
./start-bot.sh
```
Features:
- Timestamps on every line
- Color-coded output in terminal
- Automatic rotation at 10MB
- Signal handling (Ctrl+C)
- Compression of old logs

### Option 2: Simple Logging
```bash
npm run start:simple
# or
./start.sh
```
Features:
- Basic timestamps
- Log rotation
- Simple output

### Option 3: Direct (No wrapper)
```bash
npm run start:direct
# or
node src/index.js
```
- No console timestamps
- Only application logs

## Viewing Logs

### Live Console Output
```bash
tail -f logs/console_log.txt
```

### Today's Application Log
```bash
tail -f logs/cytube-bot-$(date +%Y-%m-%d).log
```

### Search Logs
```bash
# Find errors
grep -i error logs/console_log.txt

# Find specific user
grep "username" logs/cytube-bot-*.log

# Find PM commands
grep "PM from" logs/console_log.txt
```

## Log Rotation

### Console Logs
- Automatic rotation at 10MB
- Format: `console_log_YYYYMMDD_HHMMSS.txt.gz`
- Keeps 10 most recent files

### Application Logs  
- Daily rotation at midnight
- Also rotates at 10MB if needed
- Format: `cytube-bot-YYYY-MM-DD.log`
- Keeps 5 most recent files

## Troubleshooting

### Missing Logs
If logs aren't appearing:
1. Check the `logs/` directory exists
2. Ensure write permissions
3. Check disk space

### Stale Logs
If logs seem outdated:
1. Restart with wrapper script: `npm start`
2. Check if process is actually running
3. Look for `console_log.txt` not just dated logs

### Permission Issues
```bash
# Fix permissions
chmod +x start*.sh
chmod -R 755 logs/
```

## Log Format Examples

### Console Log Entry
```
[2025-06-28 12:30:45.123] [INFO] User join {"user":"hildolfr","event":"join"}
[2025-06-28 12:30:46.456] [username]: hello everyone
[2025-06-28 12:30:47.789] [dazza]: g'day mate
```

### Application Log Entry
```json
[2025-06-28T12:30:45.123Z] [INFO] Command executed {"user":"hildolfr","command":"summary","args":["3"]}
```