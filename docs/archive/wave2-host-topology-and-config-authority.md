# Wave 2 Host Topology + Config Authority Boundary

> Purpose: fully close Wave 2 by splitting host-topology health semantics from probe adapters, while fixing public vs maintainer config authority.

## 1. Node-health split

Current authority is intentionally split into:
- `src/team/team-node-health.mjs` — thin facade
- `src/team/team-node-health-core.mjs` — scoring / placement semantics
- `src/team/team-node-health-probes.mjs` — local/remote health collection adapters

### Rule
- placement semantics must not be buried inside probe-specific code
- probe implementations must not redefine product placement logic
- facade remains the stable import for callers

## 2. Config authority split

### Public-safe config authority
Use first for docs / onboarding / forks:
- `config/examples/`
- `config/README.md`
- `config/examples/README.md`

### Maintainer runtime inventory authority
Use only for current live/runtime maintenance:
- `config/team/`
- `config/team/README.md`

### Interpretation lock
- `config/examples/` defines the public example story
- `config/team/` does not define the public default story
- active runtime may still consume `config/team/`, but public onboarding must point to `config/examples/` first

## 3. Exit criteria

Wave 2 is complete when:
- host runtime config is split into neutral core + maintainer overlay
- node health is split into facade + core + probes
- config authority is explicitly documented as public example vs maintainer inventory
- smokes assert all three boundaries
