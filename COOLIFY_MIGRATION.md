# Adding Coolify as the VPS edge — without destroying the existing stacks

**Goal:** Install **Coolify** on the existing Oracle VPS (`64.181.209.119`) and make
its built-in **Traefik proxy the single edge on 80/443**, replacing Caddy — while the
two existing projects (inventory + RMS) and MongoDB keep running unchanged.

**Why Coolify is less disruptive than a Dokploy-style install here:**
- Coolify's **dashboard is on port 8000**, not 80/443 — so you can install Coolify and
  stage *everything* (network wiring, routes) while Caddy still serves live traffic.
- **No Docker Swarm** — Coolify uses plain Docker + a bridge network called `coolify`.
  Your existing standalone containers are unaffected.
- The **only** downtime is the ~1-minute moment when Coolify's Traefik takes 80/443
  from Caddy. Everything else is zero-downtime and pre-staged.

> ⚠️ Two proxies can't share 80/443. The Caddy→Traefik handoff is a short blip — do it
> in a maintenance window. Rollback is at the bottom; keep Caddy's compose intact until
> verified.

---

## Live state (confirmed from the VPS, 2026-07-14)

Two projects, four domains, all on the `shared_proxy` network behind Caddy:

| Domain | Upstream container | Notes |
|---|---|---|
| `stock.codingstack.site` | `inventory-frontend:80` | container is `(unhealthy)` — cosmetic IPv6 healthcheck bug, see note |
| `apistock.codingstack.site` | `inventory-backend:3000` | Caddy sets `max_size 10MB` on request body |
| `rms.codingstack.site` | `rms-frontend:80` | RMS = Restaurant Management System |
| `rmsapi.codingstack.site` | `rms-backend:3000` | Caddy sets `max_size 10MB` on request body |

- `mongodb` binds `127.0.0.1:27017` (localhost only) — untouched by any of this.
- `inventory-system-redis-1` / `-meilisearch-1` are on inventory's private network, not
  proxied — leave them alone.
- RMS images are **local** (`rms-frontend:latest`, `rms-backend:latest`), not in a
  registry — don't `docker rm` or rebuild those containers or you'll lose them.

> **`inventory-frontend` unhealthy:** its `spa.conf` only has `listen 80;` (IPv4), but the
> healthcheck `wget http://localhost/health` hits `::1` first and fails. The site works
> fine. Fix later by using `127.0.0.1` in the healthcheck or adding `listen [::]:80;`.
> **Fix it before importing apps natively into Coolify** — Coolify may treat an unhealthy
> container as down.

---

## Phase 00 — Remove the existing Dokploy install first

Dokploy is already on this box. It enabled **Docker Swarm** and deployed its own Traefik
+ Postgres + Redis as swarm services plus overlay network `dokploy-network`. Your apps,
Mongo, redis, meili, and Caddy are all **standalone containers on bridge networks**, so
scoping every command to `dokploy` leaves them untouched. **Never** `prune` here.

**Assess first** (also tells you whether Caddy still serves or Dokploy's Traefik took 80/443):
```bash
docker info --format '{{.Swarm.LocalNodeState}}'                 # 'active' if swarm on
docker service ls 2>/dev/null | grep -i dokploy
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -iE 'dokploy'
sudo ss -tlnp '( sport = :80 or sport = :443 )'                  # who holds the ports
docker ps --format '{{.Names}} {{.Status}}' | grep -iE 'caddy|dokploy'
```

**Remove (scoped to `dokploy` only):**
```bash
docker stack rm dokploy 2>/dev/null
docker service ls -q --filter name=dokploy | xargs -r docker service rm
sleep 5
docker ps -aq --filter name=dokploy | xargs -r docker rm -f
docker swarm leave --force        # removes overlay nets; bridge containers unaffected
docker volume ls -q --filter name=dokploy | xargs -r docker volume rm
sudo rm -rf /etc/dokploy
docker network ls -q --filter name=dokploy | xargs -r docker network rm 2>/dev/null || true

# ⚠️ REQUIRED after `swarm leave`: it leaves Docker's embedded DNS (127.0.0.11) in a
# broken state, so Caddy resolves app container names as NXDOMAIN and every site 502s
# even though the containers are healthy and on shared_proxy. Restarting the daemon
# rebuilds the DNS state; all containers auto-restart via `restart: unless-stopped`.
sudo systemctl restart docker
sleep 20
```

**Restore + verify the baseline:**
```bash
docker ps --format '{{.Names}}' | grep -q '^caddy$' || (cd ~/infra && docker compose up -d caddy)
sudo ss -tlnp '( sport = :80 or sport = :443 )'   # expect caddy
curl -I https://stock.codingstack.site               # expect 200
curl -I https://rms.codingstack.site                 # expect 200
docker ps --format 'table {{.Names}}\t{{.Status}}' # inventory-*, rms-*, mongodb all Up
```
Only proceed once all four sites are green again through Caddy.

---

## Phase 0 — Back up (before touching anything)

```bash
cp ~/infra/Caddyfile ~/infra/Caddyfile.bak
docker inspect caddy > ~/caddy.inspect.bak.json
sudo cp -a /etc/iptables /root/iptables.bak 2>/dev/null || true
```
If this is an Oracle boot volume, take a **volume snapshot** in the Oracle console — the
cheapest possible rollback.

---

## Phase 1 — DNS for the dashboard (early; before the window)

```
coolify.codingstack.site   A   64.181.209.119
```
```bash
dig @8.8.8.8 +short coolify.codingstack.site   # must return 64.181.209.119
```

---

## Phase 2 — Install Coolify (ZERO downtime — dashboard is on 8000)

Docker is already installed; the installer reuses it and sets up `/data/coolify`.

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Coolify comes up on port 8000. Its Traefik (`coolify-proxy`) will *try* to bind 80/443
and **fail** because Caddy still holds them — that's expected and harmless; your live
sites keep serving through Caddy. We fix the proxy in Phase 4.

**Access the dashboard securely** (keep 8000 firewalled — don't open it in Oracle VCN):
```bash
# from your laptop:
ssh -L 8000:localhost:8000 ubuntu@64.181.209.119
# then open http://localhost:8000
```
Create the admin account and finish onboarding (localhost server is auto-registered).

---

## Phase 3 — Pre-stage the routes (still ZERO downtime, Caddy still serving)

Coolify's Traefik isn't on 80/443 yet, so we can wire everything now with no impact.

**3.1 Attach the four web containers to Coolify's `coolify` network** so the proxy can
reach them by name:

```bash
docker network connect coolify inventory-frontend
docker network connect coolify inventory-backend
docker network connect coolify rms-frontend
docker network connect coolify rms-backend
```

**3.2 Add a Traefik dynamic (file-provider) config** recreating every current route.
Coolify watches `/data/coolify/proxy/dynamic/` and hot-reloads:

```bash
sudo tee /data/coolify/proxy/dynamic/legacy-apps.yaml >/dev/null <<'YAML'
http:
  middlewares:
    body-10m:
      buffering:
        maxRequestBodyBytes: 10485760   # mirrors Caddy's `max_size 10MB` on the APIs
    to-https:
      redirectScheme:
        scheme: https
        permanent: true

  routers:
    # ---- Inventory ----
    inv-fe:
      rule: "Host(`stock.codingstack.site`)"
      entryPoints: [https]
      service: inv-fe
      tls: { certResolver: letsencrypt }
    inv-fe-http:
      rule: "Host(`stock.codingstack.site`)"
      entryPoints: [http]
      middlewares: [to-https]
      service: inv-fe
    inv-be:
      rule: "Host(`apistock.codingstack.site`)"
      entryPoints: [https]
      middlewares: [body-10m]
      service: inv-be
      tls: { certResolver: letsencrypt }
    inv-be-http:
      rule: "Host(`apistock.codingstack.site`)"
      entryPoints: [http]
      middlewares: [to-https]
      service: inv-be

    # ---- RMS (Restaurant Management System) ----
    rms-fe:
      rule: "Host(`rms.codingstack.site`)"
      entryPoints: [https]
      service: rms-fe
      tls: { certResolver: letsencrypt }
    rms-fe-http:
      rule: "Host(`rms.codingstack.site`)"
      entryPoints: [http]
      middlewares: [to-https]
      service: rms-fe
    rms-be:
      rule: "Host(`rmsapi.codingstack.site`)"
      entryPoints: [https]
      middlewares: [body-10m]
      service: rms-be
      tls: { certResolver: letsencrypt }
    rms-be-http:
      rule: "Host(`rmsapi.codingstack.site`)"
      entryPoints: [http]
      middlewares: [to-https]
      service: rms-be

  services:
    inv-fe:
      loadBalancer:
        servers: [ { url: "http://inventory-frontend:80" } ]
    inv-be:
      loadBalancer:
        servers: [ { url: "http://inventory-backend:3000" } ]
    rms-fe:
      loadBalancer:
        servers: [ { url: "http://rms-frontend:80" } ]
    rms-be:
      loadBalancer:
        servers: [ { url: "http://rms-backend:3000" } ]
YAML
```

Sanity-check the entrypoint / resolver names against what Coolify actually generated
(versions have been stable on `http`/`https`/`letsencrypt`, but verify):
```bash
grep -E 'entryPoints|entrypoints|certificatesresolvers|--providers.file' \
  /data/coolify/proxy/docker-compose.yml
```
If your proxy uses different names, edit `legacy-apps.yaml` to match.

> **WebSockets / Socket.IO** (`apistock`, `rmsapi`) pass through Traefik automatically.
> If `/socket.io/*` ever returns 403 under Coolify, it's a known dynamic-config gotcha —
> ensure no auth middleware is attached and that forwarded headers pass through.

---

## Phase 4 — Cutover (the maintenance window; ~1 minute)

First set the dashboard domain (do this in Stage 1, before the window): Coolify UI →
**Settings → Instance** → set `https://coolify.codingstack.site`. Coolify writes its own
Traefik route (`/data/coolify/proxy/dynamic/coolify.yaml`) for the dashboard.

```bash
# 4.1 Free 80/443 — stop ONLY Caddy. Mongo shares that compose; do NOT `down` it.
cd ~/infra
docker compose stop caddy
sudo ss -tlnp '( sport = :80 or sport = :443 )'   # expect empty

# 4.2 Start Coolify's Traefik so it takes 80/443.
#     NOTE: `coolify-proxy` does NOT exist until first started. Either click
#     Servers → localhost → Proxy → Start Proxy in the UI, OR start it from the
#     compose file Coolify generated (works headless, ports must be free):
sudo docker compose -f /data/coolify/proxy/docker-compose.yml up -d
sleep 8
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' | grep coolify-proxy
docker logs coolify-proxy --tail 50 | grep -iE 'error|acme|certificate'
```

Traefik reads `legacy-apps.yaml`, routes all four domains, and requests fresh Let's
Encrypt certs (DNS already points here, port 80 is now reachable). First hit per domain
may take 10–30s to issue a cert — re-run the verify loop if the first hit errors.

Then drop the SSH tunnel and use `https://coolify.codingstack.site` directly.

---

## Phase 5 — Verify (end of window)

```bash
curl -I  https://stock.codingstack.site            # expect 200
curl -s  https://apistock.codingstack.site/health  # expect 200 / {"status":"ok"}
curl -I  https://rms.codingstack.site              # expect 200
curl -I  https://rmsapi.codingstack.site           # expect a live response
curl -I  https://coolify.codingstack.site          # expect 200/302 (dashboard)
```
Open each site in a browser, log in, and exercise a websocket-heavy action on inventory
to confirm `/socket.io/*` works through Traefik.

---

## Phase 6 — Retire Caddy (only after Phase 5 is green)

```bash
cd ~/infra
docker compose rm -sf caddy      # remove stopped Caddy; Mongo stays up
docker compose ps                # mongodb still running
```
Then edit `~/infra/docker-compose.yml` to delete the `caddy` service block (keep
`mongodb` + the networks). Keep `Caddyfile.bak` for a while.

**Docs:** the old rule in `HOSTING_GUIDE.md` ("Caddy is the only ingress; don't add
Traefik") is now inverted. New projects get a Coolify app (or a route in
`/data/coolify/proxy/dynamic/`), not a Caddyfile block.

---

## Rollback (if Phase 5 fails)

```bash
# Free 80/443 from Coolify's proxy:
docker stop coolify-proxy
sudo ss -tlnp '( sport = :80 or sport = :443 )'   # expect empty

# Restore Caddy — sites back exactly as before:
cd ~/infra && docker compose up -d caddy
curl -I https://stock.codingstack.site               # expect 200
```
Coolify itself stays installed (dashboard idle on 8000); retry the cutover later.
Nothing about the app containers or Mongo changed, so rollback is clean. You can also
disconnect the extra network attachments if desired:
`docker network disconnect coolify inventory-frontend` (etc.).

---

## Notes / gotchas

- **Mongo is safe:** never binds public ports, never touched. Only ever stop/remove the
  `caddy` service in `~/infra` — never `docker compose down` that stack.
- **Firewall:** 80/443 already open in Oracle VCN + host iptables, so Traefik reuses them
  with no change. Keep **8000 closed**; use the SSH tunnel, then the `coolify.` subdomain.
- **RMS is unmanaged/local images** — it keeps running as a plain container behind Traefik
  via the file provider. Don't rebuild it without its source on the box.
- **Certs:** Traefik re-issues LE certs for all domains (Caddy's old certs aren't reused).
  Five domains is far under LE rate limits.
- **No Swarm, no rebuilds:** existing containers are only *network-connected* and
  *file-routed* — nothing is recreated, so this is as low-risk as an edge swap gets.

Sources: [Coolify install](https://coolify.io/docs/get-started/installation) ·
[Coolify Traefik load-balancing / dynamic config](https://coolify.io/docs/knowledge-base/proxy/traefik/load-balancing) ·
[Managing custom domains with Coolify + Traefik](https://eventuallymaking.io/p/managing-custom-domains-and-dynamic-ssl-with-coolify-and-traefik)
