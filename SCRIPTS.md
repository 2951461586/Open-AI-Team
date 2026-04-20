# Scripts Guide

This repository uses the root `package.json` as the operator entry surface.

## Quick Start

```bash
# Default commands
npm install
cp .env.example .env
npm start
# Access http://localhost:19090
```

## API Endpoints

All API endpoints use the `/api/v1/` prefix:

```
POST /api/v1/team/chat          — Create conversation
POST /api/v1/team/chat/task     — Task conversation
GET  /api/v1/state/team         — Team overview
GET  /api/v1/state/team/summary — Task summary
POST /api/v1/team/tasks/:id/control — Task control
GET  /health                    — Health check
POST /mcp                       — MCP JSON-RPC
```

## Smoke Tests

```bash
npm run smoke:team
npm run smoke:oss-minimal
npm run smoke:team:batch
```

## Safety & Release Checks

```bash
npm run audit:repo-hygiene
npm run audit:repo-boundary
npm run smoke:public-schemas
npm run smoke:dashboard-public-contract
npm run smoke:release-engineering
```

## Build and Packaging

```bash
npm run build
npm run dashboard:build
npm run release:stage-artifacts -- public-contracts source-docs dashboard oss-minimal third-party
```

## Authority Rules

- `npm start` -> `apps/api-server/src/index.mjs`
- `dashboard/` is the current UI authority
- package-owned logic should run from `packages/*`
- legacy routes under `src/routes/` return 410 and redirect to `/api/v1/`

## Legacy Route Retirement

The following legacy routes have been retired and return 410 Gone:

| Legacy Path | New Path |
|-------------|----------|
| `/state/team` | `/api/v1/state/team` |
| `/state/*` | `/api/v1/state/*` |
| `/internal/team/task` | `/api/v1/internal/team/task` |
| `/internal/team/ingress` | `/api/v1/team/chat` |
| `/internal/debate/*` | `/api/v1/team/chat (TL-driven)` |
| `/roles` | `/api/v1/team/config/roles` |
| `/api/personal` | Retired — use `/api/v1/team/chat` |
| `/desks/*` | `/api/v1/state/team/workbench` |
