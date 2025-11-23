#!/bin/bash

# Auto-deployment script for Red Cliff Record
# This script polls for changes and rebuilds when main branch is updated

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BRANCH="main"
CHECK_INTERVAL=60  # Check every 60 seconds
LOG_FILE="$REPO_DIR/logs/auto-deploy.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting auto-deployment monitor for $REPO_DIR"

# Initial setup
cd "$REPO_DIR" || exit 1
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
                
                # Build the application
                log "Building application..."
                # Build hozo package first, then the main app
                if bun run build; then
                    log "Build successful"
                    
                    # Restart the server using PM2
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
done