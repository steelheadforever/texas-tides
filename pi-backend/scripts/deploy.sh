#!/bin/bash

# Slackwater Backend - Deploy Script
# Pulls latest code and restarts servers

set -e

echo "Deploying Slackwater Backend..."
echo ""

# Pull latest code
echo "1. Pulling latest code from Git..."
git pull

# Install/update dependencies
echo "2. Installing dependencies..."
npm install

# Run database migrations
echo "3. Running database migrations..."
npm run db:migrate

# Restart PM2 processes
echo "4. Restarting servers..."
pm2 restart all

echo ""
echo "✓ Deployment complete!"
echo ""
pm2 status
echo ""
