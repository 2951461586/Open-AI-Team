# Public Examples Index

This directory exposes three public example tracks plus one simple rule:

- **Want the main product?** → start with AI Team Runtime + Dashboard
- **Want the reusable substrate?** → start with `oss-minimal/`
- **Want the external package template?** → start with `third-party-agent-sample/`

Examples help people **run or fork** the system.
They do **not** redefine the main product boundary.

---

## 1) Team Runtime public-facing track
Use the Team Runtime itself plus public-safe config/examples and query API tooling.

Start with:
- `team-runtime-public/README.md`
- `../GETTING-STARTED.md`
- `../config/examples/README.md`
- `../docs/api/team-governance-query-api/README.md`
- `../dashboard/README.md`
- `../scripts/team/team-query-route-catalog-example.mjs`

Best for:
- understanding the primary product
- query/read-model exploration
- public-facing runtime usage

---

## 2) Standalone Harness minimal runnable track
Use this if you want the host-neutral broker-first execution substrate.

Path:
- `oss-minimal/README.md`

Best for:
- quick runnable demo
- crash/resume regression
- observing run layout
- validating shell / doctor / activation flow

---

## 3) Third-party onboarding template track
Use this if you want a minimal forkable agent package shape.

Path:
- `third-party-agent-sample/README.md`

Best for:
- external onboarding
- manifest/package authoring
- provider-neutral contract alignment

---

## 4) Boundary Rule

Examples are public-safe learning surfaces.
They are not the primary definition authority for:
- product boundaries
- optional integration boundaries
- maintainer/private ops behavior

For those, prefer:
- `../README.md`
- `../ARCHITECTURE.md`
- `../docs/architecture/product-surface-and-repo-map.md`
- `../docs/architecture/release-surface-allowlist.md`
