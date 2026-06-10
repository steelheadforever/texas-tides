#!/bin/bash

# Slackwater Backend - Quick Start Script
# Starts both API and dashboard servers using PM2

set -e

echo "Starting Slackwater Backend..."
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  echo "Error: PM2 is not installed"
  echo "Install with: sudo npm install -g pm2"
  exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start both servers
pm2 start ecosystem.config.cjs

echo ""
echo "✓ Servers started successfully!"
echo ""
echo "Status:"
pm2 status
echo ""
echo "View logs:"
echo "  All logs:       pm2 logs"
echo "  API logs:       pm2 logs slackwater-api"
echo "  Dashboard logs: pm2 logs slackwater-dashboard"
echo ""
echo "Services:"
echo "  API:       http://localhost:3001"
echo "  Dashboard: http://localhost:8080/admin"
echo ""
