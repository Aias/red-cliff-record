#!/bin/bash
# backup-remote.sh

# Exit on any error
set -e

# Configuration
BACKUP_DIR="$HOME/Documents/Red Cliff Record/Backups"
DATE=$(date +%Y-%m-%d-%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/supabase-backup-$DATE.dump"

# Supabase connection URL (same as in your restore-remote.sh)
SUPABASE_URL="postgres://postgres.febiwifjeueentvcovkr@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup using custom format (-Fc) with verbosity (-v)
pg_dump "$SUPABASE_URL" \
  --format=custom \
  --verbose \
  --clean \
  --if-exists \
  --quote-all-identifiers \
  --no-owner \
  --no-privileges \
  --no-comments \
  --exclude-schema 'extensions|graphql|graphql_public|net|tiger|pgbouncer|vault|realtime|supabase_functions|storage|pg*|information_schema' \
  --schema '*' \
  > "$BACKUP_FILE"

echo "Backup created at: $BACKUP_FILE"