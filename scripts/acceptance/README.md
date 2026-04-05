# Acceptance Scripts

> `scripts/acceptance/` is a **higher-cost / live / maintainer-oriented validation surface**, not part of the default contributor smoke path.

## Buckets

- `canonical/` — default live acceptance for the current product line

Historical or compatibility-only acceptance material should stay archived or be invoked explicitly by path; it should not define the default product acceptance story.

## Boundary

Treat this directory as:
- useful when validating real environments or live topology
- higher-cost than default public-safe smoke
- non-primary for first-time contributors
- unsuitable as a replacement for `npm run smoke:team`

If a check becomes public-safe and cheap enough for default regression, move or mirror that guard into:
- `scripts/smoke/`
- `scripts/team/`

## Current rule

- `npm run acceptance:three-node-live` → canonical
- no legacy/historical seam should be reintroduced as a default npm acceptance alias
- dashboard / workbench / summary acceptance is defined by the real route + UI loading behavior, not by stale historical aliases

## Migration rule

- new default acceptance flows go into `canonical/`
- current references should point directly to canonical script paths
- historical or compatibility-only checks should not drift back into the default acceptance bundle
