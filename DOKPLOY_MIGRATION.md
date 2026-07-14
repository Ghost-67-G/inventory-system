# Migrating the VPS edge from Caddy → Dokploy (Traefik)

**Goal:** Run Dokploy on the existing Oracle VPS (`64.181.209.119`) and make its
**Traefik the single edge proxy on 80/443**, replacing Caddy — while the existing
app containers (inventory + the 2nd project) keep running unchanged behind it.

**Decision recap (from planning):**
- Dokploy/Traefik becomes the edge on 80/443. Caddy is retired.
- Dokploy dashboard reachable at `dokploy.devsdesk.site`, **TLS terminated by Traefik**
  (not Caddy — Caddy is gone). During setup, reach the UI via SSH tunnel; do **not**
  open port 3000 publicly.

> ⚠️ **This is NOT zero-downtime.** Ports 80/443 can only be held by one process.
> Handing them from Caddy to Traefik causes a blip (target: ~1 minute). Do it in a
> maintenance window. Rollback plan is in the last section — keep Caddy's compose
> intact until you've verified.

---

## Strategy: keep existing stacks as-is, route them via Traefik's file provider

The current apps run as **standalone `docker compose` containers** on the
`shared_proxy` network, proxied by Caddy. We do **not** rebuild or re-import them
into Dokploy right now. Instead:

1. Dokploy installs Traefik + creates the attachable overlay network `dokploy-network`.
2. We connect the existing web-facing containers to `dokploy-network`.
3. We add a Traefik **file-provider** config (`/etc/dokploy/traefik/dynamic/legacy-apps.yml`)
   that recreates every route the live Caddyfile currently serves.

This keeps the migration additive and reversible. You can later re-import each app
as a native Dokploy "Compose" service at your leisure.

---

## Phase 0 — Inventory the CURRENT state (before touching anything)

The repo's `infra/Caddyfile` is **stale** (it lacks the 2nd project). The live file
on the VPS is the source of truth. On the VPS:

```bash
# Every domain → container mapping currently served:
cat ~/infra/Caddyfile

# Confirm what's actually running and on which networks:
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
docker network inspect shared_proxy --format '{{range .Containers}}{{.Name}} {{end}}'

# Confirm only Caddy binds 80/443 on the host:
sudo ss -tlnp '( sport = :80 or sport = :443 )'
```

Write down, for **each** web-facing service (inventory + 2nd project):
`domain → container-name:port`. You'll need every one in Phase 4.

Confirmed from the live VPS (`~/infra/Caddyfile` + `docker ps`, 2026-07-14):

| Domain | Upstream container | Notes |
|---|---|---|
| `stock.devsdesk.site` | `inventory-frontend:80` | container shows `(unhealthy)` — check its `/health` before the window |
| `apistock.devsdesk.site` | `inventory-backend:3000` | Caddy sets `max_size 10MB` on request body |
| `rms.devsdesk.site` | `rms-frontend:80` | RMS = Restaurant Management System |
| `rmsapi.devsdesk.site` | `rms-backend:3000` | Caddy sets `max_size 10MB` on request body |

All four web containers are on `shared_proxy` alongside `caddy`. `mongodb` binds
`127.0.0.1:27017` (localhost only). `inventory-system-redis-1` / `-meilisearch-1`
are on inventory's private network, not proxied — leave them alone.

Also back up state:
```bash
sudo cp -a /etc/iptables /root/iptables.bak 2>/dev/null || true
cp ~/infra/Caddyfile ~/infra/Caddyfile.bak
docker inspect caddy > ~/caddy.inspect.bak.json
```
If this is an Oracle boot volume, consider taking a **volume snapshot** in the
Oracle console first — cheapest possible rollback.

---

## Phase 1 — DNS for the dashboard (do this early, before the window)

Add an A record at the registrar and let it propagate:

```
dokploy.devsdesk.site   A   64.181.209.119
```

Verify:
```bash
dig @8.8.8.8 +short dokploy.devsdesk.site   # must return 64.181.209.119
```

---

## Phase 2 — Install Dokploy (inside the maintenance window)

Docker is already installed (via get.docker.com), so the installer will reuse it.
The installer runs `docker swarm init` and starts Traefik, which **needs 80/443**.
Since Caddy still holds them, free them **immediately before** installing:

```bash
# 2.1  Stop ONLY Caddy (Mongo lives in the same compose — do NOT `down` the stack).
cd ~/infra
docker compose stop caddy        # 80/443 now free. Sites are DOWN from here — window starts.

# 2.2  Confirm nothing holds 80/443:
sudo ss -tlnp '( sport = :80 or sport = :443 )'   # expect empty

# 2.3  Install Dokploy.
curl -sSL https://dokploy.com/install.sh | sh
```

**Oracle multi-IP note:** if `docker swarm init` complains about multiple addresses,
re-run it explicitly, then re-run the installer:
```bash
docker swarm init --advertise-addr 64.181.209.119
```

After install, Traefik should be bound to 80/443 and `dokploy-network` should exist:
```bash
docker service ls                                  # dokploy-traefik + dokploy services
docker network ls | grep dokploy-network           # attachable overlay
sudo ss -tlnp '( sport = :80 or sport = :443 )'    # now held by traefik/dockerd
```

---

## Phase 3 — Access the dashboard securely (no public port 3000)

From your laptop, tunnel 3000 over SSH — keep 3000 closed in Oracle VCN + iptables:

```bash
ssh -L 3000:localhost:3000 <user>@64.181.209.119
# then open http://localhost:3000 in your browser
```

Create the admin account. Then in the UI: **Settings → Server / Web Domain**, set the
Dokploy dashboard domain to `dokploy.devsdesk.site` with **Let's Encrypt**. Traefik
will issue the cert (port 80 is now reachable). After that you can drop the tunnel and
use `https://dokploy.devsdesk.site`.

---

## Phase 4 — Recreate the existing routes in Traefik (restores the live sites)

**4.1 Attach the existing web containers to Traefik's network** so Traefik can reach
them by name (repeat for every web-facing container from Phase 0):

```bash
docker network connect dokploy-network inventory-frontend
docker network connect dokploy-network inventory-backend
docker network connect dokploy-network rms-frontend
docker network connect dokploy-network rms-backend
```

**4.2 Add a file-provider dynamic config.** Dokploy's Traefik watches
`/etc/dokploy/traefik/dynamic/`. Create `legacy-apps.yml` there:

```bash
sudo tee /etc/dokploy/traefik/dynamic/legacy-apps.yml >/dev/null <<'YAML'
http:
  middlewares:
    body-10m:
      buffering:
        maxRequestBodyBytes: 10485760   # mirrors Caddy's `max_size 10MB` on the API
    to-https:
      redirectScheme:
        scheme: https
        permanent: true

  routers:
    # ---- Inventory ----
    inv-fe:
      rule: "Host(`stock.devsdesk.site`)"
      entryPoints: [websecure]
      service: inv-fe
      tls:
        certResolver: letsencrypt
    inv-fe-http:
      rule: "Host(`stock.devsdesk.site`)"
      entryPoints: [web]
      middlewares: [to-https]
      service: inv-fe
    inv-be:
      rule: "Host(`apistock.devsdesk.site`)"
      entryPoints: [websecure]
      middlewares: [body-10m]
      service: inv-be
      tls:
        certResolver: letsencrypt
    inv-be-http:
      rule: "Host(`apistock.devsdesk.site`)"
      entryPoints: [web]
      middlewares: [to-https]
      service: inv-be

    # ---- RMS (Restaurant Management System) ----
    rms-fe:
      rule: "Host(`rms.devsdesk.site`)"
      entryPoints: [websecure]
      service: rms-fe
      tls:
        certResolver: letsencrypt
    rms-fe-http:
      rule: "Host(`rms.devsdesk.site`)"
      entryPoints: [web]
      middlewares: [to-https]
      service: rms-fe
    rms-be:
      rule: "Host(`rmsapi.devsdesk.site`)"
      entryPoints: [websecure]
      middlewares: [body-10m]
      service: rms-be
      tls:
        certResolver: letsencrypt
    rms-be-http:
      rule: "Host(`rmsapi.devsdesk.site`)"
      entryPoints: [web]
      middlewares: [to-https]
      service: rms-be

  services:
    inv-fe:
      loadBalancer:
        servers:
          - url: "http://inventory-frontend:80"
    inv-be:
      loadBalancer:
        servers:
          - url: "http://inventory-backend:3000"
    rms-fe:
      loadBalancer:
        servers:
          - url: "http://rms-frontend:80"
    rms-be:
      loadBalancer:
        servers:
          - url: "http://rms-backend:3000"
YAML
```

Traefik hot-reloads the file provider — no restart needed. Verify the entrypoint names
(`web`/`websecure`) and cert resolver name (`letsencrypt`) match Dokploy's generated
`/etc/dokploy/traefik/traefik.yml`; adjust if yours differ.

> **WebSockets / Socket.IO** (`apistock` `/socket.io/*`) work through Traefik with no
> extra config — it upgrades automatically.

---

## Phase 5 — Verify (end of window)

```bash
# Certs may take a few seconds to issue on first hit.
curl -I  https://stock.devsdesk.site            # expect 200
curl -s  https://apistock.devsdesk.site/health  # expect 200 / {"status":"ok"}
curl -I  https://rms.devsdesk.site              # expect 200
curl -I  https://rmsapi.devsdesk.site           # expect a live response
curl -I  https://dokploy.devsdesk.site          # expect 200/302 (dashboard)

# Watch cert issuance / routing errors:
docker service logs dokploy-traefik --tail 100 | grep -iE 'acme|certificate|error'
```

Open each site in a browser, log in, and exercise a websocket-heavy action on the
inventory app to confirm `/socket.io/*` proxies correctly.

---

## Phase 6 — Retire Caddy (only after everything above is green)

```bash
cd ~/infra
docker compose rm -sf caddy         # remove the stopped Caddy container; Mongo stays up
docker compose ps                   # mongodb should still be running
```
Then edit `~/infra/docker-compose.yml` to delete the `caddy` service block (leave
`mongodb` and the networks). Keep `Caddyfile.bak` around for a while.

**Update the repo docs** so future deploys use Traefik, not Caddy: the
`HOSTING_GUIDE.md` rule *"Caddy is the only ingress / do not add Traefik"* is now
inverted — new projects get a Traefik router (file provider entry or, better, native
Dokploy) instead of a Caddyfile block.

---

## Rollback (if Phase 5 fails)

Bring Caddy back on 80/443:

```bash
# Free 80/443 from Traefik:
docker service scale dokploy-traefik=0      # or: docker service rm dokploy-traefik
sudo ss -tlnp '( sport = :80 or sport = :443 )'   # expect empty

# Restart Caddy — sites restored exactly as before:
cd ~/infra && docker compose up -d caddy
curl -I https://stock.devsdesk.site         # expect 200
```

Dokploy itself can stay installed (dashboard idle); re-attempt the Traefik cutover
later. Nothing about the app containers or Mongo changed, so rollback is clean.

---

## Notes / gotchas

- **Mongo is safe:** it never binds host ports (only the `shared_db` network) and is
  untouched by all of this. Never `docker compose down` the `~/infra` stack — that
  would take Mongo down. Only stop/remove the `caddy` service.
- **`docker swarm init` + standalone containers coexist fine.** Your existing
  `docker compose` containers keep running after swarm is enabled.
- **Firewall:** 80/443 already open in both Oracle VCN Security List and host iptables,
  so Traefik reuses them with no firewall change. Keep **3000 closed**; use the SSH
  tunnel for first login, then the `dokploy.devsdesk.site` subdomain.
- **Let's Encrypt:** Traefik re-issues certs for all domains (Caddy's old certs in the
  `caddy_data` volume aren't reused). A handful of domains is well under LE rate limits.
- **Two proxies can never share 80/443** — that's the whole reason for the maintenance
  window. There is no config that avoids the handoff blip.
