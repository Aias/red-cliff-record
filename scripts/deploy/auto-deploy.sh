#!/bin/bash

# Auto-deployment script for Red Cliff Record
# This script polls for changes and rebuilds when main branch is updated

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BRANCH="main"
CHECK_INTERVAL=60  # Check every 60 seconds
LOG_FILE="$REPO_DIR/logs/auto-deploy.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Initialize fnm to ensure correct Node version
export PATH="/Users/nicktrombley/.local/share/fnm:$PATH"
eval "$(fnm env --use-on-cd)"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if PM2 is available
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        log "ERROR: PM2 not found! Node version may have changed."
        log "Current Node version: $(node -v)"
        log "Current Node path: $(which node)"
        log "Please run: npm install -g pm2 && pm2 resurrect"
        return 1
    fi
    return 0
}

log "Starting auto-deployment monitor for $REPO_DIR"

# Initial setup
cd "$REPO_DIR" || exit 1

# Use the Node version from .nvmrc
if [ -f "$REPO_DIR/.nvmrc" ]; then
    log "Using Node version from .nvmrc: $(cat .nvmrc)"
    fnm use
fi

log "Node version: $(node -v)"
log "PM2 location: $(which pm2 2>&1 || echo 'NOT FOUND')"

# Verify PM2 is available at startup
if ! check_pm2; then
    log "FATAL: PM2 check failed at startup. Exiting."
    exit 1
fi

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
                    
                    # Restart the server using PM2
                    log "Restarting PM2 process..."
                    if check_pm2; then
                        if pm2 restart red-cliff-record; then
                            log "PM2 restart successful"
                        else
                            log "WARNING: PM2 restart failed, trying reload..."
                            pm2 reload red-cliff-record
                        fi
                    else
                        log "ERROR: Cannot restart - PM2 not available"
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