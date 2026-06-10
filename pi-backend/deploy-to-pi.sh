#!/bin/bash

# Quick deploy script for Raspberry Pi
# Usage: ./deploy-to-pi.sh YOUR_PI_IP

PI_IP=$1
PI_USER="steelheadforever"
PI_DIR="slackwater-backend"

if [ -z "$PI_IP" ]; then
  echo "Usage: ./deploy-to-pi.sh YOUR_PI_IP"
  exit 1
fi

echo "Deploying to Pi at $PI_USER@$PI_IP..."

# Copy updated files (exclude .env to preserve Pi configuration)
rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'data' --exclude '.env' \
  ./ $PI_USER@$PI_IP:~/$PI_DIR/

# Restart PM2 on Pi
ssh $PI_USER@$PI_IP << 'EOF'
cd ~/slackwater-backend
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
EOF

echo "Deployment complete!"
