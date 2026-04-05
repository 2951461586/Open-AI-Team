# Documentation Index

> Current documentation entrypoint for the repository.
> Read this after `README.md` and `ARCHITECTURE.md`.

---

## 1. Start Here

### Understand the public product family
Read in this order:
- `../GETTING-STARTED.md`
- `../README.md`
- `../README_zh.md`
- `../ARCHITECTURE.md`
- `../docs/deploy/dashboard-source-authority.md`
- `../docs/migration/dashboard-static-export-deprecation.md`
- `../docs/oss/deerflow-openhanako-comparison.md`
- `architecture/product-surface-and-repo-map.md`
- `architecture/release-surface-allowlist.md`
- `architecture/current-team-runtime-architecture.md`
- `architecture/session-capability-and-followup-fallback.md`
- `architecture/independent-agent-onboarding.md`
- `architecture/standalone-harness-baseline-release.md`
- `architecture/standalone-run-layout-authority.md`
- `architecture/release-preflight-retirement-inventory.md`
- `architecture/release-engineering-and-ci.md`
- `architecture/release-artifacts-and-publishing.md`
- `architecture/release-notes-provenance-and-version-story.md`

### Understand the runnable baseline / sample flow
- `../examples/README.md`
- `../examples/oss-minimal/README.md`
- `../examples/third-party-agent-sample/README.md`
- `../dashboard/README.md`

### Understand operations / maintainer notes *(secondary / maintainer-only)*
- `architecture/maintainer-private-ops-boundary.md`
- `ops/README.md`
- `ops/`
- `changelog/`
- `p4-streaming-recovery.md`

### Understand historical context
- `archive/`

---

## 2. Documentation Areas

### `architecture/`
Current product architecture, repository boundary rules, onboarding, baseline release, and release-facing cleanup authority.

### `api/`
Public/runtime API documentation.

### `ops/`
Maintainer-oriented operational notes, deployment notes, and investigations.

### `changelog/`
Milestone implementation records and dated progress notes.

### `archive/`
Historical documents only. Use for background, not for current authority.

---

## 3. Documentation Rules

- Current truth belongs in:
  - `../README.md`
  - `../GETTING-STARTED.md`
  - `../ARCHITECTURE.md`
  - `architecture/`
  - `api/`
- Maintainer/private operational context belongs in:
  - `ops/`
- Historical material belongs in:
  - `archive/`
- Example/runtime artifacts do **not** define documentation authority.
- If a current document and an archived document disagree, prefer the current document.

---

## 4. Recommended Reading Order

1. `../GETTING-STARTED.md`
2. `../README.md`
3. `../ARCHITECTURE.md`
4. `architecture/product-surface-and-repo-map.md`
5. `architecture/release-surface-allowlist.md`
6. `architecture/current-team-runtime-architecture.md`
7. `architecture/independent-agent-onboarding.md`
8. `architecture/standalone-harness-baseline-release.md`

---

<!-- P0 documentation index authority -->
