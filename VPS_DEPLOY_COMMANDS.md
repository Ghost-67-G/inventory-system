# VPS Deployment — Inventory System

Fresh-VPS runbook. Assumes Ubuntu/Debian with root or sudo access.

Architecture:
- **Shared infra** (`~/infra/`) runs MongoDB + Caddy. Owned by no single project.
- **Inventory project** (`~/inventory/inventory-system/`) joins the shared networks.
- Two external docker networks tie everything together: `shared_db`, `shared_proxy`.

---

## 1. Install Docker on the VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out + back in for group change
```

## 2. Create the shared docker networks (idempotent)

```bash
docker network create shared_proxy
docker network create shared_db
```

## 3. Bring up shared infra (Mongo + Caddy)

```bash
# Copy infra/ from this repo to its own dir on the VPS
mkdir -p ~/infra
cp -r /path/to/repo/infra/. ~/infra/
cd ~/infra

cp .env.example .env
$EDITOR .env   # set MONGO_ROOT_PASSWORD and MONGO_APP_PASSWORD

docker compose up -d
docker compose ps      # mongodb + caddy should both be healthy
```

Verify Mongo:
```bash
docker exec mongodb mongosh \
  -u "$(grep MONGO_ROOT_USERNAME .env | cut -d= -f2)" \
  -p "$(grep MONGO_ROOT_PASSWORD .env | cut -d= -f2)" \
  --authenticationDatabase admin --eval 'db.adminCommand("ping")'
```

## 4. Point DNS at the VPS

Add A records (or AAAA for IPv6) at your registrar:

```
stock.devsdesk.site     A  <VPS_IP>
apistock.devsdesk.site  A  <VPS_IP>
```

Verify:
```bash
dig +short stock.devsdesk.site
dig +short apistock.devsdesk.site
```

Caddy will only issue Let's Encrypt certs once DNS resolves to this host.

## 5. Clone and configure the inventory project

```bash
git clone <repo-url> ~/inventory/inventory-system
cd ~/inventory/inventory-system

cp .env.production.example .env.production
$EDITOR .env.production
# Set:
#   MONGO_APP_PASSWORD  — must match the value in ~/infra/.env
#   REDIS_PASSWORD
#   MEILISEARCH_KEY
#   JWT_ACCESS_SECRET / JWT_REFRESH_SECRET   (use: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
#   RESEND_API_KEY
```

## 6. Build and start the inventory stack

```bash
docker compose -f docker-compose.vps.yml --env-file .env.production build
docker compose -f docker-compose.vps.yml --env-file .env.production up -d
docker compose -f docker-compose.vps.yml ps
```

Expected services healthy: `inventory-backend`, `inventory-frontend`, `redis`, `meilisearch`.

## 7. Smoke test

```bash
# DNS + Caddy + frontend
curl -o /dev/null -w "%{http_code}\n" https://stock.devsdesk.site
# Expected: 200

# Backend health
curl https://apistock.devsdesk.site/health
# Expected: {"status":"ok"} or similar 200 response

# Cross-network proves shared_db works
docker exec inventory-backend node -e "require('net').connect(27017,'mongodb').on('connect',()=>{console.log('ok');process.exit(0)}).on('error',e=>{console.error(e.message);process.exit(1)})"
```

Open `https://stock.devsdesk.site` in a browser, log in, and exercise a websocket-heavy action to confirm `/socket.io/*` works through Caddy.

---

## Common operations

### Pull a new release
```bash
cd ~/inventory/inventory-system
git pull
docker compose -f docker-compose.vps.yml --env-file .env.production build
docker compose -f docker-compose.vps.yml --env-file .env.production up -d
```

### Reload Caddy after editing the Caddyfile
```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### Add a new project to shared infra
1. Attach its compose to `shared_db` (if it needs Mongo) and/or `shared_proxy` (if web-facing) — both `external: true`.
2. Seed a Mongo user for it via `docker exec -it mongodb mongosh ...` (see `infra/README.md`).
3. Append a block in `~/infra/Caddyfile` pointing at the new container name.
4. `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`.

---

## Troubleshooting

### Backend can't reach mongodb
```bash
docker exec inventory-backend ping -c1 mongodb
docker network inspect shared_db --format '{{range .Containers}}{{.Name}} {{end}}'
# Should list both mongodb and inventory-backend
```

### Caddy 502 on a domain
```bash
docker exec caddy ping -c1 inventory-frontend
docker network inspect shared_proxy --format '{{range .Containers}}{{.Name}} {{end}}'
docker logs caddy --tail 50
```

### TLS cert not issued
```bash
docker logs caddy --tail 100 | grep -i 'acme\|certificate'
# Usually DNS hasn't propagated yet, or port 80 is blocked by a firewall.
```

### Backend restart loop
```bash
docker logs inventory-backend --tail 100
# Common: wrong MONGO_APP_PASSWORD vs what infra/mongo-init.js seeded.
# If you need to re-seed, drop the mongo_data volume in ~/infra and `docker compose up -d` again — DESTRUCTIVE.
```
