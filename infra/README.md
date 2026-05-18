# Shared VPS Infra — MongoDB + Caddy

This stack runs **once per VPS** and is shared by every project on the host.

- `mongodb` — single Mongo 7 instance, reachable only on the `shared_db` docker network (no host port).
- `caddy` — reverse proxy that owns ports 80/443 and auto-provisions Let's Encrypt certs.

Other projects join the `shared_db` and/or `shared_proxy` networks instead of running their own Mongo or proxy.

## One-time bootstrap (fresh VPS)

```bash
# 1. Create the two shared networks (idempotent)
docker network create shared_proxy
docker network create shared_db

# 2. Copy this directory to the VPS (e.g. ~/infra/) and fill secrets
cp .env.example .env
$EDITOR .env   # set strong MONGO_ROOT_PASSWORD / MONGO_APP_PASSWORD

# 3. Bring it up
docker compose up -d

# 4. Verify
docker compose ps                       # both healthy
docker logs caddy --tail 20
docker exec mongodb mongosh -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin --eval 'db.adminCommand("ping")'
```

## How a project joins

In the project's compose file:

```yaml
services:
  backend:
    container_name: my-app-backend     # used as Caddy upstream hostname
    networks:
      - shared_db                       # to reach mongodb:27017
      - shared_proxy                    # to be reached by Caddy
      - app_internal                    # project-private services (redis, etc.)

networks:
  shared_db:
    external: true
  shared_proxy:
    external: true
  app_internal:
    driver: bridge
```

Then add a block to `Caddyfile`:

```
my-app.example.com {
    reverse_proxy my-app-backend:3000
}
```

Reload Caddy without downtime:

```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

## Seeding a Mongo user for a new project

`mongo-init.js` only runs on **first** boot of the volume. For projects added later, seed manually:

```bash
docker exec -it mongodb mongosh -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin <<'EOF'
use myapp
db.createUser({
  user: "myapp_app",
  pwd: "STRONG_PASSWORD",
  roles: [{ role: "readWrite", db: "myapp" }, { role: "dbAdmin", db: "myapp" }]
})
EOF
```

## Backups

Not handled here. Mount/sync `mongo_data` volume on a schedule of your choice.
