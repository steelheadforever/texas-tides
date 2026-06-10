#!/bin/bash

# Deploy Texas Tides web app to Raspberry Pi
# Usage: ./deploy-web-app.sh YOUR_PI_IP

PI_IP=$1
PI_USER="steelheadforever"

if [ -z "$PI_IP" ]; then
  echo "Usage: ./deploy-web-app.sh YOUR_PI_IP"
  exit 1
fi

echo "Deploying Texas Tides web app to $PI_USER@$PI_IP..."

# Copy web app files to Pi (excluding pi-backend directory)
rsync -av --exclude 'pi-backend' --exclude '.git' --exclude '.DS_Store' \
  --exclude 'node_modules' --exclude 'deploy-web-app.sh' \
  ./ $PI_USER@$PI_IP:~/slackwater-backend/web/

echo ""
echo "Web app deployed to Pi!"
echo "Access it at: http://$PI_IP:3001"
echo ""
echo "The web app is now served from your Pi backend server."
