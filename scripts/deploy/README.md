# Auto-Deployment Setup

This directory contains scripts for automatically deploying Red Cliff Record when changes are pushed to the main branch.

## PM2 Setup (Recommended)

### Prerequisites

1. Install PM2 globally:

   ```bash
   npm install -g pm2
   ```

2. Ensure Git is configured with proper credentials to pull from your repository.

3. Ensure Bun is installed (required for running the application).

### Initial Build

Before running the deployment setup, you need to build the application:

```bash
bun run build
```

This creates the production build in the `.output/server/` directory.

### Installation

1. Clone the repository and navigate to it:

   ```bash
   cd /path/to/red-cliff-record
   ```

2. Run the setup script:

   ```bash
   ./scripts/deploy/setup-pm2.sh
   ```

   This will:
   - Start both the application and auto-deployment monitor
   - Save the PM2 configuration
   - Configure PM2 to start on system boot

3. Follow the instructions from `pm2 startup` to enable auto-start on boot.

### Configuration

The `ecosystem.config.cjs` file in the root directory manages both:

- **red-cliff-record**: The main application (runs on `bun .output/server/index.mjs`)
- **red-cliff-deploy**: The auto-deployment monitor that checks for updates every 60 seconds

### Logging

Logs are automatically rotated and stored in the `logs/` directory. PM2 handles log rotation automatically.

**Log Files:**

- `errors.log` - Application errors
- `output.log` - Application stdout
- `combined.log` - Merged stdout and stderr for the app
- `deploy-error.log` - Deployment script errors
- `deploy-out.log` - Deployment script stdout
- `deploy-combined.log` - Merged logs for deployment script

### Log Rotation

PM2 has built-in log rotation that automatically rotates logs when they reach:

- 10MB in size (configurable)
- Or after 7 days (configurable)

You can manually rotate logs with:

```bash
pm2 reloadLogs
```

### Managing the Services

- **Check status**: `pm2 status`
- **View all logs**: `pm2 logs`
- **View app logs**: `pm2 logs red-cliff-record`
- **View deploy logs**: `pm2 logs red-cliff-deploy`
- **Restart all**: `pm2 restart all`
- **Stop all**: `pm2 stop all`
- **Real-time monitoring**: `pm2 monit`

## Manual Testing

To test the auto-deployment script manually:

```bash
cd /path/to/red-cliff-record
./scripts/deploy/auto-deploy.sh
```

The script will check for updates every 60 seconds and automatically pull, build, and restart the application when changes are detected on the main branch.

## Troubleshooting

### Application won't start

1. Check if the build exists: `ls -la .output/server/index.mjs`
2. If missing, run: `bun run build`
3. Check PM2 logs: `pm2 logs red-cliff-record`
4. Verify environment variables are set correctly

### Auto-deployment not working

1. Check deployment logs: `pm2 logs red-cliff-deploy`
2. Verify Git remote is configured: `git remote -v`
3. Test manual deployment: `./scripts/deploy/auto-deploy.sh`
4. Ensure the script has execute permissions: `chmod +x scripts/deploy/auto-deploy.sh`

### PM2 not starting on boot

1. Run: `pm2 startup` and follow the instructions
2. Save PM2 state: `pm2 save`
3. Check if startup script is installed: `pm2 list` should show processes
