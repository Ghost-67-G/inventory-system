# Inventory System — Portfolio Entry

> **For the agent:** This file is a brief for adding the project below as an entry in my portfolio site. Use it to fill in the project card / detail page. Pull screenshots from the live URL if you need them. Don't invent features that aren't listed here.

---

## Headline

**Inventory System** — A multi-tenant SaaS inventory management platform for small warehouses and logistics teams.

## One-line pitch

A full-stack inventory platform that gives small teams real-time stock visibility across multiple warehouses — shipped as both a hosted SaaS and a single-tenant self-hosted Docker stack from the same codebase.

## Links

| | |
|---|---|
| Live demo | https://stock.devsdesk.site |
| API | https://apistock.devsdesk.site |
| Source | https://github.com/Ghost-67-G/inventory-system |

## Problem it solves

Small businesses managing stock across multiple warehouses lack affordable, modern tools for centralized inventory visibility, low-stock alerts, and audit trails. Most existing options are either enterprise-priced or stuck in spreadsheet territory. This project gives warehouse managers, inventory supervisors, and small logistics teams a real-time, role-scoped, multi-tenant alternative they can use as-is or self-host.

## Tech stack

**Frontend** — React 19 · Vite · TypeScript · Tailwind CSS 4 · shadcn/ui · TanStack Query / Table / Virtual · React Router 7 · Zustand · Socket.IO Client · Recharts · React Hook Form + Zod

**Backend** — Node.js 20 · Express · TypeScript · Mongoose 8 · BullMQ · Socket.IO · MeiliSearch SDK · JWT (with refresh-token rotation) · Helmet / rate-limit / mongo-sanitize / xss-clean

**Data** — MongoDB 7 (replica set, multi-doc transactions) · Redis 7 (sessions, BullMQ, cache) · MeiliSearch v1.7 (typo-tolerant search)

**Infra** — Docker · Docker Compose · Caddy (auto Let's Encrypt) · Oracle Cloud ARM64 VPS · shared-infra deployment pattern

## Key features

- Multi-warehouse stock tracking with movement history (adjustments, transfers, returns)
- Configurable low-stock alerts (email + in-app)
- Real-time updates over Socket.IO — stock changes propagate across all open tabs without refresh
- Typo-tolerant full-text search via MeiliSearch
- Bulk CSV import with live job-progress streaming (BullMQ + WebSocket progress)
- Dashboard with cached KPI cards (computed by background workers)
- Role-based access control: owner / manager / staff / viewer
- User invitations + email notifications (Resend)
- Immutable audit logs for all create/update/delete actions
- Per-tenant settings: currency, timezone, date format, custom fields

## Architecture highlights

- **Two deployment modes from one codebase.** A `DEPLOYMENT_MODE` flag switches between SaaS (shared infra, many tenants) and self-hosted (single tenant, single compose stack).
- **Tenant isolation** is enforced at both the DB layer (tenant-scoped collections) and the application layer (request middleware).
- **Replica-set MongoDB** enables ACID multi-document transactions for stock-movement operations that touch products, stock levels, and audit logs atomically.
- **Background workers** (8 BullMQ queues) handle KPI aggregation, search indexing, alert evaluation, email dispatch, and CSV imports — the request path stays fast.
- **Shared-infra hosting pattern.** Caddy and MongoDB are deployed once per VPS and shared across projects via external Docker networks (`shared_proxy`, `shared_db`); each project ships only its own Redis, MeiliSearch, and app containers.

## Status

Live and in active development. Currently hosted on a single ARM64 VPS with auto-renewing TLS.

## Tags / categories

`Full-Stack` · `SaaS` · `React` · `Node.js` · `TypeScript` · `MongoDB` · `Multi-Tenant` · `Real-Time` · `Docker`

## What I'd like on the portfolio site

- A project card (title, one-line pitch, tags, live link, repo link)
- A detail page with: headline, problem, features list, architecture highlights, tech stack, screenshots, and links
- Place this project under the **Full-stack / SaaS** section if categories exist
