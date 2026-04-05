# Scripts Guide

## What lives here

`scripts/` contains validation, smoke, acceptance, and maintainer utility surfaces used to prove or inspect the current product stack.

The key boundary rule is:
- **public-safe validation belongs in mainline script buckets**
- **live / maintainer / investigation behavior must not redefine the public product story**

---

## Buckets

### `smoke/`
Default public-safe smoke entrypoints.

### `team/`
Product/baseline-specific guards and validation surfaces.

### `acceptance/`
Higher-cost or live validation. Treat this as a maintainer-oriented or environment-bound surface unless a check is explicitly promoted into public-safe smoke.

### `ops/`
Maintainer-oriented audits, replay, investigation, and maintenance helpers.

### `index-surface/`
Structure checks around service entry and route registration surfaces.

---

## Default entrypoints

- default smoke: `npm run smoke:team`
- default smoke batch: `npm run smoke:team:batch`
- public schema validation: `npm run smoke:public-schemas`
- route-derived fixture generation: `npm run fixtures:route-derived`
- real-run published fixture generation: `npm run fixtures:real-run-published`
- published fixture provenance summary: `npm run fixtures:real-run-provenance`

---

## Script Layering Rules

### Public mainline
These should stay contributor-friendly and public-safe:
- `scripts/smoke/`
- public-safe portions of `scripts/team/`

### Secondary / higher-cost
These may remain in-tree, but should not dominate first-time contributor workflows:
- `scripts/acceptance/`
- selected fixture generation scripts

### Maintainer / private ops
These are useful but non-primary:
- `scripts/ops/`
- environment-specific live acceptance helpers
- any script carrying production hostnames, private paths, or deployment assumptions

---

## Canonical smoke: `smoke:team`

The canonical mainline smoke should represent the public product validation chain, not historical compatibility nostalgia.

It should continue to validate things like:
- governance wiring
- team-core authority
- runtime/harness boundaries
- host/ops neutralization
- observability neutralization
- independent agent onboarding
- standalone baseline integrity
- public contract integrity

---

## Maintenance rules

- do not flatten new scripts into the repository root
- keep public-safe checks close to the surfaces they validate
- keep current truth in active buckets only
- do not reintroduce retired legacy seams as default npm aliases
- keep maintainer/private assumptions out of default smoke entrypoints whenever possible
- if a script primarily serves live infra or a maintainer environment, classify it as such
