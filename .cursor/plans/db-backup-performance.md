# Plan: Database Backup Performance Improvements

## Overview

Improve backup/restore performance for large tables with embeddings (records, feed_entries) by adding parallel jobs and compression to the db-manager.sh script.

## Problem

- `records` and `feed_entries` tables have 768-dimensional vector embeddings (~3KB each)
- Current backup uses single-threaded `pg_dump --format=custom`
- Large embedding columns dominate backup size and time

## Solution

Switch to **directory format** with parallel jobs and compression:

- ~4x faster backups (parallel dump across tables)
- ~4x faster restores (parallel restore)
- Smaller files via zstd/gzip compression

## Trade-offs

| Format                 | Parallel dump | Parallel restore | Single file |
| ---------------------- | ------------- | ---------------- | ----------- |
| `custom` (current)     | No            | Yes              | Yes         |
| `directory` (proposed) | Yes           | Yes              | No (folder) |

File pattern changes from single `.dump` file to folder structure:

```
redcliffrecord-2025-01-15/
├── toc.dat
├── 3456.dat.zst
├── 3457.dat.zst
└── ...
```

## File to Modify

### `src/server/db/db-manager.sh`

#### 1. Add new default variables

```bash
PARALLEL_JOBS=4
COMPRESS_LEVEL=6
```

#### 2. Update help text

Add to Options section:

```
-j, --jobs N         Number of parallel jobs (default: 4)
-Z, --compress N     Compression level 0-9 (default: 6, 0=none)
```

#### 3. Add option parsing

```bash
-j|--jobs) PARALLEL_JOBS="$2"; shift ;;
-Z|--compress) COMPRESS_LEVEL="$2"; shift ;;
```

#### 4. Update do_backup function

Replace pg_dump call with directory format:

```bash
do_backup() {
    local source=$1
    local date=$(date +%Y-%m-%d-%H-%M-%S)
    local backup_path
    local dump_args="--format=directory --jobs=$PARALLEL_JOBS --verbose --no-owner --no-privileges --no-comments"

    # Add compression if level > 0
    if [ "$COMPRESS_LEVEL" -gt 0 ]; then
        dump_args="$dump_args --compress=zstd:$COMPRESS_LEVEL"
    fi

    if [ "$DATA_ONLY" = true ]; then
        backup_path="$BACKUP_DIR/${DATABASE_NAME}-data-${date}"
        dump_args="$dump_args --data-only --schema=public"
    else
        backup_path="$BACKUP_DIR/${DATABASE_NAME}-${date}"
        dump_args="$dump_args --schema=public --schema=drizzle"
    fi

    local db_url
    if [ "$source" = "local" ]; then
        db_url="$DATABASE_URL_LOCAL"
    else
        db_url="$DATABASE_URL_REMOTE"
    fi

    echo "Creating backup from $source database ($PARALLEL_JOBS jobs, compression level $COMPRESS_LEVEL)..."
    pg_dump "$db_url" $dump_args --file="$backup_path"

    echo "Backup created at: $backup_path"
}
```

#### 5. Update do_restore function

Update file finding to match directories:

```bash
# Find the most recent backup (now a directory)
if [ "$DATA_ONLY" = true ]; then
    dump_path=$(ls -d "$BACKUP_DIR"/"${DATABASE_NAME}"-data-[0-9]* 2>/dev/null | sort -r | head -n1)
else
    dump_path=$(ls -d "$BACKUP_DIR"/"${DATABASE_NAME}"-[0-9]* 2>/dev/null | sort -r | head -n1)
fi

if [ ! -d "$dump_path" ]; then
    echo "No suitable backup directories found in: $BACKUP_DIR"
    exit 1
fi
```

Add parallel jobs to restore args:

```bash
local restore_args="--dbname=$DATABASE_URL_LOCAL --jobs=$PARALLEL_JOBS --no-owner --no-privileges -v"
```

## Implementation Order

1. Add new variables and option parsing
2. Update help text
3. Modify do_backup for directory format + compression
4. Modify do_restore for directory detection + parallel jobs
5. Test with local backup/restore cycle

## Backward Compatibility

Old `.dump` files can still be restored manually with:

```bash
pg_restore --dbname=$DATABASE_URL_LOCAL old-backup.dump
```

The script will only find new directory-format backups automatically.
