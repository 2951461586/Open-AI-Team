# P2: Pipeline Adapter Layer Full Retirement

**Date**: 2026-03-28
**Status**: ✅ Deployed + Regression PASS

## Summary

Archived the entire pipeline adapter layer (47→49 files, ~6500 lines) that powered the old
plan→review→judge→execute callback chain. Replaced with thin facades that delegate to TL runtime.

## Changes

### Archived to `archive/pipeline-adapters/`
- 49 files total: all `team-agent-*`, `team-openai-compatible-*`, `team-native-chat`, 
  `team-multi-node-gateway`, `team-reroute-consumer`, `team-route-runtime-exec` (original),
  plus old `.bak` and `.mjs` adapter files
- Total archived lines: ~6,500

### Rewritten
- **`src/index-bootstrap.mjs`**: 551→225 lines. All pipeline adapter imports and construction 
  removed. Now only wires: store → policy → node health → governance → TL runtime.
- **`src/team/team-agent-judge-session-runner.mjs`**: Thin facade → delegates to `tlRuntime.handleTaskChat`
- **`src/team/team-agent-executor-session-runner.mjs`**: Thin facade → delegates to `tlRuntime.handleTaskChat`
- **`src/team/team-agent-critic-session-runner.mjs`**: Thin facade → delegates to `tlRuntime.handleTaskChat`

### Retired Routes
- **`src/routes/team-route-runtime-exec.mjs`**: All pipeline callback routes (`/internal/team/planner-completion`,
  `/internal/team/critic-completion`, `/internal/team/executor-completion`, `/internal/team/executor-result`)
  now return `410 Gone`

### Cleaned Up
- Removed `TEAM_REROUTE_JUDGE_STUB` config flag (only used by reroute acceptance tests)
- Added `criticSessionRunner` and `executorSessionRunner` to route ctx (were previously missing)
- `nativeChat` replaced with stub (TL runtime handles chat internally)
- `teamOutputSender`, `teamOutputBridge`, `teamAgentBridge` replaced with no-op stubs

## Verification
- `node --check` + `import()` — all modules resolve ✅
- Orchestrator health: `ok=true, mode=team-runtime-v1` ✅
- Dashboard API: `ok=true, cards=3` ✅
- All 14 regression test assertions: PASS ✅
- Dashboard build: success ✅
- Retired route returns 410 with clear message ✅

## Impact
- Boot time reduced (~49 fewer module loads)
- `src/` total: ~11,100 lines (down from ~17,500+ with adapter layer)
- Single execution path: TL runtime only
