# P7: Pipeline-era Scripts + Dead npm Scripts Cleanup

**Date**: 2026-03-28
**Status**: ✅ Deployed + Regression PASS (15/15)

## Summary

Archived 66 dead scripts (59 .mjs + 4 .sh from `scripts/team/`, 2 from
`scripts/acceptance/canonical/`, 1 from `scripts/smoke/`) plus 2 empty marker
directories (`scripts/debate/`, `scripts/governance/`). Removed 4 dead npm script
entries from `package.json`.

## Method

1. Built module-level import graph: any script importing an archived `src/team/` module
   is dead by definition (its import target no longer exists at the original path).
2. Cross-checked with `node --check` and actual execution for borderline cases.
3. Verified all surviving scripts either: import only from active `src/` modules,
   use only HTTP calls against the running service, or read files with `fs`.

## Archived (→ `archive/pipeline-scripts/`)

| Location | Files | Lines |
|----------|-------|-------|
| `scripts/team/` (.mjs) | 59 | 3,839 |
| `scripts/team/` (.sh runners) | 4 | 448 |
| `scripts/acceptance/canonical/` | 2 | 562 |
| `scripts/smoke/` | 1 | 100 |
| `scripts/debate/` (README only) | 1 | — |
| `scripts/governance/` (README only) | 1 | — |
| **Total** | **68** | **~4,949** |

## Dead npm scripts removed from package.json

- `smoke:team:executor-fallback`
- `smoke:team:executor-workspace`
- `acceptance:team-mainline`
- `acceptance:critic-lebang-live`

## Surviving scripts inventory

| Directory | Files | Purpose |
|-----------|-------|---------|
| `scripts/team/` | 23 | Active smokes, payloads, utils, regression runner |
| `scripts/smoke/` | 11 | HTTP-based smoke tests (no src/ import deps) |
| `scripts/acceptance/canonical/` | 8 | Live multi-node acceptance tests |
| `scripts/index-surface/` | 7 | Route structure checks + HTTP split smokes |
| `scripts/ops/` | 5 | Dashboard sync, port audit, replay |

## Verification
- Regression 15/15 PASS ✅
- Health: `ok=true, mode=team-runtime-v1` ✅
- All surviving smoke scripts verified: imports resolve, no broken references

## Cumulative P1-P7 Impact
| Phase | What | Files | Lines |
|-------|------|-------|-------|
| P1 | Pipeline runtime core | 13 | ~2,970 |
| P2 | Pipeline adapters | 49 | ~6,500 |
| P3 | Pipeline routes + v1 dispatch | — | ~810 |
| P4 | Pipeline shim + 12 smoke tests | — | ~1,775 |
| P5 | Bootstrap + dead imports | 2 | ~91 |
| P6 | 7 orphan team modules | 7 | ~785 |
| P7 | 68 dead scripts + 4 npm entries | 68 | ~4,949 |
| **Total** | | **~139+ files** | **~17,880** |
