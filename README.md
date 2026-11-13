# Inventory Management System

A full-stack, multi-tenant inventory management platform built with Node.js, React 19, MongoDB, Redis, and MeiliSearch.

Live: [stock.codingstack.site](https://stock.codingstack.site) · API: [apistock.codingstack.site](https://apistock.codingstack.site/health)

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Local Development](#local-development)
6. [Environment Variables](#environment-variables)
7. [Deployment (VPS)](#deployment-vps)
8. [Roles & Permissions](#roles--permissions)
9. [Background Jobs & Queues](#background-jobs--queues)
10. [API Overview](#api-overview)
11. [Scripts Reference](#scripts-reference)
12. [Docker Images](#docker-images)
13. [Security Notes](#security-notes)

---

## Features

| Area | What it does |
|---|---|
| **Multi-tenancy** | Every resource (products, warehouses, users, alerts) is scoped to a tenant. Each organisation is fully isolated. |
| **Product Catalogue** | Products with SKU, description, category, cost/selling price, custom fields, and images. |
| **Warehouse Management** | Multiple warehouses per tenant with per-warehouse stock levels and low-stock thresholds. |
| **Stock Movements** | Adjustments, transfers between warehouses, and returns with a full audit trail. |
| **Suppliers & Purchase Orders** | Manage suppliers; create, send, receive (fully or partially), and cancel purchase orders. Receiving books stock into a warehouse. |
| **Low-Stock Alerts** | Configurable thresholds. BullMQ workers evaluate them after every movement and send email or in-app notifications. |
| **Real-Time Updates** | Socket.IO pushes live stock and alert changes to every connected tab. |
| **Full-Text Search** | MeiliSearch indexes products and categories for instant, typo-tolerant search. |
| **CSV Import** | Bulk-import products via CSV. Jobs run asynchronously; progress streams to the UI via Socket.IO. |
| **Reports & Analytics** | Stock valuation, movement history, waste/adjustments, and low-stock reports — all exportable. |
| **Dashboard** | KPI cards (total products, stock value, active alerts, recent movements) computed and cached by background workers. |
| **User Management** | Invite users by email, assign roles (owner / manager / staff / viewer), deactivate accounts. |
| **Audit Log** | Immutable log of every create / update / delete with actor, timestamp, and diff. |
| **Email Notifications** | Transactional emails (invite, password reset, low-stock digest) via Resend. |
| **Onboarding Wizard** | First-run wizard for organisation settings, warehouses, and categories. |
| **Tenant Settings** | Currency, timezone, measurement unit, date format, notification preferences, and custom product fields. |
| **Security** | Helmet, CORS, rate limiting, XSS cleaning, Mongo sanitisation, JWT access + refresh rotation, bcrypt hashing. |

The backend also supports a single-tenant mode (`DEPLOYMENT_MODE=self_hosted`); the production stack in this repo runs `saas`.

---

## Architecture

```
Browser (React 19 SPA)
        │  HTTPS / WebSocket
        ▼
 Coolify Traefik proxy (TLS)
        │
   ┌────┴────────────────────────────────────┐
   │  Backend  (Node.js / Express / TS)      │
   │  ┌─────────────┐  ┌──────────────────┐  │
   │  │  REST API   │  │ Socket.IO server │  │
   │  └──────┬──────┘  └────────┬─────────┘  │
   │  ┌──────▼──────────────────▼─────────┐  │
   │  │      BullMQ workers (8 queues)    │  │
   │  └──────┬────────────────────────────┘  │
   └─────────┼───────────────────────────────┘
             │
    ┌────────┼────────────────────┐
    ▼        ▼                    ▼
 MongoDB   Redis              MeiliSearch
 (replica  (queues, cache,    (full-text
  set)      sessions)          search)
```

MongoDB must run as a **replica set** — stock movements and purchase-order receiving use transactions.

---

## Tech Stack

### Backend

| Package | Purpose |
|---|---|
| **Node.js 20** | Runtime |
| **Express 4** | HTTP framework |
| **TypeScript 5** | Type safety |
| **Mongoose 8** | MongoDB ODM |
| **BullMQ 5** | Background job queues (Redis-backed) |
| **Socket.IO 4** | Real-time communication |
| **ioredis 5** | Redis client |
| **MeiliSearch SDK** | Full-text search |
| **Zod 3** | Validation for env vars and request bodies |
| **jsonwebtoken** | JWT access + refresh tokens |
| **bcryptjs** | Password hashing |
| **Helmet / express-rate-limit / express-mongo-sanitize / xss-clean** | Hardening |
| **multer + csv-parse** | CSV uploads and parsing |
| **Resend** | Transactional email |
| **Winston** | Structured logging |
| **Luxon** | Date/time utilities |

### Frontend

| Package | Purpose |
|---|---|
| **React 19 + Vite 7 + TypeScript 5** | UI, build tool, types |
| **Tailwind CSS 4 + shadcn/ui (Radix)** | Styling and accessible primitives |
| **TanStack Query 5 / Table 8 / Virtual 3** | Server state, tables, virtualised lists |
| **React Router 7** | Routing |
| **Zustand 5** | Client state (auth, UI) |
| **React Hook Form 7 + Zod** | Forms and validation |
| **Recharts 2** | Charts |
| **Socket.IO Client 4 + Axios** | Real-time + HTTP |
| **dnd kit, date-fns 4, Lucide, Sonner** | Drag-and-drop, dates, icons, toasts |

### Services

| Service | Version | Role |
|---|---|---|
| **MongoDB** | 7 | Primary data store (replica set) |
| **Redis** | 7 | BullMQ queues, dashboard cache, tenant cache, sessions |
| **MeiliSearch** | v1.7 | Product/category search index |
| **Docker Compose** | — | Runs the production stack |
| **Coolify (Traefik)** | — | Reverse proxy + Let's Encrypt TLS on the VPS |

---

## Project Structure

```
inventory-system/
├── backend/                  # Node.js / Express API
│   ├── src/
│   │   ├── app.ts            # Express app, middleware, routes, /health
│   │   ├── server.ts         # HTTP + Socket.IO bootstrap
│   │   ├── config/           # Zod-validated env, DB, Redis, MeiliSearch, Socket
│   │   ├── middleware/       # auth, rbac, tenant resolver, validation, errors
│   │   ├── models/           # Mongoose schemas
│   │   ├── modules/          # Feature modules (routes, controller, service, schema):
│   │   │                     #   auth, products, categories, warehouses, stock, alerts,
│   │   │                     #   suppliers, purchase-orders, users, dashboard, reports,
│   │   │                     #   import, audit, settings, onboarding
│   │   ├── queues/           # BullMQ queues, job types, workers
│   │   ├── utils/            # ApiError, catchAsync, paginate, jwt, email, logger, …
│   │   └── types/            # Roles, permissions, Express augmentation
│   ├── scripts/              # seed, seed-bulk, validate-seed + seed data
│   └── Dockerfile            # builder → production (non-root)
│
├── frontend/                 # React 19 SPA
│   ├── src/                  # api, components, hooks, pages, layouts, store, router, …
│   ├── nginx/spa.conf        # Nginx config inside the frontend image
│   └── Dockerfile            # builder (Vite) → production (Nginx)
│
├── docker/redis.conf         # Redis persistence/memory settings
├── scripts/
│   ├── deploy.sh             # pull → backup → build → start → wait for healthy
│   └── backup.sh             # mongodump to backups/
├── .github/workflows/ci.yml  # Typecheck, lint, build on push
├── docker-compose.yml        # Production stack (VPS)
└── .env.example              # Production config template → copy to .env
```

---

## Local Development

**Prerequisites:** Node.js 20+, npm 10+, Docker.

### 1. Start MongoDB, Redis, and MeiliSearch

```bash
docker run -d --name inventory-dev-mongo -p 27017:27017 mongo:7 --replSet rs0 --bind_ip_all
sleep 5 && docker exec inventory-dev-mongo mongosh --quiet --eval 'rs.initiate()'

docker run -d --name inventory-dev-redis -p 6379:6379 redis:7-alpine
docker run -d --name inventory-dev-meili -p 7700:7700 -e MEILI_MASTER_KEY=changeme_meili getmeili/meilisearch:v1.7
```

Next time, just `docker start inventory-dev-mongo inventory-dev-redis inventory-dev-meili`.

### 2. Create env files

```bash
cp backend/.env.example backend/.env.development
cp frontend/.env.example frontend/.env.development
```

The defaults work with the containers above (`npm run dev` in the backend loads `.env.development`).

### 3. Run the backend and frontend

```bash
cd backend && npm install && npm run dev     # http://localhost:3000
cd frontend && npm install && npm run dev    # http://localhost:5173
```

### 4. Seed demo data

```bash
cd backend
npm run seed          # demo tenants, users, warehouses, products (idempotent)
npm run seed:fresh    # drop everything first
npm run seed:bulk     # large dataset for performance testing
```

Seeded logins (local only) include `owner@apex.dev`, `manager@apex.dev`, `staff@apex.dev`, `viewer@apex.dev` — password `Password123`. See [backend/scripts/data/tenants.ts](backend/scripts/data/tenants.ts).

---

## Environment Variables

### Backend

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development`, `test`, or `production` (set by compose in prod) |
| `PORT` | No | `3000` | HTTP port |
| `DEPLOYMENT_MODE` | No | `saas` | `saas` or `self_hosted` (set by compose in prod) |
| `MONGODB_URL` | Yes | — | MongoDB connection string (must point at a replica set) |
| `JWT_ACCESS_SECRET` | Yes | — | Access-token signing secret |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh-token signing secret (different from access) |
| `JWT_ACCESS_EXPIRATION_MINUTES` | No | `30` | Access token lifetime |
| `JWT_REFRESH_EXPIRATION_DAYS` | No | `30` | Refresh token lifetime |
| `REDIS_URL` | Yes | — | e.g. `redis://:password@host:6379` (built from `REDIS_PASSWORD` by compose in prod) |
| `MEILISEARCH_URL` | Yes | — | MeiliSearch URL (set by compose in prod) |
| `MEILISEARCH_KEY` | No | `""` | MeiliSearch master key |
| `RESEND_API_KEY` | No | — | Resend API key for email |
| `EMAIL_FROM` | No | `noreply@example.com` | Sender address |
| `FRONTEND_URL` | Yes | — | Public frontend URL (CORS) |
| `SOCKET_CORS_ORIGIN` | Yes | — | Allowed Socket.IO origin (usually `FRONTEND_URL`) |

### Frontend (build-time)

| Variable | Description |
|---|---|
| `VITE_API_URL` | REST base URL, e.g. `https://apistock.codingstack.site/api` |
| `VITE_SOCKET_URL` | Socket.IO URL, e.g. `https://apistock.codingstack.site` |
| `VITE_DEPLOYMENT_MODE` | `saas` or `self_hosted` |

Vite bakes these into the bundle — changing them requires a rebuild.

### Production `.env`

The VPS uses a single root `.env` (template: [.env.example](.env.example)). It holds only what can't be derived: public URLs, `MONGODB_URL`, `REDIS_PASSWORD`, `MEILISEARCH_KEY`, JWT secrets, and Resend settings. Generate secrets with `openssl rand -hex 32`.

---

## Deployment (VPS)

Production is one `docker-compose.yml` on a VPS that also hosts other projects.

```
                         Internet  (80 / 443)
                               │
                  Coolify Traefik proxy — TLS
               ┌───────────────┴────────────────┐
     stock.codingstack.site          apistock.codingstack.site
               │                                │
     inventory-frontend:80          inventory-backend:3000 ──► mongodb:27017
                                                │              (shared, `shared_db` network)
                                                ▼
                              inventory-redis · inventory-meilisearch
                                  (private `inventory_net` network)
```

The stack publishes **no host ports**. The proxy reaches the app over the `coolify` network; the backend reaches MongoDB over `shared_db`.

### One-time host setup

Skip whatever already exists on the server.

1. **Docker + Compose plugin:** `curl -fsSL https://get.docker.com | sh`

2. **Coolify** (provides the proxy and the `coolify` network): `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash`

3. **Shared MongoDB:** a `mongo:7` replica set (`rs0`) in a container named `mongodb`, attached to an external `shared_db` network (`docker network create shared_db`). It lives outside this repo (`~/infra` on the current VPS). Create the app user once:

   ```bash
   docker exec -it mongodb mongosh -u admin -p --authenticationDatabase admin --eval '
     db.getSiblingDB("inventory").createUser({
       user: "inventory_app",
       pwd: "<app-password>",
       roles: [{ role: "readWrite", db: "inventory" }, { role: "dbAdmin", db: "inventory" }]
     })'
   ```

4. **DNS:** `A` records for `stock.codingstack.site` and `apistock.codingstack.site` → VPS IP.

5. **Proxy routes:** add `/data/coolify/proxy/dynamic/inventory.yaml` (Traefik hot-reloads it):

   ```yaml
   http:
     middlewares:
       inventory-https:
         redirectScheme: { scheme: https, permanent: true }
       inventory-body-10m:
         buffering: { maxRequestBodyBytes: 10485760 }   # CSV uploads
     routers:
       inventory-fe:
         rule: Host(`stock.codingstack.site`)
         entryPoints: [https]
         service: inventory-fe
         tls: { certResolver: letsencrypt }
       inventory-fe-http:
         rule: Host(`stock.codingstack.site`)
         entryPoints: [http]
         middlewares: [inventory-https]
         service: inventory-fe
       inventory-be:
         rule: Host(`apistock.codingstack.site`)
         entryPoints: [https]
         middlewares: [inventory-body-10m]
         service: inventory-be
         tls: { certResolver: letsencrypt }
       inventory-be-http:
         rule: Host(`apistock.codingstack.site`)
         entryPoints: [http]
         middlewares: [inventory-https]
         service: inventory-be
     services:
       inventory-fe:
         loadBalancer: { servers: [{ url: "http://inventory-frontend:80" }] }
       inventory-be:
         loadBalancer: { servers: [{ url: "http://inventory-backend:3000" }] }
   ```

   On the current VPS these routes already live in `legacy-apps.yaml` — don't define them twice.

### First deploy

```bash
git clone https://github.com/Ghost-67-G/inventory-system.git ~/inventory/inventory-system
cd ~/inventory/inventory-system

cp .env.example .env
nano .env          # fill in every CHANGE_ME; MONGODB_URL password = the app user above

docker compose up -d --build --wait
curl https://apistock.codingstack.site/health
```

A healthy response:

```json
{ "status": "ok", "services": { "mongodb": "ok", "redis": "ok", "meilisearch": "ok" } }
```

### Updating

```bash
cd ~/inventory/inventory-system
./scripts/deploy.sh                # git pull → backup → build → start → wait for healthy
./scripts/deploy.sh --skip-backup  # same, without the pre-deploy dump
```

### Day-to-day commands

| Task | Command |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f backend` |
| Restart one service | `docker compose restart backend` |
| Apply `.env` changes | `docker compose up -d` (add `--build` if a `VITE_*` value changed) |
| Back up MongoDB | `./scripts/backup.sh [label]` → `backups/inventory_<time>_<label>.archive.gz` |
| Restore a backup | `docker exec -i mongodb mongorestore --uri="<MONGODB_URL>" --archive --gzip --drop < backups/<file>` |

---

## Roles & Permissions

Each user has one role per tenant (source of truth: [backend/src/types/index.ts](backend/src/types/index.ts)).

| Permission | Owner | Manager | Staff | Viewer |
|---|:---:|:---:|:---:|:---:|
| `dashboard.view` | ✓ | ✓ | — | — |
| `product.view` | ✓ | ✓ | ✓ | ✓ |
| `product.create` / `product.update` | ✓ | ✓ | — | — |
| `product.delete` | ✓ | — | — | — |
| `stock.view` | ✓ | ✓ | ✓ | ✓ |
| `stock.adjust` / `stock.transfer` | ✓ | ✓ | ✓ | — |
| `warehouse.view` | ✓ | ✓ | ✓ | ✓ |
| `warehouse.manage` | ✓ | ✓ | — | — |
| `category.view` | ✓ | ✓ | ✓ | ✓ |
| `category.manage` | ✓ | ✓ | — | — |
| `alert.view` | ✓ | ✓ | ✓ | ✓ |
| `alert.acknowledge` | ✓ | ✓ | ✓ | — |
| `supplier.view` | ✓ | ✓ | ✓ | ✓ |
| `supplier.manage` | ✓ | ✓ | — | — |
| `po.view` | ✓ | ✓ | ✓ | ✓ |
| `po.create` / `po.update` | ✓ | ✓ | — | — |
| `po.receive` | ✓ | ✓ | ✓ | — |
| `report.view` | ✓ | ✓ | — | — |
| `report.export` | ✓ | — | — | — |
| `user.view` / `invite` / `update` / `deactivate` | ✓ | — | — | — |
| `settings.view` | ✓ | ✓ | — | — |
| `settings.manage` | ✓ | — | — | — |
| `audit.view` | ✓ | — | — | — |

---

## Background Jobs & Queues

All async work runs through BullMQ on Redis. Workers start alongside the Express server.

| Queue | Trigger | What it does |
|---|---|---|
| `stock-alert` | Stock movement | Compares stock to threshold; creates or resolves alerts |
| `alert-check` | Cron | Periodic sweep for alerts missed by event-driven checks |
| `search-sync` | Product / category change | Upserts or removes MeiliSearch documents |
| `dashboard-stats` | Stock / product change | Recomputes and caches KPI aggregates |
| `dashboard-scheduler` | Cron | Schedules periodic dashboard refresh |
| `csv-import` | CSV upload | Parses, validates, bulk-inserts; streams progress via Socket.IO |
| `email-notifications` | Alerts, invites, resets | Sends email via Resend |
| `email-scheduler` | Cron | Daily low-stock digest for tenants that opted in |

---

## API Overview

All endpoints are under `/api`. Auth uses `Authorization: Bearer <access_token>` (or an `accessToken` HTTP-only cookie); protected routes also go through the tenant resolver.

| Prefix | Module |
|---|---|
| `/api/auth` | Register, login, refresh, logout, email verify, password reset |
| `/api/products` | CRUD, image upload, search |
| `/api/categories` | CRUD, hierarchy |
| `/api/warehouses` | CRUD, per-warehouse stock |
| `/api/stock` | Adjustments, transfers, movement history |
| `/api/alerts` | List, acknowledge |
| `/api/suppliers` | Supplier CRUD |
| `/api/purchase-orders` | Create, update, send, receive, cancel, stats |
| `/api/users` | List, invite, update role, deactivate |
| `/api/dashboard` | Aggregated stats |
| `/api/reports` | Reports and CSV export |
| `/api/import` | CSV upload, job status |
| `/api/audit` | Audit log |
| `/api/settings` | Tenant settings, custom fields |
| `/api/onboarding` | Onboarding wizard |
| `/health` | Health check, no auth (503 if MongoDB or Redis is down) |

---

## Scripts Reference

### Backend (`cd backend`)

| Script | Description |
|---|---|
| `npm run dev` | Hot-reload dev server (loads `.env.development`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run seed` / `seed:fresh` / `seed:bulk` | Seed demo data (fresh = drop first; bulk = large dataset) |
| `npm run validate-seed` | Check seed consistency without writing |
| `npm run lint` | ESLint |

### Frontend (`cd frontend`)

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Serve the production build locally |

### Server (`scripts/`)

| Script | Description |
|---|---|
| `./scripts/deploy.sh [--skip-backup]` | Pull, back up, rebuild, restart, and wait until every container is healthy |
| `./scripts/backup.sh [label]` | `mongodump` the `inventory` DB from the shared `mongodb` container; keeps 30 days |

---

## Docker Images

Both images are built on the VPS by `docker compose` from multi-stage Dockerfiles.

- **Backend** — `builder` installs deps, compiles TypeScript, prunes dev deps; `production` copies `dist/`, `node_modules/`, `package.json` and runs as non-root `nodejs` (UID 1001). Health check: `GET /health`.
- **Frontend** — `builder` runs `vite build` with the `VITE_*` build args; `production` serves `dist/` from `nginx:alpine` using [frontend/nginx/spa.conf](frontend/nginx/spa.conf). Health check: `GET /health`.

---

## Security Notes

- **Secrets live only in `.env` on the server.** `.env`, `.env.*`, `*.pem`, and `*.key` are gitignored; only `*.example` templates are committed.
- No host ports are published. Frontend and backend are reachable only through the proxy network; Redis and MeiliSearch only on the private `inventory_net`.
- The backend connects to MongoDB as a least-privilege user (`readWrite` + `dbAdmin` on `inventory` only).
- TLS is terminated by Coolify's Traefik with Let's Encrypt certificates — no certificates are stored in this repo.
