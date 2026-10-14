# LeadFlow CRM

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-kftyouf4)

An all-in-one sales and lead management CRM built for Indian sales teams. Manage leads across WhatsApp, Email, and phone with automated follow-ups, broadcasts, analytics, and team collaboration.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Deploy to Hostinger VPS](#deploy-to-hostinger-vps)
- [VPS Plan Recommendations](#vps-plan-recommendations)
- [SSL / HTTPS Setup](#ssl--https-setup)
- [Auto-Deploy Setup](#auto-deploy-setup)
- [Environment Variables](#environment-variables)
- [Database & Migrations](#database--migrations)
- [Edge Functions](#edge-functions)
- [Architecture Assessment](#architecture-assessment)
- [Troubleshooting](#troubleshooting)

---

## Overview

LeadFlow CRM helps sales teams:
- Capture leads from website forms, Google Sheets, and manual entry
- Manage a visual sales pipeline with drag-and-drop stages
- Send bulk WhatsApp and Email broadcasts
- Automate follow-up reminders and drip campaigns
- Track team performance with analytics and leaderboards
- Manage multi-workspace accounts with role-based permissions

## Features

| Category | Features |
|----------|----------|
| **Lead Management** | Visual pipeline, lead scoring, custom fields, duplicate detection, activity timeline, CSV/Sheets import |
| **Communication** | WhatsApp broadcast & chat, Email broadcast & inbox, Telegram broadcast, virtual calling (Twilio) |
| **Automation** | Follow-up scheduler, automation builder, drip campaigns, welcome emails, auto-assignment |
| **Analytics** | Dashboard overview, revenue forecast, win/loss analysis, agent leaderboard, goal tracking, follow-up heatmap |
| **Team** | Team chat, role-based permissions, lead distribution, presence tracking |
| **Marketing** | Meta (Facebook) Ads integration, Conversion API, campaign optimizer, popup form builder, short links |
| **Admin** | Super admin dashboard, account management, plan management, feature toggles, legal pages, usage monitoring |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| **Database** | PostgreSQL with Row Level Security (RLS) |
| **Integrations** | WhatsApp Business API, Meta Marketing API, Twilio, Google Sheets, Telegram Bot API, SMTP |
| **Deployment** | Nginx (static hosting), Let's Encrypt (SSL) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│              (React SPA - Vite build)                    │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────┐    ┌──────────────────────────┐
│   Hostinger VPS      │    │     Supabase Cloud        │
│   (Nginx)            │    │                           │
│                      │    │  ┌────────────────────┐   │
│  Serves static       │    │  │  PostgreSQL DB     │   │
│  HTML/JS/CSS files   │    │  │  (with RLS)        │   │
│  from dist/ folder   │    │  └────────────────────┘   │
│                      │    │  ┌────────────────────┐   │
│  SSL via Let's       │    │  │  Auth (JWT)        │   │
│  Encrypt             │    │  └────────────────────┘   │
│                      │    │  ┌────────────────────┐   │
│  Gzip compression    │    │  │  Edge Functions    │   │
│  Static asset cache  │    │  │  (Deno runtime)    │   │
│                      │    │  └────────────────────┘   │
│                      │    │  ┌────────────────────┐   │
│                      │    │  │  Realtime (WS)     │   │
│                      │    │  └────────────────────┘   │
└──────────────────────┘    └──────────────────────────┘
```

**How it works:** The VPS only serves static files (HTML, JS, CSS, images). All data operations go directly from the browser to Supabase's cloud API. This keeps the VPS lightweight and cheap while the database scales automatically.

## Prerequisites

- **Node.js** 20+ and npm
- **A Supabase project** (already provisioned - credentials in `.env`)
- **A Hostinger VPS** with Ubuntu 22.04 or 24.04 LTS
- **A domain name** pointed to your VPS IP (for SSL)
- **Git** installed locally and on the VPS

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview the production build
npm run preview
```

The dev server starts at `http://localhost:5173`.

## Deploy to Hostinger VPS

### Step 1: Choose Your VPS Plan

| Plan | RAM | CPU | Storage | Price | Best For |
|------|-----|-----|---------|-------|----------|
| KVM 1 | 4 GB | 1 vCPU | 50 GB NVMe | ~$4.99/mo | Up to 500 users |
| **KVM 2** | **8 GB** | **2 vCPU** | **100 GB NVMe** | **~$7.99/mo** | **Up to 5,000 users (recommended)** |
| KVM 4 | 16 GB | 4 vCPU | 200 GB NVMe | ~$15.99/mo | 10,000+ users |

Choose **Ubuntu 22.04 or 24.04 LTS** as the OS.

> Since the VPS only serves static files, even KVM 1 is sufficient for most deployments. Upgrade if you add server-side processing later.

### Step 2: Connect via SSH

```bash
ssh root@YOUR_VPS_IP
```

Update the system:

```bash
apt update && apt upgrade -y
```

### Step 3: Install Node.js and Git

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git
```

Verify:

```bash
node -v    # v20.x.x
npm -v     # 10.x.x
```

### Step 4: Clone the Repository

```bash
mkdir -p /var/www/leadflow
cd /var/www/leadflow
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
```

For private repos, use a Personal Access Token:

```bash
git clone https://YOUR_USERNAME:YOUR_TOKEN@github.com/YOUR_USERNAME/YOUR_REPO.git .
```

### Step 5: Install Dependencies and Build

```bash
cd /var/www/leadflow
npm install
npm run build
```

This creates a `dist/` folder with optimized static files.

### Step 6: Install and Configure Nginx

```bash
apt install -y nginx
```

Create the site configuration:

```bash
cat > /etc/nginx/sites-available/leadflow << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/leadflow/dist;
    index index.html;

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1000;
}
EOF
```

Enable the site:

```bash
ln -sf /etc/nginx/sites-available/leadflow /etc/nginx/sites-enabled/leadflow
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx
```

Visit `http://YOUR_VPS_IP` to verify the CRM loads.

## VPS Plan Recommendations

- **Starting out / testing:** KVM 1 (4 GB RAM) is enough. The VPS only serves static files.
- **Growing business:** KVM 2 (8 GB RAM) gives headroom for logs, monitoring, and future server-side features.
- **High scale:** KVM 4 (16 GB RAM) if you plan to add server-side rendering, a reverse proxy cache, or other services.

All plans work because the database load is on Supabase, not your VPS.

## SSL / HTTPS Setup

### Point Your Domain

In your DNS provider (Hostinger DNS or elsewhere), add:

| Type | Name | Value |
|------|------|-------|
| A | @ | YOUR_VPS_IP |
| A | www | YOUR_VPS_IP |

Wait 5-30 minutes for DNS propagation.

### Install Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Choose option 2 to redirect all HTTP to HTTPS. Certbot auto-renews certificates.

## Auto-Deploy Setup

### Manual Deploy Script

Create a deploy script on the VPS:

```bash
cat > /var/www/leadflow/deploy.sh << 'EOF'
#!/bin/bash
cd /var/www/leadflow
git pull origin main
npm install
npm run build
echo "Deploy complete: $(date)"
EOF
chmod +x /var/www/leadflow/deploy.sh
```

Run it to update:

```bash
/var/www/leadflow/deploy.sh
```

### GitHub Actions (Optional)

Add this to `.github/workflows/deploy.yml` for automatic deploys on push:

```yaml
name: Deploy to VPS
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.VPS_HOST }}
          username: root
          key: ${{ secrets.VPS_SSH_KEY }}
          source: "dist/*"
          target: "/var/www/leadflow/dist"
          strip_components: 1
```

Add `VPS_HOST` (your VPS IP) and `VPS_SSH_KEY` (private SSH key) as GitHub repo secrets.

## Environment Variables

The `.env` file contains:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

> **Never commit `.env` to GitHub.** It's in `.gitignore`. If setting up on a new VPS, copy the `.env` file manually after cloning.

## Database & Migrations

The CRM uses Supabase PostgreSQL. All database changes are tracked as SQL migration files in `supabase/migrations/`. These are applied automatically through the Supabase MCP tooling.

Key tables:
- `submissions` - Lead data
- `team_members` - Team member accounts and roles
- `whatsapp_conversations` / `whatsapp_messages` - WhatsApp chat
- `email_logs` / `scheduled_emails` - Email tracking
- `lead_followups` - Follow-up reminders
- `automation_rules` / `automation_queue` - Automation engine
- `popup_forms` - Lead capture forms
- `super_admin_*` - Platform admin tables
- `workspaces` - Multi-tenant workspace isolation

All tables use Row Level Security (RLS) to ensure users can only access their own workspace data.

## Edge Functions

Serverless functions deployed on Supabase's Deno runtime:

| Function | Purpose |
|----------|---------|
| `send-whatsapp-message` | Send WhatsApp messages via Business API |
| `whatsapp-broadcast` | Bulk WhatsApp messaging |
| `whatsapp-webhook` | Receive WhatsApp incoming messages |
| `send-email` | Send transactional emails |
| `email-broadcast` | Bulk email sending |
| `email-inbox` | Receive and parse emails |
| `process-followups` | Cron: send scheduled follow-up reminders |
| `process-automations` | Cron: execute automation rules |
| `process-scheduled-emails` | Cron: send scheduled emails |
| `meta-conversion-api` | Meta (Facebook) Conversion API |
| `meta-marketing-sync` | Sync Meta Ads data |
| `twilio-call` | Virtual calling via Twilio |
| `telegram-webhook` / `telegram-broadcast` | Telegram bot integration |
| `google-sheets-sync` | Sync leads with Google Sheets |
| `impersonate` | Super admin impersonation |
| `short-link` | Short URL redirect service |

## Architecture Assessment

### Pros

- **Low cost:** VPS only serves static files, so even a $5/month plan works. Supabase free tier covers early usage.
- **Scalable backend:** Supabase auto-scales PostgreSQL, auth, and edge functions. No DBA needed.
- **Security:** Row Level Security ensures data isolation. SSL via Let's Encrypt. JWT auth.
- **Fast deploys:** Rebuild and copy files - updates in seconds.
- **Low maintenance:** No server-side runtime to manage. Nginx just serves files.
- **Auto-backups:** Supabase handles database backups automatically.

### Things to Watch

- **Supabase limits:** Free tier has database size, API request, and concurrent connection limits. Upgrade to Pro ($25/mo) as you grow.
- **Bundle size:** The JS bundle is large (~1.5 MB). Consider code splitting for faster initial load.
- **No SSR:** Being a SPA, SEO is limited. Fine for a CRM (behind auth), but consider SSR if you need the landing page indexed well.
- **Vendor lock-in:** Database layer depends on Supabase. Migrating to self-hosted Postgres is possible but requires effort.
- **Single VPS:** If the VPS goes down, the app is down. Consider a monitoring service (UptimeRobot is free).

### Verdict

This is a **solid, cost-effective architecture** for a SaaS CRM. The split between a static frontend (cheap VPS) and a managed backend (Supabase) is the same pattern used by thousands of production SaaS applications. It keeps costs low while the database scales automatically. For a sales CRM targeting Indian SMBs, this is a great choice.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank page on load | Check that `dist/` folder exists and Nginx root points to it |
| "Supabase URL not set" | Ensure `.env` file exists with correct variables |
| 502 Bad Gateway | Nginx is running but can't find files. Check `root` path in config |
| SSL not working | DNS may not have propagated. Wait 30 min and retry certbot |
| Can't connect via SSH | Check Hostinger VPS firewall settings, ensure port 22 is open |
| Build fails on VPS | Ensure Node.js 20+ is installed. Run `node -v` to check |
| Database connection errors | Check Supabase project is not paused. Free tier pauses after inactivity |
| WhatsApp/Email not sending | Edge functions may need redeploying. Check Supabase function logs |

---

## License

Proprietary. All rights reserved.

## Support

For issues, contact the development team or check the in-app VPS Setup Guide in the Super Admin Dashboard.
