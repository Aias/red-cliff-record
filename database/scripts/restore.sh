#!/bin/bash
# restore.sh

# Exit on any error
set -e

# Configuration
DB_NAME="redcliffrecord"
DUMP_FILE=".temp/backup.dump"

# Check if dump file exists
if [ ! -f "$DUMP_FILE" ]; then
    echo "Dump file not found: $DUMP_FILE"
    exit 1
fi

# Drop database if exists and create a fresh one
dropdb -U postgres --if-exists "$DB_NAME"
createdb -U postgres "$DB_NAME"

# Restore to the fresh database
pg_restore -U postgres -d "$DB_NAME" -c -v --if-exists "$DUMP_FILE"
