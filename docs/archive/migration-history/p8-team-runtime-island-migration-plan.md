# P8 Team Runtime Island Migration Plan

## Goal

Complete a truthful package-owned migration of the **current team-runtime export surface**.

## Important boundary

P8 does **not** claim that all of `src/team/` has migrated.
It only claims ownership flip for the currently packaged runtime/orchestration export surface.

## Scope completed in P8

`packages/team-runtime/` now owns:

- main runtime/orchestration export surface from `packages/team-runtime/src/*.mjs`
- TL runtime subtree from `packages/team-runtime/src/tl-runtime/*.mjs`

`src/team/*.mjs` and `src/team/tl-runtime/*.mjs` for those covered files now remain as compatibility shims.

## Out of scope for P8

Still outside this package-owned flip unless migrated later:

- `src/team/channel-adapters/*`
- `src/team/query-api/*`
- `src/team/migrations/*`
- repo-local docs/index files under `src/team/`
- `src/team-runtime-adapters/*` host/runtime adapter authority

## Completion rule

P8 is complete only when:

1. packaged team-runtime export surface owns real implementation,
2. covered `src/team/*` files are shims,
3. docs explicitly describe the partial boundary honestly,
4. smoke verifies package-owned reality.
