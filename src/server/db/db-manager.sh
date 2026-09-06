#!/bin/bash

# Exit on any error
set -e

# Default values
BACKUP_DIR="$HOME/Documents/Red Cliff Record/Backups"
CLEAN_RESTORE=false
DATA_ONLY=false
DRY_RUN=false
RESTORE_FILE=""
SKIP_CONFIRM=false
CREATED_BACKUP_FILE=""

# Parse connection details from .env
if [ -f .env ]; then
    source .env
    # Ensure required environment variables exist
    if [ -z "$DATABASE_URL_PROD" ] || [ -z "$DATABASE_URL_DEV" ]; then
        echo "Error: DATABASE_URL_PROD and DATABASE_URL_DEV must be configured in .env"
        exit 1
    fi
else
    echo "Error: .env file not found"
    exit 1
fi

# Extract database name from connection URL
get_database_name() {
  local url=$1
  # Extract from postgresql://user:pass@host:port/DATABASE_NAME
  local dbname=$(echo "$url" | sed -n 's|.*://[^/]*/\([^?]*\).*|\1|p')
  if [ -z "$dbname" ]; then
    echo "Error: Could not extract database name from URL" >&2
    exit 1
  fi
  echo "$dbname"
}

# Function to print usage
print_usage() {
    echo "Usage: $0 [OPTIONS] COMMAND ENVIRONMENT"
    echo
    echo "Commands:"
    echo "  backup ENV           Create a backup from specified environment (prod or dev)"
    echo "  restore ENV          Restore to specified environment (prod or dev)"
    echo "  reset ENV            Reset database (drop & recreate with extensions, dev only)"
    echo "  seed ENV             Seed database with initial data (predicates and core records, dev only)"
    echo "  clone-prod-to-dev    Clone production database to development (completely replaces dev)"
    echo
    echo "Notes:"
    echo "  - Restores terminate existing connections to the target database."
    echo "  - Reset and seed are restricted to dev environment for safety."
    echo
    echo "Options:"
    echo "  -b, --backup-dir DIR   Backup directory (default: ~/Documents/Red Cliff Record/Backups)"
    echo "  -c, --clean            Clean restore (drop & recreate database)"
    echo "  -D, --data-only        Backup/Restore data only (public schema only, excludes migration history)"
    echo "  -f, --file PATH        Restore from a specific backup file instead of auto-discovering"
    echo "  -n, --dry-run          Print commands without executing them"
    echo "  -y, --yes              Skip confirmation prompts"
    echo "  -h, --help             Show this help message"
    echo
    echo "Backup files are named by environment: prod-{timestamp}.dump, dev-data-{timestamp}.dump"
    echo "Restore auto-discovers the most recent backup file unless --file is specified."
    echo
    echo "Examples:"
    echo "  $0 backup prod                       # Backup from production database"
    echo "  $0 backup dev                        # Backup from development database"
    echo "  $0 restore dev                       # Restore most recent backup to dev"
    echo "  $0 -f path/to/file.dump restore dev  # Restore specific file to dev"
    echo "  $0 --dry-run restore dev             # Print restore commands without executing"
    echo "  $0 -c restore dev                    # Clean restore to dev (drop & recreate)"
    echo "  $0 -D backup prod                    # Backup data only from production"
    echo "  $0 -D restore dev                    # Restore data only to development"
    echo "  $0 reset dev                         # Reset dev database (fresh start)"
    echo "  $0 seed dev                          # Seed dev database with initial data"
    echo "  $0 clone-prod-to-dev                 # Clone production to development"
}

# Parse options
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -b|--backup-dir) BACKUP_DIR="$2"; shift ;;
        -c|--clean) CLEAN_RESTORE=true ;;
        -D|--data-only) DATA_ONLY=true ;;
        -f|--file) RESTORE_FILE="$2"; shift ;;
        -n|--dry-run) DRY_RUN=true ;;
        -y|--yes) SKIP_CONFIRM=true ;;
        -h|--help) print_usage; exit 0 ;;
        *) break ;;
    esac
    shift
done

# Validate command and environment
COMMAND=$1
ENVIRONMENT=$2

if [[ "$COMMAND" == "clone-prod-to-dev" ]]; then
    # clone-prod-to-dev doesn't take an environment argument
    ENVIRONMENT=""
elif [[ ! "$COMMAND" =~ ^(backup|restore|reset|seed)$ ]] || [[ ! "$ENVIRONMENT" =~ ^(prod|dev)$ ]]; then
    print_usage
    exit 1
fi

print_arg() {
    local displayed_arg
    displayed_arg=$1
    if [[ "$displayed_arg" =~ ^(.*postgres(ql)?://)[^@/]+@(.*)$ ]]; then
        displayed_arg="${BASH_REMATCH[1]}<credentials>@${BASH_REMATCH[3]}"
    fi
    printf '%q ' "$displayed_arg"
}

print_cmd() {
    printf '[dry-run] '
    local arg
    for arg in "$@"; do
        print_arg "$arg"
    done
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
        local arg
        for arg in "$@"; do
            print_arg "$arg"
        done
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

    if [ "$target" = "prod" ]; then
        TARGET_LABEL="production"
        TARGET_DB_URL="$DATABASE_URL_PROD"
    else
        TARGET_LABEL="development"
        TARGET_DB_URL="$DATABASE_URL_DEV"
    fi

    DATABASE_NAME=$(get_database_name "$TARGET_DB_URL")
}

do_backup() {
    local source=$1
    local date=$(date +%Y-%m-%d-%H-%M-%S)
    local dump_args=(--format=custom --verbose --no-owner --no-privileges --no-comments)

    set_target "$source"

    if [ "$DATA_ONLY" = true ]; then
        echo "Preparing data-only backup..."
        CREATED_BACKUP_FILE="$BACKUP_DIR/${source}-data-${date}.dump"
        dump_args+=(--data-only --schema=public)
    else
        CREATED_BACKUP_FILE="$BACKUP_DIR/${source}-${date}.dump"
        dump_args+=(--schema=public --schema=drizzle)
    fi

    ensure_backup_dir

    echo "Creating backup from $TARGET_LABEL database..."
    run_cmd_with_redirect "$CREATED_BACKUP_FILE" pg_dump "$TARGET_DB_URL" "${dump_args[@]}"

    echo "Backup created at: $CREATED_BACKUP_FILE"
}

do_clean_setup() {
    local db_url=$1
    local target_label=$2
    local label_suffix=""

    if [ -n "$target_label" ]; then
        label_suffix=" ($target_label)"
    fi

    echo "Performing clean database setup${label_suffix}..."

    local db_name=$(echo "$db_url" | sed 's|.*/||')
    local postgres_url=$(echo "$db_url" | sed "s|/${db_name}|/postgres|")
    local db_exists

    if [ "$DRY_RUN" = true ]; then
        print_cmd psql -X -v ON_ERROR_STOP=1 "$postgres_url" -tAc "SELECT 1 FROM pg_database WHERE datname = '$db_name'"
        db_exists=1
    else
        db_exists=$(psql -X -v ON_ERROR_STOP=1 "$postgres_url" -tAc "SELECT 1 FROM pg_database WHERE datname = '$db_name'")
    fi

    if [ "$db_exists" = "1" ]; then
        echo "Terminating connections to existing database..."
        run_cmd psql -X -v ON_ERROR_STOP=1 "$postgres_url" -c "
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '$db_name'
            AND pid <> pg_backend_pid();"

        echo "Dropping database $db_name..."
        run_cmd psql -X -v ON_ERROR_STOP=1 "$postgres_url" -c "DROP DATABASE \"$db_name\";"
    else
        echo "Database $db_name does not exist, will create it..."
    fi

    echo "Creating database $db_name..."
    run_cmd psql -X -v ON_ERROR_STOP=1 "$postgres_url" -c "CREATE DATABASE \"$db_name\";"

    echo "Creating required extensions..."
    run_cmd psql -X -v ON_ERROR_STOP=1 "$db_url" -c "CREATE SCHEMA IF NOT EXISTS extensions;"
    run_cmd psql -X -v ON_ERROR_STOP=1 "$db_url" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;"
    run_cmd psql -X -v ON_ERROR_STOP=1 "$db_url" -c "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;"

    echo "Setting up search path for vector operations..."
    run_cmd psql -X -v ON_ERROR_STOP=1 "$db_url" -c "ALTER DATABASE \"$db_name\" SET search_path TO public, extensions;"

    echo "Clean setup completed"
}

sync_zero_publication() {
    local target=$1
    local db_url=$2
    local node_env

    if [ "$target" = "prod" ]; then
        node_env=production
    else
        node_env=development
    fi

    echo "Synchronizing Zero publication for $TARGET_LABEL database..."
    if [ "$DRY_RUN" = true ]; then
        printf '[dry-run] NODE_ENV=%q DATABASE_URL=%q DATABASE_URL_PROD=%q DATABASE_URL_DEV=%q ' "$node_env" '<restore-target>' '<restore-target>' '<restore-target>'
        printf '%q ' bun run zero:publication
        printf '\n'
        return 0
    fi

    if ! NODE_ENV="$node_env" DATABASE_URL="$db_url" DATABASE_URL_PROD="$db_url" DATABASE_URL_DEV="$db_url" bun run zero:publication; then
        echo "Error: Zero publication sync failed for $target"
        return 1
    fi
}

do_restore() {
    local target=$1
    local dump_file
    local restore_args

    set_target "$target"

    if [ -n "$RESTORE_FILE" ]; then
        dump_file="$RESTORE_FILE"
        if [ ! -f "$dump_file" ] && [ "$DRY_RUN" = false ]; then
            echo "Error: Specified backup file not found: $dump_file"
            exit 1
        fi
    else
        if [ "$DATA_ONLY" = true ]; then
            dump_file=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${target}-data-[0-9]*.dump" -print 2>/dev/null | LC_ALL=C sort -r | head -n1 || true)
        else
            dump_file=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${target}-[0-9]*.dump" ! -name "${target}-data-*.dump" -print 2>/dev/null | LC_ALL=C sort -r | head -n1 || true)
        fi

        if [ -z "$dump_file" ] || [ ! -f "$dump_file" ]; then
            if [ "$DRY_RUN" = true ]; then
                if [ "$DATA_ONLY" = true ]; then
                    dump_file="$BACKUP_DIR/${target}-data-DRYRUN.dump"
                else
                    dump_file="$BACKUP_DIR/${target}-DRYRUN.dump"
                fi
                echo "Dry run: no matching backup file found, using placeholder: $dump_file"
            else
                echo "No suitable backup files found in: $BACKUP_DIR"
                if [ "$DATA_ONLY" = true ]; then
                    echo "Expected pattern: ${target}-data-*.dump"
                else
                    echo "Expected pattern: ${target}-*.dump (excluding ${target}-data-*.dump)"
                fi
                exit 1
            fi
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
        local db_name=$(echo "$TARGET_DB_URL" | sed 's|.*/||')
        echo "Terminating connections to $TARGET_LABEL database..."
        run_cmd psql -X -v ON_ERROR_STOP=1 "$TARGET_DB_URL" -c "
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '$db_name'
            AND pid <> pg_backend_pid();"
    fi

    restore_args=(--dbname="$TARGET_DB_URL" --no-owner --no-privileges --verbose --exit-on-error --single-transaction)

    if [ "$DATA_ONLY" = true ]; then
        restore_args+=(--data-only --disable-triggers)
    else
        restore_args+=(--clean --if-exists)
    fi

    if ! run_cmd pg_restore "${restore_args[@]}" "$dump_file"; then
        echo "Error: Restore to $target failed"
        return 1
    fi

    sync_zero_publication "$target" "$TARGET_DB_URL"
    echo "Restore completed successfully"
}

# Function to perform reset (clean setup only)
do_reset() {
    local target=$1
    if [ "$target" = "prod" ]; then
        echo "Error: Cannot reset production database"
        echo ""
        echo "To reset the development database instead:"
        echo "  $0 reset dev"
        echo ""
        echo "To clone production to development:"
        echo "  $0 clone-prod-to-dev"
        exit 1
    fi

    set_target "$target"
    echo "Resetting database (dropping and recreating)..."
    do_clean_setup "$TARGET_DB_URL" "$TARGET_LABEL"
    echo "Database reset successfully"
}

# Function to perform seed
do_seed() {
    local target=$1
    if [ "$target" = "prod" ]; then
        echo "Error: Cannot seed production database"
        echo ""
        echo "To seed the development database:"
        echo "  $0 seed dev"
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

do_clone_prod_to_dev() {
    local prod_db=$(get_database_name "$DATABASE_URL_PROD")
    local dev_db=$(get_database_name "$DATABASE_URL_DEV")

    echo "WARNING: This will completely replace the dev database with production data."
    echo "  Production: $prod_db"
    echo "  Development: $dev_db"
    echo ""

    if [ "$DRY_RUN" = false ] && [ "$SKIP_CONFIRM" = false ]; then
        echo "Press Ctrl+C to cancel, or Enter to continue..."
        read -r
    fi

    DATA_ONLY=false
    CLEAN_RESTORE=true
    RESTORE_FILE=""

    echo "[1/2] Backing up production database (schema + data)..."
    do_backup prod

    RESTORE_FILE="$CREATED_BACKUP_FILE"
    echo "[2/2] Restoring production backup to development..."
    do_restore dev

    echo "✓ Successfully cloned production to development"
    echo "  Backup saved: $CREATED_BACKUP_FILE"
}

# Execute command
case $COMMAND in
    backup)
        do_backup $ENVIRONMENT
        ;;
    restore)
        do_restore $ENVIRONMENT
        ;;
    reset)
        do_reset $ENVIRONMENT
        ;;
    seed)
        do_seed $ENVIRONMENT
        ;;
    clone-prod-to-dev)
        do_clone_prod_to_dev
        ;;
esac
