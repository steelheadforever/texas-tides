# DNS Setup Guide for slackwater.app

This guide will help you configure your Namecheap domain to work with GitHub Pages.

## Step 1: Configure GitHub Pages

1. Go to your GitHub repository settings: `https://github.com/steelheadforever/texas-tides/settings/pages`
2. Under "Build and deployment":
   - Source: Deploy from a branch
   - Branch: Select your main branch (likely `main` or `master`) and `/root` folder
   - Click "Save"
3. The CNAME file in this repository will automatically configure the custom domain as `slackwater.app`
4. GitHub will provide a checkbox to "Enforce HTTPS" - enable this after DNS is configured and working

## Step 2: Configure DNS in Namecheap

### A. Log into Namecheap

1. Go to https://www.namecheap.com and sign in
2. Navigate to "Domain List" in your account
3. Click "Manage" next to slackwater.app

### B. Configure DNS Records

1. Go to the "Advanced DNS" tab
2. Remove any existing A records and CNAME records for @ and www
3. Add the following records:

#### Required A Records (for apex domain)

Add **FOUR** A Records with the host `@`:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | @ | 185.199.108.153 | Automatic |
| A Record | @ | 185.199.109.153 | Automatic |
| A Record | @ | 185.199.110.153 | Automatic |
| A Record | @ | 185.199.111.153 | Automatic |

#### Required CNAME Record (for www subdomain)

| Type | Host | Value | TTL |
|------|------|-------|-----|
| CNAME Record | www | steelheadforever.github.io. | Automatic |

**Note:** Make sure to include the trailing dot (.) after `github.io.`

### C. Save Changes

1. Click "Save all changes"
2. DNS propagation can take anywhere from a few minutes to 48 hours (usually 15-30 minutes)

## Step 3: Verify DNS Configuration

### Check DNS Propagation

Use these tools to verify your DNS records are propagating:
- https://dnschecker.org/#A/slackwater.app
- https://dnschecker.org/#CNAME/www.slackwater.app

### Expected Results

- `slackwater.app` should resolve to all four GitHub Pages IP addresses
- `www.slackwater.app` should resolve to `steelheadforever.github.io`

## Step 4: Enable HTTPS

1. Once DNS is fully propagated (all A records resolving correctly)
2. Go back to GitHub repository settings → Pages
3. Check the box for "Enforce HTTPS"
4. GitHub will automatically provision an SSL certificate (this can take a few minutes)

## Troubleshooting

### "Domain's DNS record could not be retrieved" in GitHub

- Wait longer for DNS propagation (can take up to 48 hours)
- Verify all four A records are configured correctly
- Check that you didn't add extra characters or spaces

### Site not loading after DNS setup

- Clear your browser cache
- Try accessing in incognito/private mode
- Wait for DNS propagation to complete globally
- Check DNS propagation status using the tools above

### HTTPS certificate issues

- Make sure DNS is fully propagated first
- Disable and re-enable "Enforce HTTPS" in GitHub Pages settings
- Wait 10-15 minutes for certificate provisioning

## Testing Your Site

Once everything is configured:

1. Visit `http://slackwater.app` - should load your site
2. Visit `https://slackwater.app` - should load with HTTPS (after SSL is enabled)
3. Visit `http://www.slackwater.app` - should redirect to your main domain
4. Visit `https://www.slackwater.app` - should redirect to your main domain with HTTPS

## GitHub Pages IP Addresses (for reference)

Current GitHub Pages IP addresses (as of 2026):
- 185.199.108.153
- 185.199.109.153
- 185.199.110.153
- 185.199.111.153

If these change, check the official documentation: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
