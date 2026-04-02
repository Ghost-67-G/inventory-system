# Inventory Management SaaS

Multi-tenant inventory management platform with two deployment modes:

- `saas`: Single hosted deployment serving many tenants.
- `self_hosted`: One installation per customer environment.

## Tech Stack

- Backend: Node.js, Express, TypeScript, Mongoose, BullMQ, Socket.io, Redis
- Frontend: React 19, Vite, TypeScript, Tailwind CSS
- Data services: MongoDB, Redis, MeiliSearch

## Quick Start (Development)

1. Start dependency services:

```bash
docker compose -f docker-compose.dev.yml up -d
```

2. Configure local env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Install and run backend:

```bash
cd backend
npm install
npm run dev
```

4. Install and run frontend (new terminal):

```bash
cd frontend
npm install
npm run dev
```

5. Seed demo data:

```bash
cd backend
npm run seed
```

6. Open `http://localhost:5173`.

## Production Deployment (SaaS)

### Prerequisites

- Ubuntu 22.04+ server
- Docker and Docker Compose plugin installed
- Domain DNS pointing to the server
- Existing VPS reverse proxy or web server (Nginx, Caddy, Traefik, Apache) already serving your other projects

### Shared VPS Defaults

The production stack is configured for a shared VPS by default:

- It binds only to `127.0.0.1:18080` on the VPS.
- It does not try to claim public `80/443`, so it will not disturb other hosted projects.
- Your existing VPS reverse proxy should route your inventory domain to `127.0.0.1:18080`.

### Steps

1. Clone repository on server:

```bash
git clone https://github.com/YOUR_ORG/inventory-saas.git /opt/inventory
cd /opt/inventory
```

2. Configure production env:

```bash
cp .env.production.example .env.production
nano .env.production
```

Generate strong JWT secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Use different values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

3. Modify these values in `.env.production`:

- `GHCR_NAMESPACE`: your lowercase GitHub org or username used in `ghcr.io`
- `FRONTEND_URL`: your full public app URL, for example `https://inventory.example.com`
- `SOCKET_CORS_ORIGIN`: same public URL as above
- `MONGODB_URL`: keep the password aligned with `MONGO_APP_PASSWORD`
- `NGINX_BIND_IP`: keep `127.0.0.1` on a shared VPS
- `NGINX_HTTP_PORT`: choose an unused local port, for example `18080`
- `NGINX_CONFIG`: keep `nginx.vps.conf` on a shared VPS

4. Modify this file before deploy:

- `nginx/nginx.conf`: replace `your-domain.com` if you ever switch to direct public TLS on a dedicated VPS

For the shared VPS setup, `nginx/nginx.vps.conf` is used by default, so you do not need to mount app TLS certs inside this project.

5. Add a route in your existing VPS reverse proxy.

Example host-level Nginx site:

```nginx
map $http_upgrade $connection_upgrade {
	default upgrade;
	'' close;
}

server {
	listen 80;
	server_name inventory.example.com;
	return 301 https://$host$request_uri;
}

server {
	listen 443 ssl http2;
	server_name inventory.example.com;

	ssl_certificate /etc/letsencrypt/live/inventory.example.com/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/inventory.example.com/privkey.pem;

	location / {
		proxy_pass http://127.0.0.1:18080;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection $connection_upgrade;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto https;
	}
}
```

6. Deploy:

```bash
docker compose --env-file .env.production up -d --build
```

7. Verify health:

```bash
./scripts/health-check.sh
curl http://127.0.0.1:18080/health
```

8. Optional seed:

```bash
docker compose --env-file .env.production exec backend node dist/scripts/seed.js
```

### Dedicated VPS Alternative

If this app will later run alone on its own VPS and can own public ports, change these settings:

- Set `NGINX_BIND_IP=0.0.0.0`
- Set `NGINX_HTTP_PORT=80`
- Change the compose Nginx mount to use `nginx/nginx.conf`
- Mount valid certs into `nginx/ssl`

## Self-Hosted Deployment

For customer-managed environments:

1. Prepare package and configure env:

```bash
cp .env.selfhosted.example .env
nano .env
```

2. Start stack:

```bash
docker compose -f docker-compose.selfhosted.yml up -d
```

3. Optional search service:

```bash
docker compose -f docker-compose.selfhosted.yml --profile search up -d
```

4. Open `http://localhost` (or server IP / configured host port).

## Environment Variables

See:

- `.env.example` for shared/local reference
- `.env.production.example` for SaaS production
- `.env.selfhosted.example` for customer installs

## Operations

### Deploy update

```bash
./scripts/deploy.sh
./scripts/deploy.sh 1.2.0
```

### Health check

```bash
./scripts/health-check.sh
```

### Backup

```bash
./scripts/backup.sh
./scripts/backup.sh pre-release
```

### Restore

```bash
docker compose --env-file .env.production exec -T mongodb mongorestore \
	--uri="mongodb://admin:PASSWORD@localhost:27017/?authSource=admin" \
	--archive --gzip < ./backups/inventory_TIMESTAMP_manual.gz
```

### Rollback

```bash
./scripts/rollback.sh
```

## GitHub Actions Secrets

Configure these in repository settings:

- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_SSH_KEY`
- `PRODUCTION_DOMAIN`

## Security Notes

- Shared VPS mode binds the app to localhost only by default, so other VPS projects keep control of public `80/443`.
- MongoDB, Redis, and MeiliSearch are internal-only (`expose`, not `ports`).
- TLS certs are mounted from `nginx/ssl` and never baked into images.
- `MONGO_APP_USERNAME` / `MONGO_APP_PASSWORD` are used for least-privilege DB access.
