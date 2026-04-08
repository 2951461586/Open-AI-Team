# Team Source Index

## Current state

`src/team/` is no longer a single-authority directory.
It is now a **mixed surface**:

- covered packaged runtime exports live authoritatively in `packages/team-runtime/`
- remaining non-packaged team surfaces still live here

## Packaged runtime export surface (compatibility shim here)

- `team-tl-runtime.mjs`
- `tl-runtime/*`
- `team-store.mjs`
- `team-policy.mjs`
- `team-single-flight-guard.mjs`
- `team-node-health.mjs`
- `team-node-health-core.mjs`
- `team-node-health-probes.mjs`
- `team-resident-runtime.mjs`
- `team-governance-runtime.mjs`
- `team-session-completion-bus.mjs`
- `event-types.mjs`
- `event-bus.mjs`
- `session-bus.mjs`
- other files mirrored in `packages/team-runtime/src/*.mjs`

## Remaining local team surfaces

- `query-api/*`
- repo-local docs/index/readme files
- app-local compatibility seams that intentionally still point toward app/server-owned surfaces
- any team subdomain not yet moved into package contract surface

## Deleted Legacy Shell

- 旧 `team-runtime.mjs` / `team-agent-harness.mjs` / `team-multi-node-gateway.mjs` 已物理清退，不再作为 source index 成员

## Entry guidance

- packaged orchestration/runtime authority: start from `packages/team-runtime/`
- remaining local team surfaces: inspect `src/team/` directly
- host/runtime adapter wiring: inspect `src/team-runtime-adapters/`
