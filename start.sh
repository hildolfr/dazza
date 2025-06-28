#!/bin/bash

# Bot starter script with proper logging
# Logs everything to timestamped files with rotation

# Configuration
LOG_DIR="./logs"
LOG_FILE="console_log.txt"
MAX_SIZE=10485760  # 10MB in bytes
TIMESTAMP_FORMAT="+%Y-%m-%d %H:%M:%S"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Function to get current log file size
get_file_size() {
    if [ -f "$1" ]; then
        stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo 0
    else
        echo 0
    fi
}

# Function to rotate logs
rotate_log() {
    local log_path="$LOG_DIR/$LOG_FILE"
    if [ -f "$log_path" ]; then
        local timestamp=$(date "+%Y%m%d_%H%M%S")
        mv "$log_path" "$LOG_DIR/console_log_${timestamp}.txt"
        echo "[$(date "$TIMESTAMP_FORMAT")] Log rotated to console_log_${timestamp}.txt" > "$log_path"
        
        # Clean up old logs (keep last 10)
        ls -t "$LOG_DIR"/console_log_*.txt 2>/dev/null | tail -n +11 | xargs -r rm
    fi
}

# Function to add timestamp to each line
add_timestamp() {
    while IFS= read -r line; do
        echo "[$(date "$TIMESTAMP_FORMAT")] $line"
    done
}

# Check if log needs rotation before starting
LOG_PATH="$LOG_DIR/$LOG_FILE"
current_size=$(get_file_size "$LOG_PATH")
if [ "$current_size" -ge "$MAX_SIZE" ]; then
    rotate_log
fi

echo "[$(date "$TIMESTAMP_FORMAT")] Starting Dazza bot..." | tee -a "$LOG_PATH"
echo "[$(date "$TIMESTAMP_FORMAT")] Log file: $LOG_PATH" | tee -a "$LOG_PATH"
echo "[$(date "$TIMESTAMP_FORMAT")] Max log size: 10MB" | tee -a "$LOG_PATH"
echo "[$(date "$TIMESTAMP_FORMAT")] =====================================" | tee -a "$LOG_PATH"

# Run the bot with proper logging
# Both stdout and stderr are captured, timestamped, and saved
node index.js 2>&1 | while IFS= read -r line; do
    # Add timestamp
    timestamped_line="[$(date "$TIMESTAMP_FORMAT")] $line"
    
    # Output to console
    echo "$timestamped_line"
    
    # Append to log file
    echo "$timestamped_line" >> "$LOG_PATH"
    
    # Check if rotation needed
    current_size=$(get_file_size "$LOG_PATH")
    if [ "$current_size" -ge "$MAX_SIZE" ]; then
        rotate_log
    fi
done

# Log exit
exit_code=${PIPESTATUS[0]}
echo "[$(date "$TIMESTAMP_FORMAT")] Bot exited with code: $exit_code" | tee -a "$LOG_PATH"
exit $exit_code