#!/bin/bash

# Auto-deployment script for Red Cliff Record
# This script polls for changes and rebuilds when main branch is updated

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BRANCH="main"
CHECK_INTERVAL=60  # Check every 60 seconds

# Source shell profile so version-managed tools (bun, node, pm2) are on PATH.
# Non-interactive shells (like those spawned by PM2) don't load these automatically.
for f in "$HOME/.profile" "$HOME/.bash_profile" "$HOME/.bashrc"; do
    [ -f "$f" ] && source "$f" 2>/dev/null
done

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

cd "$REPO_DIR" || exit 1

# Verify required tools are available
for cmd in git bun pm2; do
    if ! command -v "$cmd" &>/dev/null; then
        log "FATAL: $cmd not found on PATH. Exiting."
        exit 1
    fi
done

log "Starting auto-deployment monitor for $REPO_DIR"

LAST_COMMIT=$(git rev-parse HEAD)

while true; do
    # Fetch latest changes without merging
    git fetch origin $BRANCH --quiet
    
    # Get the latest commit on remote
    REMOTE_COMMIT=$(git rev-parse origin/$BRANCH)
    
    # Check if there are new changes
    if [ "$LAST_COMMIT" != "$REMOTE_COMMIT" ]; then
        log "New changes detected. Updating from $LAST_COMMIT to $REMOTE_COMMIT"
        
        # Pull latest changes
        log "Pulling latest changes..."
        if git pull origin $BRANCH; then
            log "Pull successful"
            
            # Install dependencies
            log "Installing dependencies..."
            if bun install; then
                log "Dependencies installed"

                # Backup production database before migration
                log "Backing up production database..."
                if ! "$REPO_DIR/src/server/db/db-manager.sh" -y backup prod; then
                    log "ERROR: Production backup failed, aborting deploy"
                    LAST_COMMIT=$REMOTE_COMMIT
                    sleep $CHECK_INTERVAL
                    continue
                fi

                # Run database migrations
                log "Running database migrations..."
                if ! NODE_ENV=production bunx drizzle-kit migrate; then
                    log "ERROR: Migration failed, aborting deploy"
                    LAST_COMMIT=$REMOTE_COMMIT
                    sleep $CHECK_INTERVAL
                    continue
                fi

                # Build the application
                log "Building application..."
                # Build hozo package first, then the main app
                if bun run build; then
                    log "Build successful"
                    
                    # Restart the server via PM2
                    log "Restarting PM2 process..."
                    if pm2 restart red-cliff-record; then
                        log "PM2 restart successful"
                    else
                        log "WARNING: PM2 restart failed, trying reload..."
                        pm2 reload red-cliff-record
                    fi
                    
                    log "Deployment complete!"
                    LAST_COMMIT=$REMOTE_COMMIT
                else
                    log "ERROR: Build failed"
                fi
            else
                log "ERROR: Failed to install dependencies"
            fi
        else
            log "ERROR: Git pull failed"
        fi
    fi
    
    sleep $CHECK_INTERVAL
donecies"
            fi
        else
            log "ERROR: Git pull failed"
        fi
    fi
    
    sleep $CHECK_INTERVAL
done