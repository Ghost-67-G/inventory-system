# VPS Hosting Guide — Shared Infrastructure

> **Audience:** AI coding agent (or human dev) tasked with deploying a NEW project onto this VPS without breaking what's already running.
>
> **Read this file end-to-end before touching anything on the server.**

---

## 1. VPS overview

| Item | Value |
|---|---|
| Provider | Oracle Cloud Infrastructure (free-tier ARM64 / Ampere A1) |
| OS | Ubuntu 24.04 LTS (`noble`) |
| Arch | `arm64` (build your images for ARM!) |
| Public IP | `64.181.209.119` |
| SSH user | `ubuntu` (passwordless sudo, key-only SSH) |
| Open ports | `22` (SSH), `80` (HTTP), `443` (TCP+UDP, HTTPS + HTTP/3) |
| Container runtime | Docker CE (official repo) + Compose plugin v5.x |

### Firewall layout (important — Oracle has TWO layers)

1. **Oracle VCN Security List** — cloud-level. Ingress rules for 22/80/443 are already added. Any new public port must be added here too.
2. **Host iptables** — OS-level. Already configured to allow 80/443. Persisted via `iptables-persistent`.

If you need a new public port: add it to both layers. For internal-only services, neither is needed.

---

## 2. Shared infrastructure (already deployed)

Located at `~/infra/` on the VPS. Owned by no single project. Source-of-truth lives in [`inventory-system/infra/`](https://github.com/Ghost-67-G/inventory-system/tree/main/infra) on GitHub but **don't modify it from another project's repo** — edit `~/infra/` directly on the VPS.

### 2.1 Docker networks (external, shared)

Two externally-managed bridge networks that ALL projects attach to:

| Network | Purpose | Members |
|---|---|---|
| `shared_proxy` | Caddy ↔ public-facing app containers | `caddy`, `inventory-frontend`, `inventory-backend`, + your new container |
| `shared_db` | App backends ↔ shared MongoDB | `mongodb`, `inventory-backend`, + your new backend (if it uses Mongo) |

Create them once (already done):
```bash
docker network create shared_proxy
docker network create shared_db
```

### 2.2 MongoDB (`mongodb` container)

- Image: `mongo:7`
- Mode: **single-node replica set** (`rs0`), auth enabled, keyfile-secured
- Host bind: `127.0.0.1:27017` (loopback only — accessible from VPS shell + SSH tunnels, never the public internet)
- Internal hostname: `mongodb` (resolves on `shared_db` network)
- Root credentials: in `~/infra/.env` (`MONGO_ROOT_USERNAME` / `MONGO_ROOT_PASSWORD`)
- Data volume: `infra_mongo_data` (Docker named volume)
- Config volume: `infra_mongo_config` (contains the replica-set keyfile)

**Connection patterns:**

| Caller | Connection string |
|---|---|
| Internal (other docker container on `shared_db`) | `mongodb://<user>:<pass>@mongodb:27017/<db>?authSource=<db>&replicaSet=rs0` |
| Local dev via SSH tunnel | `mongodb://<user>:<pass>@localhost:27017/<db>?authSource=<db>&directConnection=true` |

> `directConnection=true` is **required** when tunneling — without it the driver follows the replica set's advertised host (`mongodb:27017`) which won't resolve on your laptop.

### 2.3 Caddy (`caddy` container)

- Image: `caddy:2-alpine`
- Ports: `80:80`, `443:443/tcp`, `443:443/udp` (HTTP/3)
- Config: `~/infra/Caddyfile` (host-mounted, read-only inside container)
- TLS: automatic via Let's Encrypt (HTTP-01 challenge). Cert state in `infra_caddy_data` volume.
- ACME email: `admin@codingstack.site` (change in Caddyfile global `{ }` block if needed)

**To reload after editing the Caddyfile** (zero downtime):
```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### 2.4 What is NOT shared

Run these per-project. Each project should isolate them on its own private compose network.

- Redis
- Meilisearch / Elasticsearch / etc.
- PostgreSQL (if a project needs Postgres, deploy its own — Mongo is the only shared DB)
- App-specific queues, caches, workers

---

## 3. Existing projects on this VPS

### 3.1 inventory-system

| Item | Value |
|---|---|
| Repo | https://github.com/Ghost-67-G/inventory-system |
| Path on VPS | `~/repos/inventory-system/` |
| Compose file | `docker-compose.vps.yml` |
| Env file | `.env.production` (NOT committed — secrets) |
| Domains | `stock.codingstack.site` (frontend), `apistock.codingstack.site` (backend API + Socket.IO) |
| Container names | `inventory-frontend`, `inventory-backend` |
| Project-local services | `redis`, `meilisearch` (on private network `inventory_net`) |
| Mongo DB used | `inventory` (app user: `inventory_app`) |

### 3.2 Caddyfile entries currently active

```
stock.codingstack.site {
    reverse_proxy inventory-frontend:80
}

apistock.codingstack.site {
    request_body { max_size 10MB }
    reverse_proxy inventory-backend:3000
}
```

---

## 4. Deploying a NEW project — the checklist

Follow in order. **Do not skip steps.** Each project must be additive — never modify the inventory stack or shared infra config in ways that break it.

### 4.1 Pick unique names and domains

- **Container names** must be globally unique on this host. Prefix with the project name: `myapp-frontend`, `myapp-backend`, `myapp-worker`.
- **Domains** must point to `64.181.209.119` via A records before deploying (Caddy needs them resolvable to issue certs).
- **Mongo DB name** must be unique. Convention: same as project slug, e.g. `myapp`.

### 4.2 Set up DNS

At the registrar (codingstack.site or wherever), add:
```
<sub>.<domain>     A   64.181.209.119
api<sub>.<domain>  A   64.181.209.119
```
Verify globally:
```bash
dig @8.8.8.8 +short <sub>.<domain>   # must return 64.181.209.119
```

### 4.3 Seed a Mongo user for the project

The shared Mongo's `mongo-init.js` only ran once (for the inventory project). New projects must seed their own DB user manually:

```bash
set -a; source ~/infra/.env; set +a

docker exec -i mongodb mongosh \
  -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin <<EOF
use myapp
db.createUser({
  user: "myapp_app",
  pwd: "STRONG_RANDOM_PASSWORD_HERE",
  roles: [
    { role: "readWrite", db: "myapp" },
    { role: "dbAdmin", db: "myapp" }
  ]
})
EOF
```

Save the password — you'll need it in the project's `.env`.

### 4.4 Write the project's `docker-compose.<env>.yml`

Critical rules:

1. **Give each public-facing container an explicit `container_name`** (Caddy uses it as the upstream hostname).
2. **Attach to shared networks AS EXTERNAL**:
   ```yaml
   services:
     backend:
       container_name: myapp-backend
       networks:
         - shared_db        # only if it uses Mongo
         - shared_proxy     # only if exposed via Caddy
         - myapp_internal   # for private services like redis
     frontend:
       container_name: myapp-frontend
       networks:
         - shared_proxy
         - myapp_internal
     redis:
       networks:
         - myapp_internal
   networks:
     shared_db:
       external: true
     shared_proxy:
       external: true
     myapp_internal:
       driver: bridge
   ```
3. **DO NOT publish ports 80/443 to the host** — Caddy owns those. Use `expose:` so other containers on `shared_proxy` can reach you, but the host doesn't bind.
4. **DO NOT name your container `mongodb`, `caddy`, `redis`, or anything that clashes** with existing names. Always prefix.
5. **DO NOT add a project-level reverse proxy** (nginx, traefik, etc.) — Caddy is the only ingress.

### 4.5 Mongo connection string (in the project's `.env`)

```
MONGODB_URL=mongodb://myapp_app:<password from step 4.3>@mongodb:27017/myapp?authSource=myapp&replicaSet=rs0&directConnection=true
```

> The replica set name is always `rs0`. The DB name and `authSource` must match what you seeded in step 4.3.

### 4.6 Add the project to the Caddyfile

```bash
nano ~/infra/Caddyfile
```

Append a new block (don't touch existing blocks):

```
myapp.example.com {
    reverse_proxy myapp-frontend:80
}

api.myapp.example.com {
    request_body { max_size 10MB }
    reverse_proxy myapp-backend:3000
}
```

Reload:
```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
# Watch logs for cert issuance:
docker logs caddy --tail 30
```

### 4.7 Build & start the new stack

```bash
cd ~/repos/myapp
docker compose -f docker-compose.vps.yml --env-file .env.production build
docker compose -f docker-compose.vps.yml --env-file .env.production up -d
docker compose -f docker-compose.vps.yml --env-file .env.production ps
```

### 4.8 Verify nothing else broke

```bash
# All shared infra still healthy
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E 'caddy|mongodb'

# Existing project still works
curl -I https://stock.codingstack.site             # expect 200
curl https://apistock.codingstack.site/health      # expect 200

# New project works
curl -I https://myapp.example.com               # expect 200 with valid TLS
```

---

## 5. Common operations

### Pull a new release of a deployed project

```bash
cd ~/repos/<project>
git pull
docker compose -f docker-compose.vps.yml --env-file .env.production build
docker compose -f docker-compose.vps.yml --env-file .env.production up -d
```

### Add a Mongo user for another project (after step 4.3 reference)

See section 4.3.

### Reload Caddy

```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### List which containers are on each shared network

```bash
docker network inspect shared_proxy --format '{{range .Containers}}{{.Name}} {{end}}'
docker network inspect shared_db    --format '{{range .Containers}}{{.Name}} {{end}}'
```

### Open Mongo shell as root

```bash
set -a; source ~/infra/.env; set +a
docker exec -it mongodb mongosh -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin
```

### SSH tunnel for local Compass / seeders

On your laptop:
```bash
ssh -L 27017:127.0.0.1:27017 ubuntu@64.181.209.119
```
Then connect Compass to:
```
mongodb://admin:<MONGO_ROOT_PASSWORD>@localhost:27017/?authSource=admin&directConnection=true
```

---

## 6. Hard rules — DO NOT VIOLATE

| Don't | Why |
|---|---|
| Modify `~/infra/Caddyfile` to remove or change inventory blocks | Breaks the existing site |
| Run another reverse proxy bound to :80 or :443 | Port conflict with Caddy → ingress goes down for everything |
| Spin up another Mongo container with the same name `mongodb` | Container name clash, the existing one stops working |
| Expose 27017 on `0.0.0.0` | Mongo on the open internet = compromised within hours |
| Use `docker compose down` from `~/infra/` without understanding | Takes down Caddy and Mongo for ALL projects |
| Add a project's containers to `shared_db` if it doesn't need Mongo | Unnecessary attack surface |
| Hard-code passwords in compose files | Always read from `.env` files (which are gitignored) |
| Rebuild the inventory stack from another project's directory | Use the inventory repo only |

---

## 7. Gotchas learned the hard way

1. **`.env` values are literal strings.** Composer does NOT recursively expand `${REDIS_PASSWORD}` inside `REDIS_URL`. If you write `REDIS_URL=redis://:REDIS_PASSWORD@redis:6379` with the literal placeholder, the app sends "REDIS_PASSWORD" as the password. Inline the actual password in every URL.

2. **Caddy backs off on cert failures.** If the first attempt fails (DNS not propagated, wrong IP), Caddy waits before retrying. `docker compose restart caddy` forces an immediate retry. If you hit the LE rate limit (5 failures/hour per domain), wait an hour or use the staging endpoint.

3. **ARM64 architecture.** This VPS is ARM. Multi-arch images (`mongo`, `caddy`, `redis`, `node`) work fine. Custom images must be built for `linux/arm64` (use Docker buildx or build directly on the VPS).

4. **Mongo replica set + auth requires a keyfile.** Already configured. If you ever rebuild Mongo from scratch, regenerate the keyfile and `rs.initiate()` — see [`infra/README.md`](./README.md).

5. **Oracle Cloud has two firewalls.** VCN Security List + host iptables. Opening a port in only one of them silently drops traffic.

6. **The `ubuntu` user has passwordless sudo.** No password prompts needed for `sudo` commands.

---

## 8. Quick reference — file locations

```
~/infra/
├── docker-compose.yml      # Mongo + Caddy
├── .env                    # MONGO_ROOT_PASSWORD etc. (NEVER commit)
├── Caddyfile               # All ingress routes for all projects
└── mongo-init.js           # Ran ONCE on first boot — only seeded inventory user

~/repos/inventory-system/
├── docker-compose.vps.yml  # backend/frontend/redis/meilisearch
├── .env.production         # secrets (NEVER commit)
└── ...

~/repos/<your-new-project>/   # ← create here
```

---

## 9. If you break something

```bash
# Check what's down
docker ps -a --format "table {{.Names}}\t{{.Status}}"

# Restart Caddy (safe — no data loss)
docker compose -f ~/infra/docker-compose.yml restart caddy

# Restart Mongo (safe — data persists in volume)
docker compose -f ~/infra/docker-compose.yml restart mongodb

# Check Caddy / Mongo / backend logs
docker logs caddy --tail 100
docker logs mongodb --tail 100
docker logs <your-backend> --tail 100

# Inspect networks
docker network inspect shared_proxy
docker network inspect shared_db
```

**Never** `docker compose down -v` anywhere unless you intend to wipe data. The `-v` flag deletes named volumes (Mongo data, Caddy certs).
