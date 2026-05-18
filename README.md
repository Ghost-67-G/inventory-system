# Inventory Management System

A full-stack, multi-tenant inventory management platform built with Node.js, React 19, MongoDB, Redis, and MeiliSearch. Ships in two deployment modes:

- **`saas`** — A single hosted deployment that serves many tenants (organisations) from one stack.
- **`self_hosted`** — One independent installation per customer, managed by that customer on their own server.

---

## Table of Contents

1. [Features](#features)
2. [Architecture Overview](#architecture-overview)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Local Development Setup](#local-development-setup)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Production Deployment — SaaS (Shared VPS)](#production-deployment--saas-shared-vps)
8. [Self-Hosted Deployment](#self-hosted-deployment)
9. [Roles & Permissions](#roles--permissions)
10. [Background Jobs & Queues](#background-jobs--queues)
11. [API Overview](#api-overview)
12. [Scripts Reference](#scripts-reference)
13. [Docker Images](#docker-images)

---

## Features

| Area | What it does |
|---|---|
| **Multi-tenancy** | Every resource (products, warehouses, users, alerts) is fully scoped to a tenant. In SaaS mode each organisation is isolated; in self-hosted mode there is exactly one tenant. |
| **Product Catalogue** | Create and manage products with SKU, description, category, cost/selling price, custom fields, and images. |
| **Warehouse Management** | Multiple warehouses per tenant with per-warehouse stock levels. |
| **Stock Movements** | Record adjustments, transfers between warehouses, and returns with full audit trail. |
| **Low-Stock Alerts** | Configurable per-product thresholds. BullMQ workers evaluate thresholds after every movement and send email or in-app notifications. |
| **Real-Time Updates** | Socket.IO pushes live stock and alert changes to every connected browser tab without a page refresh. |
| **Full-Text Search** | MeiliSearch indexes products and categories for instant, typo-tolerant search results. |
| **CSV Import** | Bulk-import products via CSV file. Import jobs are processed asynchronously; progress is streamed to the UI via Socket.IO. |
| **Reports & Analytics** | Stock value reports, movement history, low-stock summaries — all exportable. |
| **Dashboard** | Aggregated KPI cards (total products, stock value, active alerts, recent movements) computed and cached by background workers. |
| **User Management** | Invite users by email, assign roles (owner / manager / staff / viewer), deactivate accounts. |
| **Audit Log** | Immutable log of every create / update / delete action with actor, timestamp, and diff. |
| **Email Notifications** | Transactional emails (invite, password reset, low-stock digest) sent via Resend. |
| **Onboarding Wizard** | Step-by-step first-run wizard for new tenants to configure organisation settings, warehouses, and categories. |
| **Tenant Settings** | Currency, timezone, measurement unit, date format, email notification preferences, and custom product fields — all configurable per tenant. |
| **Security** | Helmet, CORS, rate limiting, XSS cleaning, Mongo sanitisation, JWT access + refresh token rotation, bcrypt password hashing. |

---

## Architecture Overview

```
Browser (React 19 SPA)
        │  HTTP / WebSocket
        ▼
   Nginx (reverse proxy)
        │
   ┌────┴────────────────────────────────────┐
   │  Backend  (Node.js / Express / TS)      │
   │  ┌─────────────┐  ┌──────────────────┐  │
   │  │  REST API   │  │  Socket.IO server│  │
   │  └──────┬──────┘  └────────┬─────────┘  │
   │         │                  │             │
   │  ┌──────▼──────────────────▼──────────┐  │
   │  │     BullMQ Workers (8 queues)      │  │
   │  └──────┬────────────────────────────┘  │
   └─────────┼───────────────────────────────┘
             │
    ┌────────┼────────────────────┐
    │        │                    │
    ▼        ▼                    ▼
 MongoDB   Redis           MeiliSearch
(primary  (sessions,       (full-text
  store)  queues,           search)
          cache)
```

In **SaaS mode** the `shared_proxy` Docker network connects the stack to an already-running Nginx container that terminates TLS and routes subdomains.

In **self-hosted mode** Nginx is part of the compose stack itself and listens on a configurable host port (default `80`).

---

## Tech Stack

### Backend

| Package | Purpose |
|---|---|
| **Node.js 20** | Runtime |
| **Express 4** | HTTP framework |
| **TypeScript 5** | Type safety |
| **Mongoose 8** | MongoDB ODM |
| **BullMQ 5** | Background job queues (backed by Redis) |
| **Socket.IO 4** | Bi-directional real-time communication |
| **ioredis 5** | Redis client |
| **MeiliSearch SDK** | Full-text search integration |
| **Zod 3** | Runtime schema validation for env vars and request bodies |
| **jsonwebtoken** | JWT access + refresh tokens |
| **bcryptjs** | Password hashing |
| **Helmet** | HTTP security headers |
| **express-rate-limit** | IP-based rate limiting |
| **express-mongo-sanitize** | NoSQL injection prevention |
| **xss-clean** | XSS input sanitisation |
| **multer** | Multipart file uploads (CSV import) |
| **csv-parse** | CSV parsing in import worker |
| **Resend** | Transactional email delivery |
| **Winston** | Structured logging |
| **Luxon** | Date/time utilities |
| **compression** | Gzip response compression |

### Frontend

| Package | Purpose |
|---|---|
| **React 19** | UI library |
| **Vite 7** | Build tool and dev server |
| **TypeScript 5** | Type safety |
| **Tailwind CSS 4** | Utility-first styling |
| **shadcn/ui + Radix UI** | Accessible component primitives |
| **TanStack Query 5** | Server-state management, caching, and mutation |
| **TanStack Table 8** | Headless data tables |
| **TanStack Virtual 3** | Virtualised lists |
| **React Router 7** | Client-side routing |
| **Zustand 5** | Client-side global state (auth, UI) |
| **React Hook Form 7 + Zod** | Form handling and validation |
| **Recharts 2** | Charts and data visualisation |
| **Socket.IO Client 4** | Real-time updates from backend |
| **Axios** | HTTP client |
| **dnd kit** | Drag-and-drop (custom field ordering) |
| **date-fns 4** | Date formatting |
| **Lucide React** | Icon set |
| **Sonner** | Toast notifications |

### Data Services

| Service | Version | Role |
|---|---|---|
| **MongoDB** | 7 | Primary data store (replica set for transactions) |
| **Redis** | 7 | Session tokens, BullMQ job queues, dashboard cache, tenant cache |
| **MeiliSearch** | v1.7 | Full-text search index for products/categories |

### Infrastructure

| Tool | Role |
|---|---|
| **Docker + Docker Compose** | Containerisation for all services |
| **Nginx (alpine)** | Reverse proxy, SPA serving, WebSocket upgrade |
| **GitHub Container Registry (ghcr.io)** | Docker image hosting |

---

## Project Structure

```
inventory-system/
├── backend/                  # Node.js / Express API
│   ├── src/
│   │   ├── app.ts            # Express app setup, middleware, route mounting
│   │   ├── server.ts         # HTTP + Socket.IO server bootstrap
│   │   ├── config/           # Config loader (Zod-validated env), DB, Redis, MeiliSearch, Socket
│   │   ├── middleware/       # auth, rbac, tenant resolver, validation, error handler
│   │   ├── models/           # Mongoose schemas: Tenant, User, Product, Category,
│   │   │                     #   Warehouse, WarehouseStock, StockMovement, StockAlert,
│   │   │                     #   AuditLog, ImportJob
│   │   ├── modules/          # Feature modules (each owns routes, controller, service, schema)
│   │   │   ├── auth/         # Register, login, token refresh, password reset, email verify
│   │   │   ├── products/     # CRUD, image upload, search
│   │   │   ├── categories/   # Hierarchical categories
│   │   │   ├── warehouses/   # Warehouse CRUD + stock per warehouse
│   │   │   ├── stock/        # Adjustments, transfers, movement history
│   │   │   ├── alerts/       # Low-stock alerts, acknowledgement
│   │   │   ├── users/        # Invite, list, update role, deactivate
│   │   │   ├── dashboard/    # Aggregated KPI stats
│   │   │   ├── reports/      # Stock value, movement, low-stock reports + export
│   │   │   ├── import/       # CSV import job management
│   │   │   ├── audit/        # Audit log read access
│   │   │   ├── settings/     # Tenant settings + custom fields
│   │   │   └── onboarding/   # First-run wizard steps
│   │   ├── queues/           # BullMQ queue definitions (8 queues)
│   │   │   ├── jobs/         # Job payload type definitions
│   │   │   └── workers/      # Worker implementations per queue
│   │   ├── utils/            # ApiError, catchAsync, paginate, pick, jwt, email, audit, logger
│   │   └── types/            # Roles, permissions, Express augmentation
│   ├── scripts/              # seed.ts, seed-bulk.ts, validate-seed.ts + seed data
│   └── Dockerfile            # Multi-stage: builder → production (non-root user)
│
├── frontend/                 # React 19 SPA
│   ├── src/
│   │   ├── api/              # Axios client + endpoint functions per feature
│   │   ├── components/       # Feature UI components (products, warehouses, stock, …)
│   │   │   └── ui/           # shadcn/ui base components
│   │   ├── hooks/            # TanStack Query hooks per feature (useProducts, useStock, …)
│   │   ├── pages/            # Route page components
│   │   ├── layouts/          # App shell, auth layout
│   │   ├── store/            # Zustand stores (auth, UI settings)
│   │   ├── router/           # React Router config + protected route guards
│   │   ├── types/            # Shared TypeScript types + TanStack declarations
│   │   └── lib/              # Utility helpers (cn, formatters, …)
│   ├── nginx/spa.conf        # Nginx SPA config (try_files → index.html)
│   └── Dockerfile            # Multi-stage: builder (Vite) → production (Nginx)
│
├── nginx/                    # Nginx config variants
│   ├── nginx.vps.conf        # Shared VPS: no TLS, binds to 127.0.0.1:18080
│   ├── nginx.conf            # Standalone VPS: owns public 80/443
│   ├── selfhosted.conf       # Self-hosted compose stack
│   └── proxy_params          # Shared proxy header fragment
│
├── docker/
│   ├── mongo-init.js         # Creates app DB user on first start
│   └── redis.conf            # Redis config template (password substituted at runtime)
│
├── reverse-proxy/            # Host-level reverse proxy snippets (shared VPS)
│   ├── nginx/
│   │   └── inventory.example.conf
│   └── caddy/
│       └── Caddyfile.inventory.example
│
├── scripts/
│   ├── deploy.sh             # Git pull → backup → build → rolling restart → health check
│   ├── backup.sh             # mongodump to timestamped archive
│   ├── rollback.sh           # Restore previous image tags
│   └── health-check.sh       # Curl /health and assert 200
│
├── docker-compose.yml         # Production / SaaS stack (shared docker reverse proxy network)
├── docker-compose.vps.yml     # Production stack for host-level reverse proxy (Nginx/Caddy)
├── docker-compose.dev.yml     # Local dev: data services only (MongoDB, Redis, MeiliSearch)
└── docker-compose.selfhosted.yml  # Self-hosted all-in-one stack
```

---

## Local Development Setup

### Prerequisites

- **Node.js 20+** and **npm 10+**
- **Docker** and **Docker Compose plugin** (`docker compose` not `docker-compose`)
- Git

### Step 1 — Start data services

The dev compose file starts MongoDB (no auth), Redis (no auth), and MeiliSearch on their default ports so you can run the backend and frontend directly on your machine.

```bash
docker compose -f docker-compose.dev.yml up -d
```

Verify they are healthy:

```bash
docker compose -f docker-compose.dev.yml ps
```

### Step 2 — Configure environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` and set at minimum:

```env
NODE_ENV=development
PORT=3000
DEPLOYMENT_MODE=saas

MONGODB_URL=mongodb://localhost:27017/inventory
REDIS_URL=redis://localhost:6379
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_KEY=changeme_meili

JWT_ACCESS_SECRET=change_me_access_secret_at_least_32_chars
JWT_REFRESH_SECRET=change_me_refresh_secret_at_least_32_chars
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=30

FRONTEND_URL=http://localhost:5173
SOCKET_CORS_ORIGIN=http://localhost:5173

# Optional — transactional email via Resend
# RESEND_API_KEY=re_xxxxxxxxxxxx
# EMAIL_FROM=noreply@yourdomain.com
```

Edit `frontend/.env` and set:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
VITE_DEPLOYMENT_MODE=saas
```

### Step 3 — Install dependencies and start the backend

```bash
cd backend
npm install
npm run dev
```

The backend starts on `http://localhost:3000`. Hot-reload is provided by `ts-node-dev`.

### Step 4 — Install dependencies and start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:5173` with Vite HMR.

### Step 5 — Seed demo data

With both services running, seed a demo tenant, users, categories, warehouses, and products:

```bash
cd backend
npm run seed
```

For a larger dataset (stress testing):

```bash
npm run seed:bulk
```

To verify seed integrity without modifying data:

```bash
npm run validate-seed
```

### Step 6 — Open the app

Navigate to `http://localhost:5173`.

Default seed credentials (SaaS mode):

| Role | Email | Password |
|---|---|---|
| Owner | `owner@demo.com` | `Demo1234!` |
| Manager | `manager@demo.com` | `Demo1234!` |
| Staff | `staff@demo.com` | `Demo1234!` |
| Viewer | `viewer@demo.com` | `Demo1234!` |

> _Exact credentials depend on the seed script. Check `backend/scripts/data/` for the actual values._

---

## Environment Variables Reference

### Backend

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | `development`, `test`, or `production` |
| `PORT` | No | `3000` | HTTP server port |
| `DEPLOYMENT_MODE` | No | `saas` | `saas` or `self_hosted` |
| `MONGODB_URL` | Yes | — | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Yes | — | Secret for signing access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | — | Secret for signing refresh tokens (different from access) |
| `JWT_ACCESS_EXPIRATION_MINUTES` | No | `30` | Access token lifetime in minutes |
| `JWT_REFRESH_EXPIRATION_DAYS` | No | `30` | Refresh token lifetime in days |
| `REDIS_URL` | Yes | — | Redis connection URL e.g. `redis://:password@localhost:6379` |
| `MEILISEARCH_URL` | Yes | — | MeiliSearch host URL |
| `MEILISEARCH_KEY` | No | `""` | MeiliSearch master key |
| `RESEND_API_KEY` | No | — | Resend API key for outbound email |
| `EMAIL_FROM` | No | `noreply@example.com` | Sender address for transactional emails |
| `FRONTEND_URL` | Yes | — | Full public URL of the frontend (used for CORS) |
| `SOCKET_CORS_ORIGIN` | Yes | — | Allowed origin for Socket.IO (usually same as `FRONTEND_URL`) |

### Frontend (Vite build-time)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend REST API base URL e.g. `https://apistock.example.com/api` |
| `VITE_SOCKET_URL` | Backend Socket.IO base URL e.g. `https://apistock.example.com` |
| `VITE_DEPLOYMENT_MODE` | `saas` or `self_hosted` — controls which UI flows are shown |

> **Note:** Vite bakes these values into the compiled JavaScript bundle at build time. Changing them after build requires a rebuild.

---

## Production Deployment — SaaS (Shared VPS)

This is the default production configuration. For a shared VPS where other projects already use ports 80/443, run this project with `docker-compose.vps.yml`, which binds the inventory gateway only to `127.0.0.1:18080`. Then route inventory domains from your host-level Nginx or Caddy.

### Prerequisites

- Ubuntu 22.04+ VPS
- Docker Engine + Compose plugin
- Domain DNS `A` records pointing at the VPS (e.g. `stock.example.com`, `apistock.example.com`)
- A VPS-level reverse proxy already running and managing TLS for other projects

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_ORG/inventory-system.git /opt/inventory
cd /opt/inventory
```

### Step 2 — Create the production env file

```bash
cp .env.production.example .env.production
nano .env.production
```

Generate strong secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run the command twice — once for `JWT_ACCESS_SECRET` and once for `JWT_REFRESH_SECRET`.

Key values to set:

```env
GHCR_NAMESPACE=your-github-username-or-org
APP_VERSION=latest

# MongoDB
MONGO_ROOT_USERNAME=root
MONGO_ROOT_PASSWORD=<strong-random-password>
MONGO_APP_USERNAME=inventory_app
MONGO_APP_PASSWORD=<strong-random-password>

# Redis
REDIS_PASSWORD=<strong-random-password>

# MeiliSearch
MEILISEARCH_KEY=<strong-random-key>

# JWT
JWT_ACCESS_SECRET=<64-byte-hex>
JWT_REFRESH_SECRET=<64-byte-hex>

# URLs — must match your DNS
FRONTEND_URL=https://stock.example.com
SOCKET_CORS_ORIGIN=https://stock.example.com
MONGODB_URL=mongodb://inventory_app:<MONGO_APP_PASSWORD>@mongodb:27017/inventory?authSource=inventory

# Nginx binding — keep 127.0.0.1 on a shared VPS
NGINX_BIND_IP=127.0.0.1
NGINX_HTTP_PORT=18080
NGINX_CONFIG=nginx.vps.conf
```

### Step 3 — Add inventory routing to your host reverse proxy

Pick **one** proxy and follow its steps.

#### Option A — Nginx (host-level)

1. Install Nginx (if not installed):

```bash
sudo apt update
sudo apt install -y nginx
```

2. Install Certbot for Nginx (if not installed):

```bash
sudo apt install -y certbot python3-certbot-nginx
```

3. Create DNS records first (`stock.example.com` and `apistock.example.com` -> your VPS IP), then issue certificates:

```bash
sudo certbot --nginx -d stock.example.com -d apistock.example.com
```

4. Create a dedicated vhost file for inventory:

```bash
sudo cp reverse-proxy/nginx/inventory.example.conf /etc/nginx/sites-available/inventory.conf
```

5. Edit that file and replace:

- `stock.example.com` and `apistock.example.com` with your real domains
- `/etc/letsencrypt/live/example.com/...` with your real cert path (often the same domain you used in Certbot)

```bash
sudo nano /etc/nginx/sites-available/inventory.conf
```

6. Enable the site and validate config:

```bash
sudo ln -s /etc/nginx/sites-available/inventory.conf /etc/nginx/sites-enabled/inventory.conf
sudo nginx -t
```

7. Reload Nginx:

```bash
sudo systemctl reload nginx
```

#### Option B — Caddy (host-level)

1. Install Caddy (Ubuntu):

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

2. Copy the inventory Caddy template into your main Caddyfile:

```bash
sudo cp reverse-proxy/caddy/Caddyfile.inventory.example /etc/caddy/Caddyfile
```

3. Edit domains in Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace `stock.example.com` and `apistock.example.com` with your real domains. Caddy will handle TLS certificates automatically.

4. Validate and reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

#### Notes

- Keep inventory bound to `127.0.0.1:18080` in `docker-compose.vps.yml` so it does not conflict with other projects.
- If you already have existing Nginx or Caddy config for other apps, merge only the inventory domain blocks into your existing config instead of replacing the whole file.

### Step 4 — Deploy

```bash
docker compose -f docker-compose.vps.yml --env-file .env.production up -d --build
```

Or use the deploy script (recommended — it also backs up and health-checks):

```bash
./scripts/deploy.sh
```

Deploy script flags:

| Flag | Effect |
|---|---|
| `--skip-backup` | Skip pre-deploy mongodump |
| `--skip-frontend` | Rebuild and restart backend only |
| `--skip-backend` | Rebuild and restart frontend only |

### Step 5 — Verify

```bash
curl http://127.0.0.1:18080/health
```

A healthy response looks like:

```json
{
  "status": "ok",
  "timestamp": "2026-04-07T00:00:00.000Z",
  "uptime": 120,
  "services": { "mongodb": "ok", "redis": "ok", "meilisearch": "ok" }
}
```

### Step 6 — Optional: seed initial data

```bash
docker compose -f docker-compose.vps.yml --env-file .env.production exec backend node dist/scripts/seed.js
```

### Standalone VPS (owns public ports 80 / 443)

If the inventory stack is the only project on a dedicated VPS:

1. Set `NGINX_BIND_IP=0.0.0.0` and `NGINX_HTTP_PORT=80` in `.env.production`.
2. Change the Nginx mount in `docker-compose.yml` to use `nginx/nginx.conf`.
3. Mount TLS certificates into `nginx/ssl/` and reference them from `nginx/nginx.conf`.

---

## Self-Hosted Deployment

Self-hosted mode packages the entire stack (Nginx, backend, frontend, MongoDB, Redis, and optionally MeiliSearch) into a single `docker-compose.selfhosted.yml`. No external reverse proxy is needed — Nginx in the stack serves directly on the host port (default `80`).

### Prerequisites

- Any Linux server or VM with Docker Engine + Compose plugin
- Ports `80` (or a custom port) open

### Step 1 — Copy env file

```bash
cp .env.selfhosted.example .env
nano .env
```

Minimum values:

```env
# App
GHCR_NAMESPACE=your-github-username-or-org
APP_VERSION=latest

# MongoDB
MONGO_ROOT_PASSWORD=<strong-password>
MONGO_APP_PASSWORD=<strong-password>

# Redis
REDIS_PASSWORD=<strong-password>

# MeiliSearch (only needed if using the search profile)
MEILISEARCH_KEY=changeme

# JWT
JWT_ACCESS_SECRET=<64-byte-hex>
JWT_REFRESH_SECRET=<64-byte-hex>

# URLs — use http:// if no TLS, or your domain with https://
FRONTEND_URL=http://YOUR_SERVER_IP
SOCKET_CORS_ORIGIN=http://YOUR_SERVER_IP
MONGODB_URL=mongodb://inventory_app:<MONGO_APP_PASSWORD>@mongodb:27017/inventory?authSource=inventory
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# Host port the app will bind to (default is 80)
HOST_PORT=80
```

### Step 2 — Start the stack

```bash
docker compose -f docker-compose.selfhosted.yml up -d
```

### Step 3 — Optional: enable MeiliSearch (full-text search)

MeiliSearch is optional in self-hosted mode. Enable it with the `search` profile:

```bash
docker compose -f docker-compose.selfhosted.yml --profile search up -d
```

Without it the app falls back to MongoDB text-index search.

### Step 4 — Verify

```bash
curl http://localhost/health
# or if using a custom port:
curl http://localhost:YOUR_PORT/health
```

### Step 5 — Seed initial data

```bash
docker compose -f docker-compose.selfhosted.yml exec backend node dist/scripts/seed.js
```

### Accessing the app

Open `http://YOUR_SERVER_IP` (or your domain) in a browser.

On first load the onboarding wizard runs automatically to guide you through:

1. Organisation name and slug
2. Currency, timezone, and measurement unit
3. First warehouse
4. Initial categories

---

## Roles & Permissions

The system uses a flat RBAC model. Each user has one role per tenant.

| Permission | Owner | Manager | Staff | Viewer |
|---|:---:|:---:|:---:|:---:|
| `dashboard.view` | ✓ | ✓ | ✓ | ✓ |
| `product.view` | ✓ | ✓ | ✓ | ✓ |
| `product.create` | ✓ | ✓ | — | — |
| `product.update` | ✓ | ✓ | — | — |
| `product.delete` | ✓ | — | — | — |
| `stock.view` | ✓ | ✓ | ✓ | ✓ |
| `stock.adjust` | ✓ | ✓ | ✓ | — |
| `stock.transfer` | ✓ | ✓ | ✓ | — |
| `warehouse.view` | ✓ | ✓ | ✓ | ✓ |
| `warehouse.manage` | ✓ | ✓ | — | — |
| `category.view` | ✓ | ✓ | ✓ | ✓ |
| `category.manage` | ✓ | ✓ | — | — |
| `alert.view` | ✓ | ✓ | ✓ | — |
| `alert.acknowledge` | ✓ | ✓ | — | — |
| `report.view` | ✓ | ✓ | — | — |
| `report.export` | ✓ | — | — | — |
| `user.view` | ✓ | — | — | — |
| `user.invite` | ✓ | — | — | — |
| `user.update` | ✓ | — | — | — |
| `user.deactivate` | ✓ | — | — | — |
| `settings.view` | ✓ | ✓ | — | — |
| `settings.manage` | ✓ | — | — | — |
| `audit.view` | ✓ | — | — | — |

---

## Background Jobs & Queues

All async work runs through BullMQ backed by Redis. Workers are started alongside the Express server.

| Queue | Trigger | What it does |
|---|---|---|
| `stock-alert` | Stock movement | Evaluates product stock vs threshold, creates or resolves alerts |
| `alert-check` | Scheduled (cron) | Periodic sweep to catch any alerts missed by event-driven checks |
| `search-sync` | Product / category create/update/delete | Upserts or removes documents in MeiliSearch index |
| `dashboard-stats` | Stock movement, product change | Recomputes and caches KPI aggregates in Redis |
| `dashboard-scheduler` | Cron | Schedules periodic dashboard cache refresh |
| `csv-import` | User uploads CSV | Parses rows, validates, bulk-inserts products; streams progress via Socket.IO |
| `email-notifications` | Alerts, invites, password resets | Sends transactional emails via Resend |
| `email-scheduler` | Cron | Sends daily low-stock digest emails to tenants with the setting enabled |

---

## API Overview

All endpoints are prefixed `/api`. Authentication uses `Authorization: Bearer <access_token>` (or an `accessToken` HTTP-only cookie). Every protected route also goes through the tenant resolver.

| Prefix | Module |
|---|---|
| `/api/auth` | Register, login, token refresh, logout, email verify, password reset |
| `/api/products` | CRUD, image upload, search |
| `/api/categories` | CRUD, hierarchy |
| `/api/warehouses` | CRUD, per-warehouse stock |
| `/api/stock` | Adjustments, transfers, movement history |
| `/api/alerts` | List alerts, acknowledge |
| `/api/users` | List, invite, update role, deactivate |
| `/api/dashboard` | Aggregated stats |
| `/api/reports` | Reports and CSV export |
| `/api/import` | Upload CSV, poll job status |
| `/api/audit` | Audit log listing |
| `/api/settings` | Tenant settings and custom fields |
| `/api/onboarding` | Onboarding wizard step progression |
| `/health` | Service health check (no auth) |

---

## Scripts Reference

### Backend npm scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start backend with hot-reload (`ts-node-dev`) |
| `build` | `npm run build` | Compile TypeScript to `dist/` |
| `start` | `npm start` | Run compiled production build |
| `seed` | `npm run seed` | Seed demo tenant, users, products (idempotent) |
| `seed:fresh` | `npm run seed:fresh` | Drop all existing data then seed |
| `seed:bulk` | `npm run seed:bulk` | Seed large dataset for performance testing |
| `validate-seed` | `npm run validate-seed` | Assert seed data is consistent without modifying anything |
| `lint` | `npm run lint` | Run ESLint |

### Frontend npm scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start Vite dev server with HMR |
| `build` | `npm run build` | Type-check + Vite production build to `dist/` |
| `preview` | `npm run preview` | Serve the `dist/` folder locally to preview production build |

### Shell scripts (`scripts/`)

| Script | Usage | Description |
|---|---|---|
| `deploy.sh` | `./scripts/deploy.sh [flags]` | Full deploy pipeline: pull → backup → build → restart → health-check |
| `backup.sh` | `./scripts/backup.sh [label]` | `mongodump` to a timestamped `.gz` archive |
| `rollback.sh` | `./scripts/rollback.sh` | Re-tag and restart previous Docker image versions |
| `health-check.sh` | `./scripts/health-check.sh` | Curl `/health` and exit non-zero if not healthy |

---

## Docker Images

Both images use multi-stage Dockerfiles for minimal production layers.

### Backend image

1. **builder** stage — installs all deps (including dev), compiles TypeScript, then prunes dev deps.
2. **production** stage — copies only `dist/`, `node_modules/`, and `package.json`. Runs as non-root user `nodejs` (UID 1001).

Built-in Docker health check polls `GET /health` every 30 s.

### Frontend image

1. **builder** stage — installs deps and runs `vite build`. `VITE_*` build args are injected at this stage.
2. **production** stage — copies compiled `dist/` into an `nginx:alpine` image with the SPA `try_files` config.

Built-in health check polls `GET /health` served by the Nginx static server.

### Publishing images (GitHub Actions / manual)

```bash
# Log in to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Build and push backend
docker build -t ghcr.io/YOUR_ORG/inventory-backend:latest ./backend
docker push ghcr.io/YOUR_ORG/inventory-backend:latest

# Build and push frontend (inject your URLs)
docker build \
  --build-arg VITE_API_URL=https://apistock.example.com/api \
  --build-arg VITE_SOCKET_URL=https://apistock.example.com \
  --build-arg VITE_DEPLOYMENT_MODE=saas \
  -t ghcr.io/YOUR_ORG/inventory-frontend:latest \
  ./frontend
docker push ghcr.io/YOUR_ORG/inventory-frontend:latest
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
