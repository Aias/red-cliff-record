#!/bin/bash

# Configuration
DB_NAME="redcliffrecord"
DUMP_FILE=".temp/backup.dump"

# Drop and recreate database
psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
psql -c "CREATE DATABASE $DB_NAME;"

# Restore from dump
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DB_NAME" "$DUMP_FILE"