#!/bin/bash

# Slackwater Backend - Setup Script for Raspberry Pi
# This script sets up the backend server on a fresh Raspberry Pi

set -e  # Exit on error

echo "======================================"
echo "  Slackwater Backend Setup"
echo "======================================"
echo ""

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ]; then
  echo "Warning: This doesn't appear to be a Raspberry Pi"
  echo "Continuing anyway..."
fi

# Update system
echo "1. Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js (if not installed)
if ! command -v node &> /dev/null; then
  echo "2. Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "2. Node.js already installed ($(node --version))"
fi

# Install PM2 globally (if not installed)
if ! command -v pm2 &> /dev/null; then
  echo "3. Installing PM2..."
  sudo npm install -g pm2
else
  echo "3. PM2 already installed ($(pm2 --version))"
fi

# Create logs directory
echo "4. Creating logs directory..."
mkdir -p logs

# Install dependencies
echo "5. Installing npm dependencies..."
npm install

# Run database migrations
echo "6. Running database migrations..."
npm run db:migrate

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "7. Creating .env file from example..."
  cp .env.example .env
  echo ""
  echo "⚠️  IMPORTANT: Edit .env file and:"
  echo "   - Set a strong SESSION_SECRET"
  echo "   - Generate a new DASHBOARD_PASSWORD_HASH"
  echo "   - Configure CORS_ORIGIN for your domain"
  echo ""
else
  echo "7. .env file already exists"
fi

echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Generate dashboard password hash:"
echo "   node -e \"import('bcrypt').then(b => b.default.hash('YOUR_PASSWORD', 10).then(console.log))\""
echo ""
echo "3. Start the servers:"
echo "   npm run pm2:start"
echo ""
echo "4. Set PM2 to start on boot:"
echo "   pm2 startup"
echo "   pm2 save"
echo ""
