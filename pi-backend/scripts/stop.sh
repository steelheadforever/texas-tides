#!/bin/bash

# Slackwater Backend - Stop Script
# Stops all PM2 processes

set -e

echo "Stopping Slackwater Backend..."

pm2 stop all

echo ""
echo "✓ Servers stopped successfully!"
echo ""
pm2 status
echo ""
