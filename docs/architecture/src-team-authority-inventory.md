# src/team/* Authority Inventory

> Generated during api-server internalization follow-up. Purpose: separate true app-local candidates from shared runtime authority and future package targets.

## Classification rules

- **app-local candidates**: primarily used by `apps/api-server` entry / route surfaces; server-facing seam modules; not good public runtime/package contracts on their own.
- **shared runtime authority**: domain/runtime modules used across team orchestration and should remain shared unless a stronger package boundary is created.
- **package-target authority**: modules that look like reusable/productized runtime substrate and are better moved toward `packages/team-runtime/` (or another package) rather than app-localizing.

## app-local candidates

- `src/team/desk-api.mjs` ✅ migrated to app seam owner
- `src/team/team-output-receipt-host.mjs` ✅ migrated to app seam owner
- `src/team/team-delivery-target.mjs` ✅ migrated to app seam owner
- `src/team/query-api/sdk.mjs` ✅ migrated to app seam owner (`apps/api-server/src/query-api/sdk.mjs`)

## shared runtime authority

- `src/team/team-policy.mjs`
- `src/team/team-store.mjs`
- `src/team/team-role-contracts.mjs`
- `src/team/team-role-deployment.mjs`
- `src/team/team-roles-config.mjs`
- `src/team/team-node-ids.mjs`
- `src/team/team-node-health.mjs`
- `src/team/team-node-health-core.mjs`
- `src/team/team-node-health-probes.mjs`
- `src/team/team-session-completion-bus.mjs`
- `src/team/team-agent-lifecycle.mjs`
- `src/team/team-resident-runtime.mjs`
- `src/team/team-governance-runtime.mjs`
- `src/team/team-native-chat.mjs`
- `src/team/team-task-dispatcher.mjs`
- `src/team/team-tl-runtime.mjs`
- `src/team/team-agent-critic-session-runner.mjs`
- `src/team/session-bus.mjs`
- `src/team/event-bus.mjs`
- `src/team/event-types.mjs`
- `src/team/im-channel-router.mjs`
- `src/team/channel-message.mjs`
- `src/team/channel-adapters/channel-adapter-base.mjs`
- `src/team/channel-adapters/channel-feishu.mjs`
- `src/team/channel-adapters/channel-qq.mjs`
- `src/team/channel-adapters/channel-telegram.mjs`
- `src/team/channel-adapters/channel-wechat.mjs`
- `src/team/agent-personality.mjs`
- `src/team/personality-prompt-injector.mjs`
- `src/team/memory-settings.mjs`
- `src/team/team-single-flight-guard.mjs`
- `src/team/migration-runner.mjs`

## package-target authority

- `src/team/agent-desk.mjs` ✅ packaged; src is shim only
- `src/team/desk-storage.mjs` ✅ packaged; src is shim only
- `src/team/skill-registry.mjs` ✅ migrated to `packages/team-runtime/src/skill-registry.mjs`
- `src/team/skill-runtime.mjs` ✅ migrated to `packages/team-runtime/src/skill-runtime.mjs`
- `src/team/delivery-contracts.mjs` ✅ packaged; src is shim only
- `src/team/workbench-manager.mjs` ✅ packaged; src is shim only
- `src/team/governance-approval-queue.mjs` ✅ packaged; src is shim only
- `src/team/governance-auditor.mjs` ✅ packaged; src is shim only
- `src/team/governance-policy-engine.mjs` ✅ packaged; src is shim only
- `src/team/governance-risk-assessment.mjs` ✅ packaged; src is shim only
- `src/team/team-parallel-executor.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/artifact.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/completion.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/execution.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/fail-fast.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/followup.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/memory-core.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/memory.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/memory-registry.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/orchestration.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/planning.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/prompt.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/runtime-harness.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/single-flight.mjs` ✅ packaged; src is shim only
- `src/team/tl-runtime/state-writeback.mjs` ✅ packaged; src is shim only

## Notes

- This inventory is an authority map, not a mandatory migration queue.
- A file being listed as package-target does **not** mean it should move into `apps/api-server/`.
- Current clean direction:
  - app keeps server entry + route surface + server-only seams
  - shared runtime remains shared until packaged cleanly
  - reusable runtime substrate trends toward `packages/team-runtime/`
