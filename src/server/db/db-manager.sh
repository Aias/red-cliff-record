#!/bin/bash

# Exit on any error
set -e

# Default values
DATABASE_NAME="redcliffrecord"
BACKUP_DIR="$HOME/Documents/Red Cliff Record/Backups"
SUPABASE_HOST="aws-0-us-west-1.pooler.supabase.com"
SUPABASE_PORT="6543"
SUPABASE_USER="postgres.febiwifjeueentvcovkr"
SUPABASE_URL="postgres://$SUPABASE_USER@$SUPABASE_HOST:$SUPABASE_PORT/postgres"

# Function to print usage
print_usage() {
    echo "Usage: $0 [OPTIONS] COMMAND SOURCE [TARGET]"
    echo
    echo "Commands:"
    echo "  backup   Create a backup from SOURCE"
    echo "  restore  Restore to TARGET from most recent backup of SOURCE"
    echo
    echo "Source/Target:"
    echo "  local    Local PostgreSQL database"
    echo "  remote   Supabase remote database"
    echo
    echo "Options:"
    echo "  -d, --database NAME    Database name (default: redcliffrecord)"
    echo "  -b, --backup-dir DIR   Backup directory (default: ~/Documents/Red Cliff Record/Backups)"
    echo "  -h, --help            Show this help message"
    echo
    echo "Examples:"
    echo "  $0 backup local                  # Backup local database"
    echo "  $0 backup remote                 # Backup remote database"
    echo "  $0 restore local                 # Restore to local from local backup"
    echo "  $0 restore remote                # Restore to remote from remote backup"
    echo "  $0 restore remote local          # Restore to local from remote backup"
    echo "  $0 -d mydb backup local          # Backup local database with custom name"
}

# Parse options
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -d|--database) DATABASE_NAME="$2"; shift ;;
        -b|--backup-dir) BACKUP_DIR="$2"; shift ;;
        -h|--help) print_usage; exit 0 ;;
        *) break ;;
    esac
    shift
done

# Validate command and source
COMMAND=$1
SOURCE=$2
TARGET=${3:-$SOURCE}  # If no target specified, use source

if [[ ! "$COMMAND" =~ ^(backup|restore)$ ]] || [[ ! "$SOURCE" =~ ^(local|remote)$ ]] || [[ ! "$TARGET" =~ ^(local|remote)$ ]]; then
    print_usage
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to perform backup
do_backup() {
    local source=$1
    local date=$(date +%Y-%m-%d-%H-%M-%S)
    local backup_file="$BACKUP_DIR/${DATABASE_NAME}-${source}-${date}.dump"

    echo "Creating backup from $source database..."
    
    if [ "$source" = "local" ]; then
        pg_dump -U postgres -F c -v -C "$DATABASE_NAME" > "$backup_file"
    else
        pg_dump "$SUPABASE_URL" \
            --format=custom \
            --verbose \
            --clean \
            --if-exists \
            --quote-all-identifiers \
            --no-owner \
            --no-privileges \
            --no-comments \
            --exclude-schema 'extensions|graphql|graphql_public|net|tiger|pgbouncer|vault|realtime|supabase_functions|storage|pg*|information_schema|auth' \
            --schema '*' \
            > "$backup_file"
    fi

    echo "Backup created at: $backup_file"
}

# Function to perform restore
do_restore() {
    local source=$1
    local target=$2
    
    # Find the most recent backup file for the source
    local dump_file=$(ls "$BACKUP_DIR"/"${DATABASE_NAME}-${source}"-*.dump 2>/dev/null | sort -r | head -n1)

    if [ ! -f "$dump_file" ]; then
        echo "No backup files found for $source in: $BACKUP_DIR"
        exit 1
    fi

    echo "Using backup file: $dump_file"

    if [ "$target" = "local" ]; then
        # Restore to local
        local target_db="${DATABASE_NAME}-${source}"
        
        # Close existing connections
        psql -U postgres -d postgres -c "
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '$target_db'
            AND pid <> pg_backend_pid();"

        # Drop and create fresh database
        dropdb -U postgres --if-exists "$target_db"
        createdb -U postgres "$target_db"

        # Restore
        pg_restore -U postgres -d "$target_db" -c -v --if-exists "$dump_file"
    else
        # Restore to remote
        pg_restore -h $SUPABASE_HOST \
                  -p $SUPABASE_PORT \
                  -U $SUPABASE_USER \
                  -d postgres \
                  --clean --if-exists -v \
                  --no-owner --no-privileges \
                  --no-comments \
                  "$dump_file"
    fi

    echo "Restore completed successfully"
}

# Execute command
case $COMMAND in
    backup)
        do_backup $SOURCE
        ;;
    restore)
        do_restore $SOURCE $TARGET
        ;;
esac