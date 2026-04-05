# Maintainer / Investigation Scripts

> `scripts/ops/` is a **maintainer/private-ops surface**.

These scripts are useful for:
- investigation
- replay
- audit
- live environment maintenance
- deployment-specific diagnosis

They are **not** canonical public-safe smoke entrypoints.

## Rules

- do not treat this directory as part of the default contributor workflow
- do not wire these scripts into `smoke:team` unless they are first rewritten as public-safe guards
- assume scripts here may depend on live hosts, SSH targets, local state, or maintainer-only context
- if a script graduates into a public-safe contract check, move that logic into `scripts/team/` or `scripts/smoke/`

## Current examples

- rerouted audit inspection
- output replay / investigation helpers
- port/config audit helpers

If you are looking for the public validation path, use:
- `../smoke/team-mainline.mjs`
- `../team/INDEX.md`
