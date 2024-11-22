#!/bin/bash
# restore.sh

# Exit on any error
set -e

# Configuration
BACKUP_DIR="$HOME/Documents/Red Cliff Record/Backups"
DATABASE_NAME="redcliffrecord"
DB_NAME="redcliffrecord"

# Find the most recent backup file
DUMP_FILE=$(ls "$BACKUP_DIR"/"$DATABASE_NAME"-backup-*.dump | sort -r | head -n1)

# Check if backup file exists
if [ ! -f "$DUMP_FILE" ]; then
    echo "No backup files found in: $BACKUP_DIR"
    exit 1
fi

echo "Using backup file: $DUMP_FILE"

# Drop database if exists and create a fresh one
dropdb -U postgres --if-exists "$DB_NAME"
createdb -U postgres "$DB_NAME"

# Restore to the fresh database
pg_restore -U postgres -d "$DB_NAME" -c -v --if-exists "$DUMP_FILE"
