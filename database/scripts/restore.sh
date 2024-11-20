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

# Restore using postgres database as initial connection
# Since backup includes -C flag, we connect to postgres database
pg_restore -U postgres -d postgres -c -v --if-exists "$DUMP_FILE"
