# Wave 3: Node Identity Neutralization & Default Leakage Cleanup

> Status: ✅ Landed
> Date: 2026-04-05
> Covers: Retirement Plan Phase B3 (node identity) + B4 (default leakage)

## Changes

### B3 — Parameter & variable names neutralized

**`src/team/team-node-health.mjs`**
- `lebangHost` → `reviewHost`
- `lebangWebhookPort` → `reviewWebhookPort`
- `lebangControlBaseUrl` → `reviewControlBaseUrl`
- `lebangControlToken` → `reviewControlToken`

**`src/team/team-node-health-core.mjs`**
- Removed `laoda/violet/lebang` keys from `reachabilityGraceMs` and `lastHealthyAt`
- Removed legacy alias writes in `resolveReachability()`

**`src/team-runtime-adapters/remote-session-control-plane.mjs`**
- `controls[selectedNode] || controls[DEFAULT_NODE_ID] || controls.laoda` → `... || null`
- Hardcoded `.laoda` fallback removed; missing control now returns explicit error

### B4 — Default value leakage neutralized

**`src/team/team-node-health.mjs`**
- `controlPlaneSystemdUnit = 'orchestrator.service'` → `controlPlaneSystemdUnit = ''`

**`src/team/team-node-health-probes.mjs`**
- `controlPlaneSystemdUnit = 'orchestrator.service'` → `controlPlaneSystemdUnit = ''`
- `orchestrator.service` fallback in systemd probe → `'control-plane'`

**`src/index-host-probe.mjs`**
- `DEFAULT_SERVICE_ENV_UNIT = 'orchestrator.service'` → `DEFAULT_SERVICE_ENV_UNIT = ''`

**`src/index-host-config-neutral.mjs`** + **`src/index-host-config-maintainer.mjs`**
- Removed redundant `nodes.laoda/violet/lebang` alias writes
- Canonical aliases are now handled exclusively by `withLegacyNodeAliases()` in `team-node-ids.mjs`

## What stayed (intentionally)

| Location | Reason |
|---|---|
| `src/team/team-node-ids.mjs` | Canonical alias table — required for backward compatibility at API boundary |
| `src/integrations/openclaw/host-bootstrap.mjs` | OpenClaw-specific integration layer — optional, owns its own legacy mapping |
| `config/team/network-ports.json` | Instance config — maintainer-owned, not product core |
| `config/team/network-ports.compat.json` | Instance config — maintainer-owned, not product core |

## Validation

- ✅ `scripts/smoke/team-mainline.mjs` — full pipeline green
- ✅ Zero `laoda/violet/lebang/orchestrator.service` references in `src/team/`, `src/team-runtime-adapters/`, `src/index-host-*.mjs` (excluding `node-ids.mjs` and `openclaw/`)

## Retirement Plan Status

| Phase | Status |
|---|---|
| B1 — Make OpenClaw explicitly optional | ✅ Pre-existing (host-bootstrap-selector with dynamic import) |
| B2 — Split host-runtime probing | ✅ Landed in Wave 2 |
| B3 — Downgrade node identity assumptions | ✅ Landed in Wave 3 |
| B4 — Strip public deploy/default leakage | ✅ Landed in Wave 3 |
