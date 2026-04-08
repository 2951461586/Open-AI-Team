# @ai-team/team-core

Canonical package authority for the platform-neutral shared domain/contracts layer.

## Current status

**This package is now the implementation authority for the core runtime contract/domain island.**

Package-owned implementation currently includes:

- `src/common.mjs`
- `src/decision.mjs`
- `src/execution-safety-contracts.mjs`
- `src/query-contract.mjs`
- `src/role-capability-contracts.mjs`
- `src/work-item.mjs`
- `src/index.mjs`

## Compatibility rule

Legacy source paths under `src/team-core/` remain as thin compatibility shims only.
New team-core logic should land in this package, not in `src/team-core/`.

## Responsibilities

- execution contracts
- role capability contracts
- decision/query/work item schemas
- shared validation/domain primitives

## Non-goals

This package does not own host/runtime wiring, route registration, or team runtime orchestration.
Those remain in other migration tracks until explicitly moved.
