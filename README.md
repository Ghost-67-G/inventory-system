# Inventory Management SaaS

This monorepo provides an initial scaffold for a multi-tenant inventory management platform.

## Deployment Modes

- `saas`: Shared deployment with tenant-scoped data
- `self_hosted`: Single tenant per deployment

Both backend and frontend read deployment mode from environment variables.

## Repository Structure

- `backend`: Express + TypeScript + MongoDB + Redis + Socket.io + BullMQ
- `frontend`: React + Vite + TypeScript + Tailwind + Zustand + TanStack Query/Table

## Local Development

1. Start dependencies:

```bash
docker compose -f docker-compose.dev.yml up -d
```

2. Configure env files:

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

4. Install and run frontend:

```bash
cd frontend
npm install
npm run dev
```

## Notes

- Billing and payments are intentionally excluded.
- Refresh tokens are stored hashed in MongoDB and sent as httpOnly cookies.
- All service functions are tenant-scoped and receive `tenantId` as the first argument.
