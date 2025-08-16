# Auto-Deployment Setup

This directory contains scripts for automatically deploying Red Cliff Record when changes are pushed to the main branch.

## PM2 Setup (Recommended)

### Prerequisites

1. Install PM2 globally:

   ```bash
   npm install -g pm2
   ```

2. Ensure Git is configured with proper credentials to pull from your repository.

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

The `ecosystem.config.js` file in the root directory manages both:

- **red-cliff-record**: The main application
- **red-cliff-deploy**: The auto-deployment monitor that checks for updates every 60 seconds

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
