# @ai-team-harness/team-runtime

Planned home for team-lead runtime behavior, orchestration, scheduling, execution flow, and runtime adapters.

Expected responsibilities:
- orchestration/runtime lifecycle
- planner/executor coordination
- scheduling and dispatch
- runtime adapters and control-plane integration

Migration note:
- likely draws from `src/team/` and `src/team-runtime-adapters/`
- avoid mixing low-level contracts here; keep those in `team-core`
