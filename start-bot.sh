#!/bin/bash

# Dazza Bot Starter with Advanced Logging
# Features: timestamps, rotation, color preservation, signal handling

# Configuration
LOG_DIR="./logs"
CONSOLE_LOG="console_log.txt"
MAX_SIZE=10485760  # 10MB in bytes
MAX_FILES=10       # Keep last 10 rotated logs
TIMESTAMP_FORMAT="%Y-%m-%d %H:%M:%S.%3N"  # Includes milliseconds

# Colors for terminal (preserved in console, stripped in logs)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Cross-platform file size function
get_file_size() {
    if [ -f "$1" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            stat -f%z "$1" 2>/dev/null || echo 0
        else
            stat -c%s "$1" 2>/dev/null || echo 0
        fi
    else
        echo 0
    fi
}

# Rotate log files
rotate_log() {
    local log_path="$LOG_DIR/$CONSOLE_LOG"
    if [ -f "$log_path" ]; then
        local rotation_time=$(date "+%Y%m%d_%H%M%S")
        local rotated_name="$LOG_DIR/console_log_${rotation_time}.txt"
        
        # Move current log to timestamped file
        mv "$log_path" "$rotated_name"
        
        # Compress if gzip is available
        if command -v gzip &> /dev/null; then
            gzip "$rotated_name"
            rotated_name="${rotated_name}.gz"
        fi
        
        echo "[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Log rotated to $(basename "$rotated_name")" > "$log_path"
        
        # Clean up old logs (keep most recent MAX_FILES)
        ls -t "$LOG_DIR"/console_log_*.txt* 2>/dev/null | tail -n +$((MAX_FILES + 1)) | xargs -r rm -f
    fi
}

# Signal handlers
cleanup() {
    echo -e "\n${YELLOW}[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Received shutdown signal${NC}"
    echo "[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Received shutdown signal" >> "$LOG_DIR/$CONSOLE_LOG"
    
    # Kill the node process if it's still running
    if [ ! -z "$NODE_PID" ]; then
        kill $NODE_PID 2>/dev/null
        wait $NODE_PID 2>/dev/null
    fi
    
    echo -e "${RED}[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Bot stopped${NC}"
    echo "[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Bot stopped" >> "$LOG_DIR/$CONSOLE_LOG"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Initial log setup
LOG_PATH="$LOG_DIR/$CONSOLE_LOG"

# Check if we need to rotate before starting
current_size=$(get_file_size "$LOG_PATH")
if [ "$current_size" -ge "$MAX_SIZE" ]; then
    rotate_log
fi

# Start message
echo -e "${GREEN}[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Starting Dazza Bot${NC}"
echo "[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Starting Dazza Bot" >> "$LOG_PATH"
echo "[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Console log: $LOG_PATH" >> "$LOG_PATH"
echo "[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Rotation at: 10MB, keeping last $MAX_FILES files" >> "$LOG_PATH"
echo "[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] ============================================" >> "$LOG_PATH"

# Function to process output line by line
process_output() {
    while IFS= read -r line; do
        # Get current timestamp
        timestamp="[$(date "+$TIMESTAMP_FORMAT")]"
        
        # Strip ANSI color codes for log file
        clean_line=$(echo "$line" | sed 's/\x1B\[[0-9;]*[JKmsu]//g')
        
        # Determine log level based on content
        if [[ "$line" == *"[ERROR]"* ]] || [[ "$line" == *"error"* ]] || [[ "$line" == *"Error"* ]]; then
            level_color="${RED}"
            level="[ERROR]"
        elif [[ "$line" == *"[WARN]"* ]] || [[ "$line" == *"warning"* ]] || [[ "$line" == *"Warning"* ]]; then
            level_color="${YELLOW}"
            level="[WARN]"
        elif [[ "$line" == *"[INFO]"* ]]; then
            level_color="${BLUE}"
            level="[INFO]"
        elif [[ "$line" == *"[DEBUG]"* ]]; then
            level_color=""
            level="[DEBUG]"
        else
            level_color=""
            level=""
        fi
        
        # Output to console with colors preserved
        if [ -z "$level" ]; then
            echo "$timestamp $line"
        else
            echo -e "$timestamp ${level_color}$line${NC}"
        fi
        
        # Write to log file (no colors)
        echo "$timestamp $clean_line" >> "$LOG_PATH"
        
        # Check if rotation needed
        current_size=$(get_file_size "$LOG_PATH")
        if [ "$current_size" -ge "$MAX_SIZE" ]; then
            echo -e "${YELLOW}[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Rotating log file (size: $current_size bytes)${NC}"
            rotate_log
        fi
    done
}

# Run the bot
echo -e "${BLUE}[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Launching node process...${NC}"
echo "[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Launching node process..." >> "$LOG_PATH"

# Set log level to warn to reduce verbosity
export LOG_LEVEL=debug

# Start node process in background and capture its PID
node index.js 2>&1 | process_output &
NODE_PID=$!

# Wait for the node process
wait $NODE_PID
exit_code=$?

# Log exit
if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Bot exited normally (code: $exit_code)${NC}"
    echo "[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Bot exited normally (code: $exit_code)" >> "$LOG_PATH"
else
    echo -e "${RED}[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Bot exited with error (code: $exit_code)${NC}"
    echo "[$(date "+$TIMESTAMP_FORMAT")] [SYSTEM] Bot exited with error (code: $exit_code)" >> "$LOG_PATH"
fi

exit $exit_code
