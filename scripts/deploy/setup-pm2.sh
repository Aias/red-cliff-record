#!/bin/bash

# Setup script for PM2 deployment on Mac mini

echo "Setting up PM2 for Red Cliff Record..."

# Create logs directory
mkdir -p logs

# Start both the app and auto-deploy monitor
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

echo ""
echo "PM2 setup complete!"
echo ""
echo "Useful PM2 commands:"
echo "  pm2 status              - Check status of all processes"
echo "  pm2 logs                - View all logs"
echo "  pm2 logs red-cliff-record - View app logs"
echo "  pm2 logs red-cliff-deploy - View deployment logs"
echo "  pm2 restart all         - Restart all processes"
echo "  pm2 stop all            - Stop all processes"
echo "  pm2 monit               - Real-time monitoring dashboard"