# Cloudflare Pages Deployment Guide

This application is deployed on Cloudflare Pages with automatic deployments from GitHub.

## Initial Setup (Already Completed)

The site is already configured and live at [slackwater.app](https://slackwater.app). This guide is for reference if you need to recreate the setup.

### 1. Connect to Cloudflare Pages

1. Log into your Cloudflare account
2. Navigate to **Workers & Pages**
3. Click **Create Application** → **Pages** → **Connect to Git**
4. Select the `texas-tides` repository from GitHub
5. Configure build settings:
   - **Build command**: (leave empty)
   - **Build output directory**: `/`
   - **Root directory**: (leave empty)
6. Click **Save and Deploy**

### 2. Custom Domain Setup

1. In your Cloudflare Pages project, go to **Custom domains**
2. Click **Set up a custom domain**
3. Add `slackwater.app` (main domain)
4. Add `www.slackwater.app` (www subdomain)
5. Cloudflare automatically configures DNS if domain is already in your account

### 3. DNS Configuration

If your domain is registered elsewhere (e.g., Namecheap):

**Option A: Transfer nameservers to Cloudflare (Recommended)**
1. Add domain to Cloudflare (Dashboard → Add a site)
2. Cloudflare provides nameservers
3. Update nameservers at your registrar (Namecheap, GoDaddy, etc.)
4. DNS records are automatically configured by Cloudflare Pages

**Option B: Keep DNS at registrar**
1. Add CNAME record: `slackwater.app` → `texas-tides.pages.dev`
2. Add CNAME record: `www` → `texas-tides.pages.dev`

### 4. SSL/HTTPS

- Automatically provisioned and managed by Cloudflare
- Free SSL certificates for custom domains
- Forced HTTPS enabled by default

## Deployment Workflow

### Production Deployments

- **Trigger**: Every push to `main` branch
- **Process**: Automatic - no manual steps required
- **Time**: Typically 30-60 seconds
- **URL**: https://slackwater.app

### Preview Deployments

- **Trigger**: Push to any branch
- **URL Format**: `branch-name.texas-tides.pages.dev`
- **Pull Requests**: Cloudflare automatically comments with preview URL
- **Cleanup**: Preview deployments are retained for 30 days

## Managing Deployments

### View Build History

1. Go to Cloudflare Pages dashboard
2. Select your project
3. Click **Deployments** tab
4. View all production and preview deployments

### Rollback a Deployment

1. Go to **Deployments** tab
2. Find the deployment you want to rollback to
3. Click **...** menu → **Rollback to this deployment**
4. Confirm - site reverts immediately

### View Build Logs

1. Go to **Deployments** tab
2. Click on any deployment
3. Click **View build logs**
4. Debug any build or deployment issues

## Analytics & Monitoring

### Web Analytics (Built-in)

1. Go to your Cloudflare Pages project
2. Click **Analytics** tab
3. View metrics:
   - Page views
   - Unique visitors
   - Top pages
   - Geographic distribution
   - Bandwidth usage

### Enable Advanced Analytics (Optional)

For more detailed insights, upgrade to Cloudflare Pages Pro plan:
- Real-time analytics
- Detailed visitor data
- Custom event tracking
- Performance metrics

## Configuration Settings

### Branch Preview Settings

1. Go to **Settings** → **Builds & deployments**
2. Under **Preview deployments**, configure:
   - **All branches**: Every branch gets a preview
   - **None**: Only production deployments
   - **Custom**: Specify branch patterns

### Environment Variables

If you need to add API keys or environment variables:
1. Go to **Settings** → **Environment variables**
2. Add variables for:
   - Production deployments
   - Preview deployments
3. Variables are encrypted and secure

### Build Configuration

Current settings (no build process needed):
- **Build command**: (empty)
- **Build output directory**: `/`
- **Root directory**: (empty)

## Troubleshooting

### Domain Not Loading

- Check DNS propagation: https://dnschecker.org
- Verify domain status in Custom domains tab
- Wait 5-30 minutes after DNS changes

### Deployment Failed

- Check build logs in Deployments tab
- Verify GitHub connection is active
- Check Cloudflare status page

### Preview URL Not Working

- Ensure branch is pushed to GitHub
- Check preview deployment settings
- Verify build completed successfully

## GitHub Integration

### Permissions Required

Cloudflare Pages needs these GitHub permissions:
- Read access to code
- Write access to deployments (for status checks)
- Write access to pull requests (for preview comments)

### Reconnect GitHub

If connection breaks:
1. Go to **Settings** → **Git integration**
2. Click **Reconnect**
3. Reauthorize Cloudflare in GitHub

## Cost & Limits

### Free Tier (Current Plan)

- Unlimited bandwidth
- Unlimited sites
- Unlimited requests
- 500 builds per month
- Basic analytics included

### Pro Tier ($20/month - Optional)

- Everything in Free
- Advanced analytics
- Increased concurrent builds
- Priority support

## Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Community Forum](https://community.cloudflare.com/)
- [GitHub Repository](https://github.com/steelheadforever/texas-tides)

## Current Status

- **Status**: Live and operational
- **Domain**: slackwater.app
- **Hosting**: Cloudflare Pages
- **DNS**: Managed by Cloudflare
- **SSL**: Active and auto-renewing
- **Auto-deployments**: Enabled for `main` branch
- **Preview deployments**: Enabled for all branches
