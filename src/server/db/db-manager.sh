#!/bin/bash

# Exit on any error
set -e

# Default values
DATABASE_NAME="redcliffrecord"
BACKUP_DIR="$HOME/Documents/Red Cliff Record/Backups"

# Parse connection details from DATABASE_URL_REMOTE
if [ -f .env ]; then
    source .env
    SUPABASE_URL="${DATABASE_URL_REMOTE}"
else
    echo "Error: .env file not found"
    exit 1
fi

SUPABASE_HOST="aws-0-us-west-1.pooler.supabase.com"
SUPABASE_PORT="6543"
SUPABASE_USER="postgres.febiwifjeueentvcovkr"

# Function to print usage
print_usage() {
    echo "Usage: $0 [OPTIONS] COMMAND SOURCE|TARGET"
    echo
    echo "Commands:"
    echo "  backup SOURCE    Create a backup from specified source (local or remote)"
    echo "  restore TARGET   Restore to specified target (local or remote)"
    echo
    echo "Options:"
    echo "  -d, --database NAME    Database name (default: redcliffrecord)"
    echo "  -b, --backup-dir DIR   Backup directory (default: ~/Documents/Red Cliff Record/Backups)"
    echo "  -h, --help            Show this help message"
    echo
    echo "Examples:"
    echo "  $0 backup local           # Backup from local database"
    echo "  $0 backup remote          # Backup from remote database"
    echo "  $0 restore local          # Restore to local database"
    echo "  $0 restore remote         # Restore to remote database"
    echo "  $0 -d mydb backup local   # Backup local database with custom name"
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

# Validate command and location
COMMAND=$1
LOCATION=$2

if [[ ! "$COMMAND" =~ ^(backup|restore)$ ]] || [[ ! "$LOCATION" =~ ^(local|remote)$ ]]; then
    print_usage
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to perform backup
do_backup() {
    local source=$1
    local date=$(date +%Y-%m-%d-%H-%M-%S)
    local backup_file="$BACKUP_DIR/${DATABASE_NAME}-${date}.dump"

    echo "Creating backup from $source database..."
    
    if [ "$source" = "local" ]; then
        pg_dump -U postgres \
            --format=custom \
            --verbose \
            --clean \
            --if-exists \
            --quote-all-identifiers \
            --no-owner \
            --no-privileges \
            --no-comments \
            --no-tablespaces \
            --schema 'public' \
            --schema 'integrations' \
            --schema 'operations' \
            --schema 'drizzle' \
            "$DATABASE_NAME" > "$backup_file"
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
            --no-tablespaces \
            --schema 'public' \
            --schema 'integrations' \
            --schema 'operations' \
            --schema 'drizzle' \
            > "$backup_file"
    fi

    echo "Backup created at: $backup_file"
}

# Function to perform restore
do_restore() {
    local target=$1
    
    # Find the most recent backup file - ignore legacy backup files with -backup- in the name
    local dump_file=$(ls "$BACKUP_DIR"/"${DATABASE_NAME}"-[0-9]*.dump 2>/dev/null | sort -r | head -n1)

    if [ ! -f "$dump_file" ]; then
        echo "No backup files found in: $BACKUP_DIR"
        exit 1
    fi

    echo "Using backup file: $dump_file"

    if [ "$target" = "local" ]; then
        # Restore to local
        local target_db="${DATABASE_NAME}"
        
        # Close existing connections
        psql -U postgres -d postgres -c "
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '$target_db'
            AND pid <> pg_backend_pid();"

        # Drop and create fresh database
        dropdb -U postgres --if-exists "$target_db"
        createdb -U postgres "$target_db"

        # Restore with clean options
        pg_restore -U postgres -d "$target_db" \
            --clean \
            --if-exists \
            --no-owner \
            --no-privileges \
            --no-comments \
            -v "$dump_file"
    else
        pg_restore -h $SUPABASE_HOST \
                  -p $SUPABASE_PORT \
                  -U $SUPABASE_USER \
                  -d postgres \
                  --clean \
                  --if-exists \
                  --no-owner \
                  --no-privileges \
                  --no-comments \
                  --no-tablespaces \
                  -v \
                  "$dump_file"
    fi

    echo "Restore completed successfully"
}

# Execute command
case $COMMAND in
    backup)
        do_backup $LOCATION
        ;;
    restore)
        do_restore $LOCATION
        ;;
esac