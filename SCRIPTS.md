# Scripts Guide

This repository uses the root `package.json` as the operator entry surface.

## Default commands

### Main product
```bash
npm install
cp .env.example .env
npm run smoke:team
npm start
```

### Agent harness baseline
```bash
npm install
npm run demo:oss-minimal
npm run doctor:oss-minimal
```

### Third-party agent onboarding
```bash
npm install
npm run validate:third-party-agent
npm run smoke:third-party-agent
```

## Repo safety / release checks

```bash
npm run audit:repo-hygiene
npm run audit:repo-boundary
npm run smoke:public-schemas
npm run smoke:dashboard-public-contract
npm run smoke:release-engineering
```

## Build and packaging

```bash
npm run build
npm run dashboard:build
npm run release:stage-artifacts -- public-contracts source-docs dashboard oss-minimal third-party
```

## Authority rules for scripts

- `npm start` -> `apps/api-server/src/index.mjs`
- `dashboard/` is the current UI authority
- `apps/dashboard/` is secondary packaging surface
- package-owned logic should run from `packages/*`
- compatibility paths under `src/*` should not become the default place for new operator flows

## Notes

- This file documents current runnable commands.
- Historical migration plans and phase notes belong under `docs/archive/` and are not the default operator reading path.
