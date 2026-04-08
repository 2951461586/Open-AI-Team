# P5 Migration and Packaging Plan

> Authority note: this document is a **truthful migration plan**, not a premature authority flip.
> Current runtime authority remains under `src/` until the owning package/app contains the real implementation.

## Goal

Complete the next large-grain cleanup wave in this order:

1. monorepo migration
2. historical runtime-artifact / non-product noise cleanup
3. transition dual-track reduction
4. default persistence / state productization
5. release packaging hardening
6. optional integration package-boundary completion

## Current findings

### 1. Package/app trees already exist

The repo already contains:

- `packages/agent-harness/`
- `packages/team-core/`
- `packages/team-runtime/`
- `packages/tools/`
- `packages/im-channels/`
- `apps/api-server/`
- `apps/cli/`
- `apps/dashboard/`

### 2. But many are still facades

Examples:

- `packages/agent-harness/src/index.mjs` re-exports `src/agent-harness-core/index.mjs`
- `packages/team-runtime/src/team-tl-runtime.mjs` re-exports `src/team/team-tl-runtime.mjs`
- `apps/api-server/src/index.mjs` re-exports `src/index.mjs`
- several package trees also contain copied or drifted files that are not yet the single implementation authority

Therefore the repository is in a **partial migration** state, not a completed package-owned state.

## Migration completion criteria

A package/app becomes authoritative only when all are true:

1. the implementation lives in that package/app,
2. the old `src/*` surface becomes a thin shim or disappears,
3. docs and smoke expectations are updated in the same change,
4. no parallel divergent implementation remains.

## Workstream details

## W1. Monorepo migration

### Immediate safe action

- Keep `src/` as truth while documenting package/app ownership targets more explicitly.
- Prefer converting copied package files into deliberate shims unless/until their implementation is actually moved.
- Exception already completed: `packages/tools/` now owns the public tool-provider island, and `src/tools/*` has been reduced to compatibility shims.

### Target ownership map

- `packages/agent-harness/` ← target owner of `src/agent-harness-core/`
- `packages/team-core/` ← target owner of `src/team-core/`
- `packages/team-runtime/` ← target owner of `src/team/` and selected `src/team-runtime-adapters/` public runtime exports
- `packages/tools/` ← target owner of `src/tools/`
- `packages/im-channels/` ← target owner of public-safe channel adapters / router surface
- `apps/api-server/` ← target owner of server/bootstrap app entry
- `apps/dashboard/` ← target owner of dashboard app packaging surface

### Sequencing rule

Do not migrate everything at once. Move by ownership island:

1. tools
2. team-core
3. agent-harness
4. team-runtime
5. api-server app entry
6. integration packages

## W2. Historical runtime-artifact and non-product noise cleanup

Safe cleanup/ignore targets identified from current tree:

- `dashboard/.next/`
- `dashboard/out/`
- `run/`
- `tmp/`
- `.tmp/`
- `.tmp-skill-registry/`
- `.tmp-skill-registry-2/`
- `examples/**/.runs/`

Rule:
- if generated and not required for repo authority, keep ignored and out of release story;
- if committed accidentally, remove from tracked release packaging surface.

## W3. Transition dual-track reduction

Dual-track sources still visible today:

- `src/` authority vs `packages/` facades
- `dashboard/` product authority vs `apps/dashboard/` package surface
- `src/index.mjs` runtime app entry vs `apps/api-server/src/index.mjs` facade

P5 direction:
- make every dual-track case explicit in docs,
- remove any wording that implies migration is already complete,
- flip authority only after real ownership move.

## W4. Default persistence / state productization

P5 should make state surfaces more product-shaped:

- storage roots
- desk/state layout
- event/archive evidence layout
- governance queue persistence
- release-safe defaults and ignore rules

## W5. Release packaging

P5 should produce a cleaner public release story:

- public docs and package/app ownership map agree
- generated runtime state excluded from release story
- examples remain runnable but are clearly non-authoritative
- release artifacts / staging scripts map to public product surfaces only

## W6. Optional integration package boundary

Goal:
- keep optional integrations in-tree if needed,
- but frame them as package-ready optional surfaces,
- not as the default product understanding path.

## Exit condition for P5

P5 is complete when:

- migration truth is documented without pretending packages already own the implementation,
- runtime-artifact noise is materially reduced or isolated from product/release surfaces,
- dual-track wording is consistent,
- persistence/state/release packaging rules are clearer,
- integration boundaries are package-ready in narrative and layout.
