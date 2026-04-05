# P1: Pipeline Runtime Core Retirement

**Date**: 2026-03-28
**Status**: ✅ Complete

## Summary

Archived the old pipeline runtime (`createTeamRuntime` full implementation) and all 13 helper files (2,970 lines) to `archive/pipeline-era/`. Replaced with a **312-line thin compatibility shim** that implements only the 8 methods actually called by route handlers.

## Archived Files (13 files, 2,970 lines)

| File | Lines | Purpose |
|---|---|---|
| `team-runtime.mjs` (original) | 175 | Main pipeline orchestrator |
| `team-runtime-core-helpers.mjs` | 203 | Core team operations |
| `team-runtime-plan-review-helpers.mjs` | 216 | Plan + review flow |
| `team-runtime-decision-helpers.mjs` | 180 | Judge decision flow |
| `team-runtime-postprocess-helpers.mjs` | 287 | Result processing + reroute |
| `team-runtime-entry-helpers.mjs` | 273 | Task creation entry |
| `team-runtime-executor-helpers.mjs` | 289 | Executor dispatch |
| `team-runtime-fallback-helpers.mjs` | 129 | Fallback execution |
| `team-runtime-output-helpers.mjs` | 45 | Output helpers |
| `team-runtime-finalize-helpers.mjs` | 54 | Finalization |
| `team-runtime-draft-helpers.mjs` | 95 | Draft helpers |
| `team-streaming-agent.mjs` | 839 | Streaming agent execution |
| `team-agent-output-gate.mjs` | 185 | Output gate |

## Thin Shim (`src/team/team-runtime.mjs`, 312 lines)

Implements only methods still called by route handlers:

| Method | Callers | Implementation |
|---|---|---|
| `applyReviewResult` | `index-routes-team.mjs`, `team-route-runtime-exec.mjs` | Direct teamStore update + broadcast |
| `finalizeTaskDecision` | `index-routes-team.mjs` × 2, `team-route-runtime-exec.mjs` | Insert decision + state update + mailbox + broadcast |
| `onExecutorResult` | `index-routes-team.mjs` | Persist artifacts + mailbox + state → done |
| `consumeManualReroute` | `index-routes-team.mjs` | Mailbox lookup + consumer delegate |
| `createTeamRunFromEvent` | `webhook-event-router.mjs` | Lightweight team+task creation (sync, no LLM) |
| `setBroadcastFn` | `index.mjs` | Trivial |
| `emitBroadcast` | `team-route-runtime-exec.mjs` | Passthrough to broadcast |
| `sendAgentMessage` | `index-routes-team.mjs` | No-op (never existed) |

## Changes to Active Code

- `src/index-bootstrap.mjs`: Simplified `createTeamRuntime` constructor (removed unused params: `policy`, `outputBridge`, `teamAgentBridge`, `teamAgentSessionRunner`, `executorSessionRunner`, `governanceRuntime`)
- `src/webhook-event-router.mjs`: Kept using `teamRuntime` (fast shim) for sync webhook path

## Impact

- **`src/team/` file count**: 86 → 74 (−12 files)
- **`src/team/` total lines**: 16,674 → 14,016 (−2,658 lines)
- **Net code reduction**: 2,658 lines deleted, 312 lines added = **−2,346 net**

## Validation

- ✅ `node --check` all modified files
- ✅ Full bootstrap import test
- ✅ `team-runtime-phase1-regression.sh` — **all tests PASS** (including complex path, review, decision, debate retirement)
- ✅ Dashboard `next build` clean
- ✅ Service `/health` endpoint OK
