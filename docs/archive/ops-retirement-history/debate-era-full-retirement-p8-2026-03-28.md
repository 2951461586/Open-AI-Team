# P8: Debate-Era Full Retirement

**Date**: 2026-03-28
**Status**: ✅ Complete

## What was retired

| Item | Original path | Destination |
|---|---|---|
| supervisor.mjs | `src/supervisor.mjs` | `archive/debate-era/` |
| debate-policy.json | `policy/debate-policy.json` | `archive/debate-era/` |
| debate-runtime-retirement-readiness.mjs | `scripts/index-surface/` | `archive/debate-era/` |
| `policy/` directory | (now empty) | removed |

## What was cleaned in active code

- `src/index-bootstrap.mjs`: removed `loadSupervisorPolicy` import + `SUP_POLICY` variable + export
- `src/index.mjs`: removed `SUP_POLICY` destructure + stale console.log reference
- `config/system.manifest.json`: debate section → `enabled: false, status: retired`

## What was deliberately kept

- **`src/routes/index-routes-entry.mjs`** — debate legacy 410 tombstones. These prevent old clients/scripts from hitting live routes and return proper retirement metadata. They should remain until no client references these endpoints.
- **`scripts/team/team-runtime-phase1-regression.sh`** — debate retirement assertions. These actively verify the tombstones still return correct 410 responses.
- **Other `scripts/` debate references** — mostly `debateStore: null` (confirming debate is not wired) or retirement assertions.
- **`config/team/network-ports.json`** — historical compat notes about 19100.

## Validation

- `node --check src/index-bootstrap.mjs` ✅
- `node --check src/index.mjs` ✅
- Full import test ✅
- `team-runtime-phase1-regression.sh` — all debate retirement assertions PASS ✅
- `/health` endpoint OK ✅
- Zero dangling references to archived files in `src/` ✅
