# Dashboard Authority and Transition Map

> Status: current public-facing clarification for dashboard surfaces
> Purpose: explain the relationship between `dashboard/` and `apps/dashboard/` so contributors do not place work in the wrong path.

---

## One-line answer

- `dashboard/` is the **current dashboard UI authority**.
- `apps/dashboard/` is a **transition / app-packaging surface**.

If a contributor is changing the main user-facing dashboard implementation, the default place to look first is **`dashboard/`**.

---

## Current roles

### `dashboard/`
Use this as the current authority for:
- main dashboard UI code
- dashboard build behavior
- dashboard environment examples
- dashboard deployment notes
- contract-facing dashboard behavior

Observed signals in-repo:
- has `.env.example`
- has `next.config.js`
- has `docs/`
- has `DEPLOY-OSS.md`
- has live build output directories locally (`.next/`)
- is referenced in public docs as the current UI authority

### `apps/dashboard/`
Use this as a secondary surface for:
- app packaging
- future migration landing area
- wrapper/app-shell experimentation
- transition support while authority is not fully flipped

Observed signals in-repo:
- lightweight package wrapper
- `README.md`
- `src/index.mjs`
- currently much thinner than `dashboard/`

---

## Contribution rule

### Put changes in `dashboard/` when
- changing visible dashboard UI behavior
- changing dashboard build behavior
- changing dashboard public contract consumption
- changing dashboard deployment guidance

### Touch `apps/dashboard/` when
- working on packaging/transition concerns
- preparing a future app flip
- maintaining wrapper/bootstrap code specific to the app surface

If the same change seems to require edits in both places, treat that as a migration-boundary smell and document why.

---

## Migration rule

A future authority flip from `dashboard/` to `apps/dashboard/` should only be considered complete when:

1. `apps/dashboard/` owns the real implementation rather than a thin wrapper
2. public docs are updated in the same change
3. build/release scripts point to the new authority
4. old `dashboard/` entrypoints become shims, archive, or are removed
5. smoke/build checks no longer treat `dashboard/` as primary

Until then, **`dashboard/` remains the current authority**.

---

## Open-source hygiene note

Local runtime/build outputs under `dashboard/` such as:
- `.next/`
- `node_modules/`
- local `.env.*`

should be treated as local/generated surfaces, not product authority.
The authority is the source/config/docs surface under `dashboard/`, not its generated artifacts.

---

## Read next

- `../../README.md`
- `../repo-authority.md`
- `../architecture/product-surface-and-repo-map.md`
- `../architecture/release-engineering-and-ci.md`
