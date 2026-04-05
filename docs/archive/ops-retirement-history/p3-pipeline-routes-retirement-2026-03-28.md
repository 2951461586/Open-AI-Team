# P3: Pipeline Route Layer Retirement

**Date**: 2026-03-28
**Status**: ✅ Deployed + Regression PASS (15/15)

## Summary

Retired 7 pipeline orchestration routes from `index-routes-team.mjs` (plan submit, review submit,
decision submit, judge/run, executor/run, executor-result, reroute/consume). All now return 410 Gone.
V1 dispatch stub retired (v2 shadows all its routes).

## Changes

### `src/routes/index-routes-team.mjs`
- **815 → 144 lines** (−671 lines, −82%)
- Removed: entire plan→review→decision pipeline orchestration, auto-judge, auto-escalation,
  role lesson extraction, evidence/artifact/mailbox bookkeeping, critic claim release,
  pipeline skip logic, executor result handling, reroute consumption
- Kept: `/internal/team/task` (thin store write), `/internal/team/message` (thin store write),
  delegate calls to resident/runtime-exec/control/dispatch-v2
- 7 routes → 410 Gone tombstones

### `src/routes/team-route-dispatch.mjs` (v1)
- **151 → 12 lines** — stub that returns `false` (v2 handles everything)

### `src/index.mjs`
- Cleaned ctx passed to `tryHandleTeamRoute`: removed 7 unused fields
  (`explainRoutingDecision`, `teamAgentBridge`, `TEAM_JUDGE_TRUE_EXECUTION`,
  `JUDGE_TRUE_EXECUTION_WIRED`, `judgeSessionRunner`, `executorSessionRunner`, `TEAM_POLICY`)
- Removed dead import of `explainRoutingDecision`

### Regression test updated
- Plan/review/decision assertions changed from 200→410 (pipeline_retired)
- Task state query assertion simplified (no longer expects done from pipeline flow)

## Archived
- `archive/pipeline-adapters/index-routes-team-pre-p3.mjs` (original 815-line file)
- `archive/pipeline-adapters/team-route-dispatch-v1.mjs` (original v1 dispatch)

## Verification
- `node --check` + import: all modules resolve ✅
- Orchestrator health: `ok=true, mode=team-runtime-v1` ✅
- Regression 15/15 PASS ✅
- All 410 tombstones return proper `pipeline_retired` error ✅

## Cumulative P1+P2+P3 Impact
- Pipeline runtime core: 13 files / 2970 lines → archived (P1)
- Pipeline adapters: 49 files / ~6500 lines → archived (P2)
- Pipeline routes: 810+ lines → archived (P3)
- **Total retired: ~10,300+ lines of pipeline-era code**
