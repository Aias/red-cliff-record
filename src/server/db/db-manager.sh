#!/bin/bash

# Exit on any error
set -e

# Default values
DATABASE_NAME="redcliffrecord"
BACKUP_DIR="$HOME/Documents/Red Cliff Record/Backups"
CLEAN_RESTORE=false
DATA_ONLY=false
DRY_RUN=false

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
    echo "  reset TARGET     Reset database (drop & recreate with extensions, local only)"
    echo "  seed TARGET      Seed database with initial data (predicates and core records)"
    echo
    echo "Notes:"
    echo "  - Restores terminate existing connections to the target database."
    echo
    echo "Options:"
    echo "  -d, --database NAME    Database name (default: redcliffrecord)"
    echo "  -b, --backup-dir DIR   Backup directory (default: ~/Documents/Red Cliff Record/Backups)"
    echo "  -c, --clean           Clean restore (drop & recreate database)"
    echo "  -D, --data-only       Backup/Restore data only (public schema only, excludes migration history)"
    echo "  -n, --dry-run         Print commands without executing them"
    echo "  -h, --help            Show this help message"
    echo
    echo "Examples:"
    echo "  $0 backup local           # Backup from local database"
    echo "  $0 backup remote          # Backup from remote database"
    echo "  $0 restore local          # Restore to local database"
    echo "  $0 restore remote         # Restore to remote database"
    echo "  $0 --dry-run restore remote # Print restore commands without executing"
    echo "  $0 -d mydb backup local   # Backup local database with custom name"
    echo "  $0 -c restore local       # Clean restore to local (drop & recreate)"
    echo "  $0 -D backup local        # Backup data only from local database"
    echo "  $0 -D restore local       # Restore data only to local database"
    echo "  $0 reset local            # Reset local database (fresh start)"
    echo "  $0 seed local             # Seed local database with initial data"
}

# Parse options
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -d|--database) DATABASE_NAME="$2"; shift ;;
        -b|--backup-dir) BACKUP_DIR="$2"; shift ;;
        -c|--clean) CLEAN_RESTORE=true ;;
        -D|--data-only) DATA_ONLY=true ;;
        -n|--dry-run) DRY_RUN=true ;;
        -h|--help) print_usage; exit 0 ;;
        *) break ;;
    esac
    shift
done

# Validate command and location
COMMAND=$1
LOCATION=$2

if [[ ! "$COMMAND" =~ ^(backup|restore|reset|seed)$ ]] || [[ ! "$LOCATION" =~ ^(local|remote)$ ]]; then
    print_usage
    exit 1
fi

print_cmd() {
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
}

run_cmd() {
    if [ "$DRY_RUN" = true ]; then
        print_cmd "$@"
        return 0
    fi

    "$@"
}

run_cmd_with_redirect() {
    local output_file=$1
    shift

    if [ "$DRY_RUN" = true ]; then
        printf '[dry-run] '
        printf '%q ' "$@"
        printf '> %q\n' "$output_file"
        return 0
    fi

    "$@" > "$output_file"
}

ensure_backup_dir() {
    run_cmd mkdir -p "$BACKUP_DIR"
}

set_target() {
    local target=$1

    if [ "$target" = "local" ]; then
        TARGET_LABEL="local"
        TARGET_DB_URL="$DATABASE_URL_LOCAL"
    else
        TARGET_LABEL="remote"
        TARGET_DB_URL="$DATABASE_URL_REMOTE"
    fi
}

# Function to perform backup
do_backup() {
    local source=$1
    local date=$(date +%Y-%m-%d-%H-%M-%S)
    local backup_file
    local dump_args=(--format=custom --verbose --no-owner --no-privileges --no-comments)

    set_target "$source"

    if [ "$DATA_ONLY" = true ]; then
        echo "Preparing data-only backup..."
        backup_file="$BACKUP_DIR/${DATABASE_NAME}-data-${date}.dump"
        dump_args+=(--data-only --schema=public)
    else
        backup_file="$BACKUP_DIR/${DATABASE_NAME}-${date}.dump"
        dump_args+=(--schema=public --schema=drizzle)
    fi

    ensure_backup_dir

    echo "Creating backup from $TARGET_LABEL database..."
    run_cmd_with_redirect "$backup_file" pg_dump "$TARGET_DB_URL" "${dump_args[@]}"

    echo "Backup created at: $backup_file"
}

# Function to perform clean database setup for local restore
do_clean_setup() {
    local db_url=$1
    local target_label=$2
    local label_suffix=""

    if [ -n "$target_label" ]; then
        label_suffix=" ($target_label)"
    fi

    echo "Performing clean database setup${label_suffix}..."
    
    # Parse postgres URL to get connection details
    local postgres_url=$(echo "$db_url" | sed "s|/${DATABASE_NAME}|/postgres|")
    
    # Check if database exists
    local db_exists

    if [ "$DRY_RUN" = true ]; then
        print_cmd psql "$postgres_url" -tAc "SELECT 1 FROM pg_database WHERE datname = '$DATABASE_NAME'"
        db_exists=1
    else
        db_exists=$(psql "$postgres_url" -tAc "SELECT 1 FROM pg_database WHERE datname = '$DATABASE_NAME'")
    fi
    
    if [ "$db_exists" = "1" ]; then
        # Terminate all connections to the database if it exists
        echo "Terminating connections to existing database..."
        run_cmd psql "$postgres_url" -c "
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '$DATABASE_NAME'
            AND pid <> pg_backend_pid();"
        
        # Drop the database
        echo "Dropping database $DATABASE_NAME..."
        run_cmd psql "$postgres_url" -c "DROP DATABASE $DATABASE_NAME;"
    else
        echo "Database $DATABASE_NAME does not exist, will create it..."
    fi
    
    # Create the database
    echo "Creating database $DATABASE_NAME..."
    run_cmd psql "$postgres_url" -c "CREATE DATABASE $DATABASE_NAME;"
    
    # Create extensions
    echo "Creating required extensions..."
    run_cmd psql "$db_url" -c "CREATE SCHEMA IF NOT EXISTS extensions;"
    run_cmd psql "$db_url" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;"
    run_cmd psql "$db_url" -c "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;"
    
    # Set up search path to include extensions schema for vector operations
    echo "Setting up search path for vector operations..."
    run_cmd psql "$db_url" -c "ALTER DATABASE $DATABASE_NAME SET search_path TO public, extensions;"
    
    echo "Clean setup completed"
}

# Function to perform restore
do_restore() {
    local target=$1
    local dump_file
    local restore_args

    set_target "$target"
    
    # Find the most recent backup file based on type
    if [ "$DATA_ONLY" = true ]; then
        dump_file=$(ls "$BACKUP_DIR"/"${DATABASE_NAME}"-data-[0-9]*.dump 2>/dev/null | sort -r | head -n1)
    else
        dump_file=$(ls "$BACKUP_DIR"/"${DATABASE_NAME}"-[0-9]*.dump 2>/dev/null | sort -r | head -n1)
    fi

    if [ -z "$dump_file" ] || [ ! -f "$dump_file" ]; then
        if [ "$DRY_RUN" = true ]; then
            if [ "$DATA_ONLY" = true ]; then
                dump_file="$BACKUP_DIR/${DATABASE_NAME}-data-DRYRUN.dump"
            else
                dump_file="$BACKUP_DIR/${DATABASE_NAME}-DRYRUN.dump"
            fi
            echo "Dry run: no matching backup file found, using placeholder: $dump_file"
        else
            echo "No suitable backup files found in: $BACKUP_DIR"
            if [ "$DATA_ONLY" = true ]; then
                echo "Looking for files matching pattern: ${DATABASE_NAME}-data-*.dump"
            else
                echo "Looking for files matching pattern: ${DATABASE_NAME}-*.dump"
            fi
            exit 1
        fi
    fi

    echo "Using backup file: $dump_file"

    if [ "$CLEAN_RESTORE" = true ] && [ "$DATA_ONLY" = false ]; then
        echo "Clean restore requested for $TARGET_LABEL database"
        do_clean_setup "$TARGET_DB_URL" "$TARGET_LABEL"
    elif [ "$CLEAN_RESTORE" = true ] && [ "$DATA_ONLY" = true ]; then
        echo "Warning: Clean restore (-c) ignored when using data-only (-D) mode to avoid dropping schema."
    fi

    echo "Restoring data to $TARGET_LABEL database..."
    if [ "$CLEAN_RESTORE" = true ] && [ "$DATA_ONLY" = false ]; then
        echo "Skipping additional connection termination after clean restore."
    else
        echo "Terminating connections to $TARGET_LABEL database..."
        run_cmd psql "$TARGET_DB_URL" -c "
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '$DATABASE_NAME'
            AND pid <> pg_backend_pid();"
    fi

    restore_args=(--dbname="$TARGET_DB_URL" --no-owner --no-privileges -v)

    if [ "$DATA_ONLY" = true ]; then
        # For data-only restore, we use --data-only.
        # --clean causes issues with --data-only in pg_restore in some versions,
        # but generally we want to truncate. However, since we just did a clean reset
        # and migration, the tables are empty anyway.
        # --single-transaction helps performance by wrapping the entire restore in one transaction
        restore_args+=(--data-only --disable-triggers --single-transaction)
    else
        # Full restore
        restore_args+=(--clean --if-exists)
    fi

    run_cmd pg_restore "${restore_args[@]}" "$dump_file"

    echo "Restore completed successfully"
}

# Function to perform reset (clean setup only)
do_reset() {
    local target=$1
    if [ "$target" != "local" ]; then
        echo "Error: Reset is only supported for local database"
        exit 1
    fi
    
    echo "Resetting database (dropping and recreating)..."
    do_clean_setup "$DATABASE_URL_LOCAL" "local"
    echo "Database reset successfully"
}

# Function to perform seed
do_seed() {
    local target=$1
    if [ "$target" != "local" ]; then
        echo "Error: Seed is only supported for local database"
        exit 1
    fi
    
    echo "Seeding database with initial data..."
    run_cmd bun src/server/db/seed.ts
    local seed_exit_code=$?

    if [ "$DRY_RUN" = true ]; then
        echo "Dry run: seed skipped"
        return
    fi
    
    if [ "$seed_exit_code" -eq 0 ]; then
        echo "Database seeded successfully"
    else
        echo "Error: Seed failed"
        exit 1
    fi
}

# Execute command
case $COMMAND in
    backup)
        do_backup $LOCATION
        ;;
    restore)
        do_restore $LOCATION
        ;;
    reset)
        do_reset $LOCATION
        ;;
    seed)
        do_seed $LOCATION
        ;;
esac
