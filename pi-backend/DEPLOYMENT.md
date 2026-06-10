# Slackwater Backend - Deployment Guide

This guide covers deploying the Slackwater Backend to your Raspberry Pi.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [Running the Servers](#running-the-servers)
5. [PM2 Process Management](#pm2-process-management)
6. [Background Jobs](#background-jobs)
7. [Deployment Updates](#deployment-updates)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Raspberry Pi (3B+ or newer recommended)
- Raspberry Pi OS (Bullseye or newer)
- Internet connection
- SSH access to your Pi

## Initial Setup

### 1. Connect to Your Raspberry Pi

```bash
ssh pi@your-pi-ip-address
```

### 2. Clone the Repository

```bash
cd ~
git clone https://github.com/yourusername/texas-tides.git
cd texas-tides/pi-backend
```

### 3. Run Setup Script

The setup script will install Node.js, PM2, and dependencies:

```bash
./scripts/setup.sh
```

This script will:
- Update system packages
- Install Node.js 20.x
- Install PM2 globally
- Create logs directory
- Install npm dependencies
- Run database migrations
- Create .env file from example

---

## Configuration

### 1. Edit Environment Variables

```bash
nano .env
```

**Important settings to change:**

```bash
# Change in production!
SESSION_SECRET=your-random-secret-here-use-a-long-string

# Generate a new password hash
DASHBOARD_PASSWORD_HASH=your-bcrypt-hash-here

# Set your domain (or use * for development)
CORS_ORIGIN=https://slackwater.app

# Optional: Adjust retention period (default 30 days)
RETENTION_DAYS=30
```

### 2. Generate Dashboard Password Hash

```bash
node -e "import('bcrypt').then(b => b.default.hash('YOUR_PASSWORD', 10).then(console.log))"
```

Copy the output and paste it as `DASHBOARD_PASSWORD_HASH` in your `.env` file.

---

## Running the Servers

### Quick Start (Using PM2)

```bash
# Start both servers
npm run pm2:start

# Check status
npm run pm2:logs
```

### Manual Start (Development)

```bash
# Terminal 1: Start API server
npm run start

# Terminal 2: Start dashboard
npm run dashboard
```

### Using Helper Scripts

```bash
# Start all services
./scripts/start.sh

# Stop all services
./scripts/stop.sh

# Deploy updates
./scripts/deploy.sh
```

---

## PM2 Process Management

PM2 manages both the API server and dashboard server.

### Basic Commands

```bash
# Start all servers
npm run pm2:start

# Stop all servers
npm run pm2:stop

# Restart all servers
npm run pm2:restart

# View logs
npm run pm2:logs

# Delete all processes
npm run pm2:delete
```

### Advanced PM2 Commands

```bash
# View process status
pm2 status

# View logs for specific service
pm2 logs slackwater-api
pm2 logs slackwater-dashboard

# Monitor resource usage
pm2 monit

# Restart specific service
pm2 restart slackwater-api
pm2 restart slackwater-dashboard
```

### Start on Boot

To make PM2 start automatically when your Pi boots:

```bash
# Generate startup script
pm2 startup

# Follow the instructions shown, then save
pm2 save
```

### View Process Info

```bash
# Detailed process information
pm2 info slackwater-api
pm2 info slackwater-dashboard
```

---

## Background Jobs

The API server runs automated background jobs:

### Jobs Schedule

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Cache Cleanup | Every hour | Remove expired cache entries |
| Analytics Aggregation | Every hour | Update daily/hourly stats |
| Data Cleanup | Daily at 2 AM | Delete old data (based on RETENTION_DAYS) |

### Job Logs

Background jobs log to the main API server logs:

```bash
pm2 logs slackwater-api | grep Job
```

### Manual Job Execution

To run all jobs immediately (for testing):

```bash
node -e "import('./src/jobs/scheduler.js').then(m => m.runAllJobsNow())"
```

---

## Deployment Updates

### Automated Deployment

Use the deploy script to pull latest code and restart:

```bash
./scripts/deploy.sh
```

This will:
1. Pull latest code from Git
2. Install/update dependencies
3. Run database migrations
4. Restart PM2 processes

### Manual Deployment

```bash
# Pull latest code
git pull

# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Restart servers
pm2 restart all
```

---

## Troubleshooting

### Check Server Status

```bash
pm2 status
```

### View Logs

```bash
# All logs
pm2 logs

# API server logs
pm2 logs slackwater-api

# Dashboard logs
pm2 logs slackwater-dashboard

# Saved log files
tail -f logs/api-combined.log
tail -f logs/dashboard-combined.log
```

### Common Issues

**Port Already in Use:**
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>
```

**Database Issues:**
```bash
# Check database files
ls -lh data/

# Run migrations again
npm run db:migrate
```

**PM2 Won't Start:**
```bash
# Delete all PM2 processes
pm2 delete all

# Clear PM2 logs
pm2 flush

# Start fresh
pm2 start ecosystem.config.cjs
```

**Memory Issues:**
```bash
# Check memory usage
free -h

# PM2 will restart if memory exceeds:
# - API: 500MB
# - Dashboard: 300MB
```

### Reset Everything

If you need to start fresh:

```bash
# Stop all processes
pm2 delete all

# Remove databases
rm -rf data/*.db

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Run migrations
npm run db:migrate

# Start fresh
pm2 start ecosystem.config.cjs
```

---

## Service URLs

Once running, access:

- **API Server:** http://your-pi-ip:3001
- **Admin Dashboard:** http://your-pi-ip:8080/admin
- **Health Check:** http://your-pi-ip:3001/health

## Next Steps

1. Set up reverse proxy (nginx) for HTTPS
2. Configure firewall rules
3. Set up automatic backups of `data/` directory
4. Monitor with PM2 Plus (optional)

---

## Support

For issues, check:
- Server logs: `pm2 logs`
- Health endpoint: `curl http://localhost:3001/health`
- PM2 status: `pm2 status`
