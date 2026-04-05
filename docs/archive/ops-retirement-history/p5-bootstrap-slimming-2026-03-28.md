# P5: Bootstrap Slimming + Dead Import Cleanup

**Date**: 2026-03-28
**Status**: ✅ Deployed + Regression PASS (15/15)

## Summary

Slimmed `index-bootstrap.mjs` from 225→196 lines and cleaned dead wiring in `index.mjs`.
Archived 2 more facade files (judge/executor session runners). Removed 5 null stub objects
and 7 dead export fields.

## Changes

### `src/index-bootstrap.mjs` (225 → 196 lines, −29)
- Removed: `createJudgeSessionRunner` + `createExecutorSessionRunner` imports/creation
- Removed: `teamOutputSender`, `teamOutputBridge`, `teamAgentBridge` null stubs
- Removed: 5 dead fields from return (`teamOutputSender`, `teamOutputBridge`,
  `teamAgentBridge`, `judgeSessionRunner`, `executorSessionRunner`)
- Kept: `TEAM_POLICY` (still needed by `consumeWebhookEvent` via entry route ctx)

### `src/index.mjs`
- Removed: 5 dead destructured fields + `explainRoutingDecision` dead import (from P3/P4)
- Removed: 4 dead `setBroadcastFn` calls (output sender/bridge/judge/executor)
- Cleaned: entry route ctx from 6→4 fields (removed dead `teamOutputBridge`)

### Archived
- `team-agent-judge-session-runner.mjs` (31 lines) → `archive/pipeline-adapters/`
- `team-agent-executor-session-runner.mjs` (31 lines) → `archive/pipeline-adapters/`

### Bug caught & fixed
- First attempt over-eagerly removed `TEAM_POLICY` from bootstrap return, breaking
  `consumeWebhookEvent` → `classifyWorkMode`. Restored immediately; regression caught it.

## Verification
- `node --check` + import: all modules resolve ✅
- Regression 15/15 PASS ✅
- Health: `ok=true, mode=team-runtime-v1` ✅

## Cumulative P1-P5 Impact
| Phase | What | Lines Retired |
|-------|------|--------------|
| P1 | Pipeline runtime core (13 files) | ~2,970 |
| P2 | Pipeline adapters (49 files) | ~6,500 |
| P3 | Pipeline routes + v1 dispatch | ~810 |
| P4 | Pipeline shim + 12 smoke tests | ~1,775 |
| P5 | Bootstrap + dead imports + 2 facades | ~91 |
| **Total** | | **~12,146** |
