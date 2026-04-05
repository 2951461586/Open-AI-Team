# Dashboard / UAT Frontend

This directory is the current frontend-facing product surface for the AI Team Runtime.

## Role

`dashboard/src/` is the UI / UAT layer aligned to the public Team Runtime contract surface under `/state/team/*`.

It should be understood as part of the **primary Team Runtime product surface**, not as a detached sample.

## Current scope

- workbench / task deep view
- node visibility and control-plane-neutral observability
- team console / task chat panels
- dashboard contract alignment with public read models

## Key files

- `src/app/page.tsx`
- `src/lib/types.ts`
- `src/lib/api.ts`
- `src/lib/utils.ts`
- `src/components/Header.tsx`
- `src/components/NodesView.tsx`
- `src/components/panels/TeamConsolePanel.tsx`
- `src/components/panels/TaskChatPanel.tsx`
- `src/components/panels/WorkbenchPanel.tsx`

## Contract alignment

The dashboard should consume the public query/runtime contract layer first:

- `/state/team/dashboard`
- `/state/team/summary`
- `/state/team/workbench`
- `/state/team/pipeline`
- `/state/team/control`
- `/state/team/residents`
- `/state/team/nodes`
- `/state/team/board`
- `/state/team/threads`
- `/state/team/thread-summary`

See:
- `../docs/architecture/dashboard-contract-alignment.md`
- `../docs/api/team-governance-query-api/README.md`

## Validation

```bash
node scripts/team/team-uat-observability-neutralization-smoke.mjs
```

## Current build boundary

Dashboard now has **single-repo build authority** inside this repository:
- `dashboard/src/`
- `dashboard/public/`
- `dashboard/scripts/`
- `dashboard/package.json`
- `dashboard/package-lock.json`

Rule for P7:
- public CI validates both dashboard contract alignment and repo-local app buildability
- `dashboard-build` is now a real GitHub CI lane, not a workspace-only workaround
- `npm run dashboard:build` is now a repo-local build authority entrypoint

### Repo-local running
```bash
cd /root/.openclaw/workspace/orchestrator/dashboard
npm ci
npm run build
npm run scan:bundle
```
