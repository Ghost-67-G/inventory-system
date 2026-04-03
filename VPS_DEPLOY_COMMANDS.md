# VPS Deployment Commands — Inventory System

Run these commands **in order** on the VPS (`root@srv914507`).

---

## STEP 1 — First: figure out where HealthCare project lives

```bash
# Find the HealthCare docker-compose directory
docker inspect reverse-proxy --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}'
# Note this path — we'll call it HEALTHCARE_DIR
```

## STEP 2 — Create temp self-signed cert so reverse-proxy can start

```bash
# cd into the HealthCare project directory from step 1
cd <HEALTHCARE_DIR>

mkdir -p certbot/conf/live/devsdesk.site

openssl req -x509 -nodes -days 7 -newkey rsa:2048 \
  -keyout certbot/conf/live/devsdesk.site/privkey.pem \
  -out certbot/conf/live/devsdesk.site/fullchain.pem \
  -subj "/CN=devsdesk.site"
```

## STEP 3 — Update nginx.conf to use runtime DNS resolution

The reverse-proxy crashes if inventory containers aren't running because nginx resolves
upstreams at startup. We need `resolver` + variables so it resolves at request time.

Copy the updated `nginx.conf` to the HealthCare directory (from git pull), OR manually
edit it on the VPS. The inventory server blocks should look like:

```nginx
  # ─── Inventory System: Frontend ─────────────────────────────────────
  server {
    listen 443 ssl;
    server_name stock.devsdesk.site;

    ssl_certificate /etc/letsencrypt/live/devsdesk.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/devsdesk.site/privkey.pem;

    resolver 127.0.0.11 valid=30s;
    set $inv_frontend http://inventory-frontend:80;

    location / {
      proxy_pass $inv_frontend;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }

  # ─── Inventory System: API + Socket.IO ──────────────────────────────
  server {
    listen 443 ssl;
    server_name apistock.devsdesk.site;

    ssl_certificate /etc/letsencrypt/live/devsdesk.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/devsdesk.site/privkey.pem;

    client_max_body_size 10M;

    resolver 127.0.0.11 valid=30s;
    set $inv_backend http://inventory-backend:3000;

    location /socket.io/ {
      proxy_pass $inv_backend;

      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";

      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;

      proxy_read_timeout 86400;
    }

    location / {
      proxy_pass $inv_backend;

      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
```

## STEP 4 — Restart reverse-proxy (restores HealthCare!)

```bash
docker restart reverse-proxy

sleep 3

docker ps --format "table {{.Names}}\t{{.Status}}" | grep reverse-proxy
# Expected: reverse-proxy   Up X seconds (NOT "Restarting")

# Check nginx logs if it's still crashing:
docker logs reverse-proxy --tail 20
```

## STEP 5 — Verify HealthCare is back online

```bash
curl -k -o /dev/null -w "%{http_code}\n" https://allcarematch.tech
# Expected: 200
```

---

## STEP 6 — Check inventory backend logs

```bash
cd ~/inventory/inventory-system

docker logs inventory-system_backend_1 --tail 80
# Look for the error causing restart loops. Common causes:
#   - MongoDB auth failure
#   - Missing env vars
#   - Port conflict
```

---

## STEP 7 — DNS Records (do this in your domain registrar)

Add **A records** for both subdomains pointing to your VPS IP:

```
stock.devsdesk.site      →  A  →  <VPS_IP>
apistock.devsdesk.site   →  A  →  <VPS_IP>
```

Verify DNS propagation:

```bash
dig +short stock.devsdesk.site
dig +short apistock.devsdesk.site
# Both should return your VPS IP
```

---

## STEP 8 — Get real Let's Encrypt SSL certs

> DNS must be pointing to the VPS before this step.

```bash
cd /root/repos

docker exec certbot certbot certonly --webroot \
  -w /var/www/certbot \
  -d stock.devsdesk.site -d apistock.devsdesk.site \
  --cert-name devsdesk.site \
  --agree-tos --no-eff-email \
  -m YOUR_EMAIL@example.com
```

Replace `YOUR_EMAIL@example.com` with your real email.

Then reload nginx to pick up the real certs:

```bash
docker exec reverse-proxy nginx -s reload
```

Verify SSL is working:

```bash
# Should return 200 (no -k flag = real cert validation)
curl https://stock.devsdesk.site -o /dev/null -w "%{http_code}\n"
curl https://apistock.devsdesk.site/health
```

---

## STEP 9 — Push code from local machine, pull on VPS

**On your LOCAL machine:**

```bash
cd /home/ghost-67/Desktop/Work/personal/inventory-v1/inventory-system
git add -A && git commit -m "fix: add /api to VITE_API_URL, remove nginx service" && git push
```

Also push the HealthCare changes (updated nginx.conf + docker-compose.yml):

```bash
cd /home/ghost-67/Desktop/Work/personal/devora/HeathCare
git add -A && git commit -m "feat: add inventory domains to reverse-proxy" && git push
```

**On VPS:**

```bash
# Pull inventory changes
cd ~/inventory/inventory-system
git pull

# Pull HealthCare changes (if HealthCare is also a git repo on VPS)
cd ~/HeathCare
git pull
```

---

## STEP 10 — Bring down old inventory stack cleanly

```bash
cd ~/inventory/inventory-system

docker-compose --env-file .env.production down --remove-orphans
```

---

## STEP 11 — Ensure shared_proxy network exists

```bash
docker network create shared_proxy 2>/dev/null || echo "shared_proxy already exists"
```

---

## STEP 12 — Rebuild and bring up inventory stack

```bash
cd ~/inventory/inventory-system

# Rebuild frontend (VITE_API_URL is baked at build time)
docker-compose --env-file .env.production build --no-cache frontend

# Start everything
docker-compose --env-file .env.production up -d
```

---

## STEP 13 — Restart HealthCare reverse-proxy to pick up shared_proxy network

```bash
cd ~/HeathCare
docker-compose down reverse-proxy
docker-compose up -d reverse-proxy
```

Or if you don't want to restart all HealthCare services:

```bash
docker restart reverse-proxy
docker exec reverse-proxy nginx -s reload
```

---

## STEP 14 — Verify everything

```bash
# Check all containers are healthy
docker ps --format "table {{.Names}}\t{{.Status}}"

# Test inventory API
curl -k https://apistock.devsdesk.site/health
# Expected: {"status":"ok"} or 200

# Test inventory frontend
curl -k -o /dev/null -w "%{http_code}\n" https://stock.devsdesk.site
# Expected: 200

# Test HealthCare still works
curl -k -o /dev/null -w "%{http_code}\n" https://allcarematch.tech
# Expected: 200
```

---

## Troubleshooting

### Backend keeps restarting
```bash
docker logs inventory-system_backend_1 --tail 100
```

### Frontend returns 502
```bash
# Check frontend is running and healthy
docker ps | grep frontend
docker logs inventory-system_frontend_1 --tail 20

# Check reverse-proxy can reach inventory-frontend
docker exec reverse-proxy ping -c 1 inventory-frontend
```

### SSL certificate issues
```bash
# List all certs
docker exec certbot certbot certificates

# Force renewal
docker exec certbot certbot renew --force-renewal
docker exec reverse-proxy nginx -s reload
```

### Containers can't communicate across projects
```bash
# Verify both are on shared_proxy
docker network inspect shared_proxy --format '{{range .Containers}}{{.Name}} {{end}}'
# Should list: reverse-proxy, inventory-system_backend_1, inventory-system_frontend_1
```
