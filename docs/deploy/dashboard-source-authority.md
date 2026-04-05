# Dashboard Source Authority & Deployment

## Goal

Freeze one rule for maintainers and OSS users:

> **The dashboard may only be deployed from the complete dashboard source tree after a fresh build.**

This document exists because generated static bundles and old fallback exports can drift away from the current source tree and accidentally ship stale UI.

## The only deployment authority

Authoritative dashboard source surface:

- `dashboard/src/`
- `dashboard/public/`
- `dashboard/package.json`
- `dashboard/package-lock.json`
- `dashboard/next.config.js`
- `dashboard/postcss.config.js`
- `dashboard/tailwind.config.ts`
- `dashboard/tsconfig.json`

A deployment is considered valid only when it is produced from that source boundary.

## Non-authoritative / deprecated deployment surfaces

The following are **not** valid authorities for deciding what version should be online:

- historical `dashboard-static-export` bundles / paths
- any previously exported `out/` directory copied across machines
- any local static mirror such as `/srv/...` when its provenance is unclear
- any one-off staging bundle without a matching source-tree build

These surfaces may still exist for inspection, migration, debugging, or release attachment purposes, but they must not override the source-tree build authority.

## Required deployment sequence

```bash
cd dashboard
npm ci
npm run build
npm run scan:bundle
# publish the freshly built ./out directory
```

Optional host-side publication may then:
- sync `out/` to a local static directory
- upload `out/` to CloudBase Hosting
- attach the same `out/` provenance to release assets

## Guardrail rule

If the repository does not contain a complete dashboard source tree, maintainers must:

1. stop the deploy
2. recover the correct source commit / branch / worktree
3. rebuild from source
4. only then publish

Do **not** fall back to an old static export just because it is convenient.

## Suggested maintainer script contract

A deploy helper should refuse to proceed when any of these are missing:

- `dashboard/package.json`
- `dashboard/src/app/page.tsx` or equivalent app entry
- successful fresh `npm run build`
- fresh `out/` generated from the same source snapshot

## OSS-facing wording

For public docs and READMEs, use this simplified wording:

> Deploy only from the full dashboard source tree. Generated bundles are outputs, not authority.

## Related docs

- [Dashboard static export deprecation](../migration/dashboard-static-export-deprecation.md)
- [DeerFlow / OpenHanako comparison](../oss/deerflow-openhanako-comparison.md)
