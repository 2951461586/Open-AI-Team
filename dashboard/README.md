# Dashboard

Next.js web UI for the AI Team Runtime. Shows tasks, agents, workbench, and timeline.

> Repository note: `dashboard/` is the **current primary dashboard product authority**.
> `apps/dashboard/` is still a transition/app-packaging surface and should not be treated as the canonical UI implementation authority yet.
> Optional plugin/service/electron/project surfaces elsewhere in the repo are not part of this dashboard's mainline onboarding path.

## Quick Start

```bash
cd dashboard
npm install
cp .env.example .env.local
npm run dev     # http://localhost:3000
```

Set `NEXT_PUBLIC_API_BASE=http://127.0.0.1:19090` to connect to a local orchestrator.

## Key Files

| Path | What |
|---|---|
| `src/components/panels/WorkbenchPanel.tsx` | Task workbench / delivery view |
| `src/components/panels/MissionControlPanel.tsx` | Mission control overview |
| `src/components/panels/ArtifactsPanel.tsx` | Deliverables and evidence |
| `src/components/panels/TimelinePanel.tsx` | Event timeline |
| `src/components/TaskCard.tsx` | Individual task card |
| `src/components/NodesView.tsx` | Node status view |
| `src/lib/api.ts` | API client |
| `src/lib/types.ts` | TypeScript types |
| `src/lib/store.ts` | State management |

## API Contracts

The dashboard consumes these orchestrator endpoints:

## Public Contract Routes

All dashboard API endpoints consumed by the frontend:

- `/state/team/dashboard` — task list / board view
- `/state/team/workbench` — workbench details
- `/state/team/pipeline` — pipeline state
- `/state/team/residents` — active residents
- `/state/team/nodes` — node health
- `/state/team/control` — control-plane actions
- `/state/team/threads` — thread list
- `/state/team/thread-summary` — per-thread summary
- `/state/team/timeline` — event timeline
- `/state/team/artifacts` — artifact listing
- `/state/team/evidence` — evidence/review items

## Build & Deploy

The dashboard follows **single-repo build authority**: only deployed from this source tree after a fresh build (`cd dashboard && npm run build`). No pre-built or cross-repo static exports.

**Current build boundary**: dashboard source lives at `dashboard/` within this mono-repo. Run `npm run dashboard:build` from repo root, or `npm run build` inside `dashboard/`.

Deploy rules: see [docs/deploy/dashboard-source-authority.md](../../docs/deploy/dashboard-source-authority.md)

## Development

```bash
npm run build:css    # rebuild Tailwind
npm run scan:bundle  # analyze bundle size
```
