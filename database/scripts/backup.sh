#!/bin/bash
# backup.sh

# Exit on any error
set -e

# Configuration
BACKUP_DIR="$HOME/Backups"
DATABASE_NAME="redcliffrecord"
DATE=$(date +%Y-%m-%d-%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/$DATABASE_NAME-backup-$DATE.dump"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup with CREATE DATABASE command
pg_dump -U postgres -F c -v -C "$DATABASE_NAME" > "$BACKUP_FILE"

echo "Backup created at: $BACKUP_FILE"
