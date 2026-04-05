# P4: Pipeline Runtime Shim + Smoke Tests Retirement

**Date**: 2026-03-28
**Status**: ✅ Deployed + Regression PASS (15/15)

## Summary

Replaced the 312-line pipeline compatibility shim (`team-runtime.mjs`) with an 81-line
final stub. All pipeline methods now return `{ok: false, error: "pipeline_retired"}`.
Archived 12 smoke tests (1544 lines) that tested pipeline-specific behavior through
the retired shim methods.

## Changes

### `src/team/team-runtime.mjs`
- **312 → 81 lines** (−231 lines, −74%)
- Removed: `applyReviewResult`, `finalizeTaskDecision`, `onExecutorResult`,
  `consumeManualReroute` full implementations
- Kept: `setBroadcastFn`, `createTeamRunFromEvent` (fallback for dispatcher),
  retired method stubs that return error

### `src/index.mjs`
- Cleaned ctx for `tryHandleTeamRoute`: removed 7 unused pipeline fields
- Removed dead import (`explainRoutingDecision`)

### Archived (12 smoke tests)
All tests that called retired pipeline methods:
- `team-governance.mjs`, `team-runtime-hardening.mjs`, `team-current-member-key-format-guard.mjs`
- `team-executor-fallback-mainline.mjs`, `team-agent-output-gate-smoke.mjs`
- `team-agent-output-third-cut-smoke.mjs`, `team-output-receipt-authoritative-writeback-smoke.mjs`
- `team-capability-routing-{third,fourth}-cut-smoke.mjs`
- `team-run-entry-first-cut-smoke.mjs`, `team-runtime-reroute-entry-first-cut-smoke.mjs`
- `team-positive-reroute-acceptance-second-cut-smoke.mjs`

→ `archive/pipeline-smoke-tests/` (1544 lines)

## Verification
- `node --check` + import: all modules resolve ✅
- Stub method contract: retired methods return `{ok:false, error:"pipeline_retired"}` ✅
- Health: `ok=true, mode=team-runtime-v1` ✅
- Regression 15/15 PASS ✅

## Cumulative P1-P4 Impact
| Phase | What | Lines Retired |
|-------|------|--------------|
| P1 | Pipeline runtime core (13 files) | ~2,970 |
| P2 | Pipeline adapters (49 files) | ~6,500 |
| P3 | Pipeline routes + v1 dispatch | ~810 |
| P4 | Pipeline shim + 12 smoke tests | ~1,775 |
| **Total** | | **~12,055** |
