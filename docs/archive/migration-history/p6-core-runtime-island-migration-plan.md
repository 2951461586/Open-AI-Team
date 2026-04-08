# P6 Core Runtime Island Migration Plan

> Goal: migrate core runtime islands one by one, but only when ownership becomes real.

## Scope

Priority order for this phase:

1. `packages/team-core/`
2. `packages/agent-harness/`
3. `packages/team-runtime/`
4. `apps/api-server/`

## Rule

A surface counts as migrated only when:

1. package/app owns the real implementation,
2. legacy `src/*` entry becomes a shim or is removed,
3. docs are updated in the same change,
4. verification still passes.

## Completed island in P6

### `packages/team-core/`

This island is now complete:

- `packages/team-core/src/*` owns the implementation for the platform-neutral core contract/domain layer
- `src/team-core/*` has been reduced to thin compatibility shims

Why this island first:

- dependency-light
- no host/runtime bootstrap coupling
- shared domain/contracts are naturally package-shaped

## Remaining P6 islands

### `packages/agent-harness/`

Needs careful separation between:
- real harness-core authority
- package facade exports
- copied/mirrored files that may still drift

### `packages/team-runtime/`

Higher risk because it touches:
- orchestration runtime
- runtime adapters
- TL execution chain
- cross-surface imports

### `apps/api-server/`

Should be migrated only after runtime ownership beneath it is stable.
App authority should be the final wrapper flip, not the first.
