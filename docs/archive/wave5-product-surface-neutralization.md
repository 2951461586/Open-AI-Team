# Wave 5: Product Surface Neutralization

> Status: ✅ Landed
> Date: 2026-04-05
> Covers: Dashboard UI label/asset neutralization + stale artifact cleanup

## Changes

### Dashboard UI — node labels & styling

| File | Change |
|---|---|
| `dashboard/src/app/page.tsx` | `{ laoda, violet, lebang }` → `{ 'node-a', 'node-b', 'node-c' }` labels |
| `dashboard/src/components/NodesView.tsx` | dotMap/avatarMap/ringMap/glowMap → canonical keys |
| `dashboard/src/components/TaskCard.tsx` | nodeBadgeStyles → canonical; stateDotColors `planning` → `accent` |
| `dashboard/src/components/ChatPanel.tsx` | nodeStyleMap → canonical keys |
| `dashboard/src/components/views/AgentsView.tsx` | avatarMap/dotMap/ringMap/labels → canonical keys |
| `dashboard/src/lib/utils.ts` | NODE_LABELS retained legacy compat keys with comment |

### Asset cleanup

| Path | Action |
|---|---|
| `dashboard/public/node-avatars/{laoda,violet,lebang}.png` | Removed (instance-specific) |
| `dashboard/out/` | Removed (stale build artifacts) |

### Retained (intentionally)

| Location | Reason |
|---|---|
| `dashboard/src/lib/utils.ts` NODE_LABELS legacy keys | API backward compat during transition |
| Top-level docs OpenClaw references | Document optional integration path, not hard coupling |
| `src/integrations/openclaw/` | Optional integration layer |
| `src/team/team-node-ids.mjs` canonical alias table | API boundary compatibility |

## Validation

- Zero `laoda/lebang` references in dashboard active UI code (aside from utils compat layer)
- Zero instance-specific avatar files tracked or published
- Mainline smoke: green
