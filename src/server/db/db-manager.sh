#!/bin/bash

# Exit on any error
set -e

# Default values
DATABASE_NAME="redcliffrecord"
BACKUP_DIR="$HOME/Documents/Red Cliff Record/Backups"
CLEAN_RESTORE=false

# Parse connection details from .env
if [ -f .env ]; then
    source .env
    # Ensure required environment variables exist
    if [ -z "$DATABASE_URL_LOCAL" ] || [ -z "$DATABASE_URL_REMOTE" ]; then
        echo "Error: DATABASE_URL_LOCAL or DATABASE_URL_REMOTE not found in .env"
        exit 1
    fi
else
    echo "Error: .env file not found"
    exit 1
fi

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
    echo "  -c, --clean           Clean restore (drop & recreate database, local only)"
    echo "  -h, --help            Show this help message"
    echo
    echo "Examples:"
    echo "  $0 backup local           # Backup from local database"
    echo "  $0 backup remote          # Backup from remote database"
    echo "  $0 restore local          # Restore to local database"
    echo "  $0 restore remote         # Restore to remote database"
    echo "  $0 -d mydb backup local   # Backup local database with custom name"
    echo "  $0 -c restore local       # Clean restore to local (drop & recreate)"
}

# Parse options
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -d|--database) DATABASE_NAME="$2"; shift ;;
        -b|--backup-dir) BACKUP_DIR="$2"; shift ;;
        -c|--clean) CLEAN_RESTORE=true ;;
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
        pg_dump "$DATABASE_URL_LOCAL" \
            --format=custom \
            --verbose \
            --no-owner \
            --no-privileges \
            --no-comments \
            --schema 'public' \
            --schema 'drizzle' \
            > "$backup_file"
    else
        pg_dump "$DATABASE_URL_REMOTE" \
            --format=custom \
            --verbose \
            --no-owner \
            --no-privileges \
            --no-comments \
            --schema 'public' \
            --schema 'drizzle' \
            > "$backup_file"
    fi

    echo "Backup created at: $backup_file"
}

# Function to perform clean database setup for local restore
do_clean_setup() {
    echo "Performing clean database setup..."
    
    # Parse postgres URL to get connection details
    local postgres_url=$(echo "$DATABASE_URL_LOCAL" | sed 's/\/redcliffrecord/\/postgres/')
    
    # Terminate all connections to the database
    psql "$postgres_url" -c "
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '$DATABASE_NAME'
        AND pid <> pg_backend_pid();"
    
    # Drop the database
    echo "Dropping database $DATABASE_NAME..."
    psql "$postgres_url" -c "DROP DATABASE IF EXISTS $DATABASE_NAME;"
    
    # Recreate the database
    echo "Creating database $DATABASE_NAME..."
    psql "$postgres_url" -c "CREATE DATABASE $DATABASE_NAME;"
    
    # Create extensions
    echo "Creating required extensions..."
    psql "$DATABASE_URL_LOCAL" -c "CREATE SCHEMA IF NOT EXISTS extensions;"
    psql "$DATABASE_URL_LOCAL" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;"
    psql "$DATABASE_URL_LOCAL" -c "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;"
    
    # Set up search path to include extensions schema for vector operations
    echo "Setting up search path for vector operations..."
    psql "$DATABASE_URL_LOCAL" -c "ALTER DATABASE $DATABASE_NAME SET search_path TO public, extensions;"
    
    echo "Clean setup completed"
}

# Function to perform restore
do_restore() {
    local target=$1
    
    # Find the most recent backup file
    local dump_file=$(ls "$BACKUP_DIR"/"${DATABASE_NAME}"-[0-9]*.dump 2>/dev/null | sort -r | head -n1)

    if [ ! -f "$dump_file" ]; then
        echo "No backup files found in: $BACKUP_DIR"
        exit 1
    fi

    echo "Using backup file: $dump_file"

    if [ "$target" = "local" ]; then
        # Check if clean restore was requested
        if [ "$CLEAN_RESTORE" = true ]; then
            echo "Clean restore requested for local database"
            do_clean_setup
        else
            echo "Restoring data to local database..."
            # Terminate existing connections except our own
            psql "$DATABASE_URL_LOCAL" -c "
                SELECT pg_terminate_backend(pg_stat_activity.pid)
                FROM pg_stat_activity
                WHERE pg_stat_activity.datname = '$DATABASE_NAME'
                AND pid <> pg_backend_pid();"
        fi

        pg_restore --dbname="$DATABASE_URL_LOCAL" \
            --clean \
            --if-exists \
            --no-owner \
            --no-privileges \
            -v "$dump_file"
    else
        if [ "$CLEAN_RESTORE" = true ]; then
            echo "Warning: Clean restore is only supported for local databases"
            echo "Proceeding with standard restore to remote database..."
        fi
        echo "Restoring data to remote database..."
        pg_restore "$DATABASE_URL_REMOTE" \
            --clean \
            --if-exists \
            --no-owner \
            --no-privileges \
            -v "$dump_file"
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
