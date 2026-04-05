# Maintainer / Private Ops Boundary

> P5 authority document for keeping maintainer/private/live-ops material **in-tree but out of the default public product story**.

---

## 1. Goal

P5 does **not** require deleting every maintainer-facing asset immediately.
It requires making the boundary explicit and enforceable:

- contributors should be able to understand the product without reading maintainer/live-ops material
- maintainer/private assets may remain in-tree during transition
- default docs, examples, and smoke entrypoints must not silently depend on maintainer/private assumptions
- paths carrying live deployment, investigation, or private environment assumptions must declare themselves as such

---

## 2. Boundary Classification

### Public mainline
These define the default GitHub/open-source story:
- `README.md`
- `GETTING-STARTED.md`
- `ARCHITECTURE.md`
- `docs/architecture/`
- `docs/api/`
- `src/team/`
- `src/team-core/`
- `src/team-runtime-adapters/` (neutral contract layer only)
- `src/agent-harness-core/`
- `dashboard/src/`
- `examples/oss-minimal/`
- `examples/third-party-agent-sample/`
- `schemas/`
- `fixtures/public-contracts/`
- `scripts/smoke/`
- public-safe parts of `scripts/team/`

### Secondary / transitional
Allowed in-tree, but not part of the first-read story:
- `config/team/`
- `examples/README.md`
- `dashboard/README.md`
- `scripts/README.md`
- fixture-generation helpers

### Optional integrations
Allowed only as optional, non-primary integrations:
- `src/integrations/openclaw/`
- compatibility ingress layers
- channel-specific bridge/wrapper logic

### Maintainer / private / live-ops
Useful, but not part of the public product promise:
- `docs/ops/`
- `scripts/ops/`
- live acceptance helpers under `scripts/acceptance/` when tied to real infra
- active runtime inventories in `config/team/` carrying deployment-routing assumptions
- any path that assumes private hosts, live deployment topology, SSH targets, or investigation-only workflows

---

## 3. What P5 Means In Practice

### `docs/ops/`
- may remain in-tree
- must identify itself as maintainer-oriented operational history or playbooks
- must not be listed as required reading for contributors

### `scripts/ops/`
- may remain in-tree
- must identify itself as maintainer/investigation tooling
- must not be implied by `npm run smoke:team` or other default public-safe entrypoints

### `config/team/`
- may remain in-tree during transition
- should be described as active runtime inventory / maintainer-facing config authority
- must not be presented as the public example/default package config surface
- public examples should continue to live under `config/examples/`

### Optional integrations
- may stay in source tree
- must be explicitly labeled optional
- must not redefine the primary mental model of the repository

---

## 4. Guardrail Questions

Before adding a new file, ask:

1. Does a new contributor need this to understand or run the public product?
2. Is it only useful for live deployment / investigation / operator workflows?
3. Does it assume private topology, hostnames, secrets, SSH, or current maintainer infrastructure?
4. If copied into a fresh public fork, would it still make sense?

If the answer to (2) or (3) is yes, it belongs behind a maintainer/private boundary.

---

## 5. P5 Acceptance Bar

P5 is considered complete when:

1. `docs/ops/`, `scripts/ops/`, and `config/team/` have explicit boundary labeling
2. mainline docs point readers to primary product surfaces first
3. maintainer/private material is discoverable, but only as secondary/maintainer-only context
4. canonical smoke includes a boundary guard so this distinction does not regress

---

## 6. Non-Goals

P5 is **not yet**:
- a full repo split
- a private repo extraction
- deletion of every maintainer-oriented utility
- removal of all live acceptance helpers

Those can happen later. P5 is the step that makes the boundary explicit, documented, and testable.

---

## 7. One-line Rule

**Maintainer/private ops may stay in-tree, but they must never again masquerade as the default public product story.**
