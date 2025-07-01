#!/bin/bash

# Database backup script for multi-room migration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILE="cytube_stats.db"
BACKUP_DIR="backups"
BACKUP_FILE="${BACKUP_DIR}/cytube_stats_${TIMESTAMP}.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    echo "Error: Database file $DB_FILE not found!"
    exit 1
fi

# Create backup
echo "Creating backup of $DB_FILE..."
cp "$DB_FILE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Backup created successfully: $BACKUP_FILE"
    
    # Show file size
    SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    echo "  Size: $SIZE"
    
    # Create a symlink to latest backup
    ln -sf "$(basename "$BACKUP_FILE")" "${BACKUP_DIR}/latest.db"
    echo "  Latest symlink updated"
else
    echo "✗ Backup failed!"
    exit 1
fi

# List recent backups
echo -e "\nRecent backups:"
ls -lht "$BACKUP_DIR"/*.db 2>/dev/null | head -5