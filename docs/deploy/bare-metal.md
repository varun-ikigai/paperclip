---
title: Bare Metal / VPS
summary: Deploy Paperclip on a Linux server with systemd
---

Deploy Paperclip directly on a Linux VPS or bare-metal server using systemd, Caddy, and Docker Compose (for PostgreSQL).

## Prerequisites

- Ubuntu 22.04+ or Debian 12+ (other systemd-based distros work too)
- Node.js 20+ and pnpm
- Docker and Docker Compose (for the PostgreSQL container)
- Caddy 2+ (for TLS and reverse proxy)
- A domain name with DNS pointing to the server

## 1. Clone and Build

```sh
git clone <your-fork-url> /root/apps/paperclip
cd /root/apps/paperclip
pnpm install
pnpm build
```

## 2. Configure Environment

Copy the example env file and fill in values:

```sh
cp deploy/.env.example /root/apps/paperclip/.env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session secret. Generate with: `openssl rand -hex 32` |
| `PAPERCLIP_DEPLOYMENT_MODE` | `local_trusted` or `authenticated` |
| `PAPERCLIP_DEPLOYMENT_EXPOSURE` | `private` or `public` (when authenticated) |
| `PAPERCLIP_ALLOWED_HOSTNAMES` | Your domain(s), comma-separated |

See [Environment Variables](./environment-variables.md) for the full reference.

## 3. Start PostgreSQL

```sh
docker compose -f docker-compose.prod.yml up -d
```

Verify it is healthy:

```sh
docker ps  # Should show paperclip-db-1 as "healthy"
```

## 4. Run Onboarding

```sh
pnpm paperclipai onboard
```

This creates the initial database schema, admin user, and instance configuration.

## 5. Install the systemd Service

```sh
cp deploy/paperclip.service /etc/systemd/system/paperclip.service
systemctl daemon-reload
systemctl enable paperclip
systemctl start paperclip
```

Verify:

```sh
systemctl status paperclip
journalctl -u paperclip -f
```

### Service Restart Policy

The service template uses `Restart=always` so Paperclip automatically recovers from any exit, including signals like SIGHUP from network changes, VPN reconnects, or terminal hangups. This is deliberate: `Restart=on-failure` would NOT restart the process after a SIGHUP since systemd treats it as a clean exit.

If you need to stop Paperclip intentionally, use `systemctl stop paperclip`.

## 6. Configure Caddy (Reverse Proxy and TLS)

Copy and edit the example Caddyfile:

```sh
cp deploy/Caddyfile.example /etc/caddy/Caddyfile
```

Replace `your-domain.example.com` with your actual domain:

```
your-domain.example.com {
    reverse_proxy localhost:3100
}
```

Reload Caddy:

```sh
systemctl reload caddy
```

Caddy automatically provisions a TLS certificate via Let's Encrypt.

## 7. Verify

```sh
curl -s https://your-domain.example.com/api/health
```

## Updating

```sh
cd /root/apps/paperclip
git pull
pnpm install
pnpm build
systemctl restart paperclip
```

## Troubleshooting

### Service will not start

```sh
journalctl -u paperclip --since "5 minutes ago" --no-pager
```

Common causes:
- Missing `.env` file or variables
- PostgreSQL not running (check `docker ps`)
- Port 3100 already in use

### Service stops unexpectedly

Check the exit reason:

```sh
systemctl show paperclip --property=Result,ExecMainStatus,ActiveState
journalctl -u paperclip --since "1 hour ago" --no-pager | tail -50
```

The `Restart=always` policy means systemd will restart the service within 5 seconds. If it keeps crash-looping, check `journalctl` for the underlying error.

### Database connection issues

Verify PostgreSQL is running and healthy:

```sh
docker ps | grep paperclip-db
docker logs paperclip-db-1 --tail 20
```
