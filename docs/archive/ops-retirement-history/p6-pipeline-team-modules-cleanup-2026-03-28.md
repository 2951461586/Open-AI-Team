# P6: Pipeline-era Team Module Cleanup

**Date**: 2026-03-28
**Status**: ✅ Deployed + Regression PASS (15/15)

## Summary

Archived 7 orphaned pipeline-era modules from `src/team/`. These files had zero
importers in active code — their only consumers were retired with P1-P4.

## Archived Files (→ `archive/pipeline-team-modules/`)

| File | Lines | Purpose (pipeline-era) |
|------|-------|----------------------|
| `team-agent-role-memory.mjs` | 162 | Per-role lesson append/extract for pipeline feedback loop |
| `team-role-task-card.mjs` | 134 | Task card formatting for pipeline review flow |
| `team-route-claim-guard.mjs` | 116 | Claim guard middleware for pipeline route dispatch |
| `team-capability-router.mjs` | 81 | Capability-based routing (only imported by claim guard) |
| `team-single-flight-guard.mjs` | 110 | Dedup guard for pipeline concurrent executions |
| `team-task-claim-runtime.mjs` | 79 | Task claim/lock runtime for pipeline executor dispatch |
| `team-tool-sandbox.mjs` | 103 | Tool sandbox config for pipeline executor sessions |
| **Total** | **785** | |

## src/team/ After Cleanup

| Metric | Before | After |
|--------|--------|-------|
| Files | 23 | **16** |
| Active lines | ~5,886 | **~5,101** |

### Remaining active modules (16)
Core: `team-tl-runtime` (1834), `team-store` (1009), `team-task-dispatcher` (829),
`team-resident-runtime` (492), `team-node-health` (338)
Config: `team-roles-config` (248), `team-role-contracts` (200), `team-governance-runtime` (195),
`team-agent-lifecycle` (169), `team-parallel-executor` (152)
Support: `team-policy` (90), `team-role-deployment` (84), `team-runtime` (81, stub),
`team-delivery-target` (64), `team-output-receipt-host` (34), `team-agent-critic-session-runner` (31)

## Verification
- Import graph: all 7 files confirmed zero importers in active `src/`
- `node --check` + dynamic import: ✅
- Regression 15/15 PASS ✅
- Health: `ok=true, mode=team-runtime-v1` ✅

## Cumulative P1-P6 Impact
| Phase | What | Lines Retired |
|-------|------|--------------|
| P1 | Pipeline runtime core (13 files) | ~2,970 |
| P2 | Pipeline adapters (49 files) | ~6,500 |
| P3 | Pipeline routes + v1 dispatch | ~810 |
| P4 | Pipeline shim + 12 smoke tests | ~1,775 |
| P5 | Bootstrap + dead imports + 2 facades | ~91 |
| P6 | 7 orphan team modules | ~785 |
| **Total** | **84 files** | **~12,931** |
