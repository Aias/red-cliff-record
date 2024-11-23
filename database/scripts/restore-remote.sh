#!/bin/bash
# restore.sh

# Exit on any error
set -e

# Configuration
BACKUP_DIR="$HOME/Documents/Red Cliff Record/Backups"
DATABASE_NAME="redcliffrecord"

# Find the most recent backup file
DUMP_FILE=$(ls "$BACKUP_DIR"/"$DATABASE_NAME"-backup-*.dump | sort -r | head -n1)

# Check if backup file exists
if [ ! -f "$DUMP_FILE" ]; then
    echo "No backup files found in: $BACKUP_DIR"
    exit 1
fi

echo "Using backup file: $DUMP_FILE"

# Restore to the remote database
pg_restore -h aws-0-us-east-1.pooler.supabase.com \
          -p 6543 \
          -U postgres.flwvhqkzhkvrlpzciuwq \
          -d postgres \
          --clean --if-exists -v \
          --no-owner --no-privileges \
          --no-comments \
          "$DUMP_FILE"

echo "Restore completed successfully"
