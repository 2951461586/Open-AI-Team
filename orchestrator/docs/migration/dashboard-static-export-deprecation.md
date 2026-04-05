# Dashboard Static Export Deprecation

## Status

`dashboard-static-export` is now a **deprecated fallback surface**.

It may remain temporarily for:
- release artifact inspection
- migration notes
- debugging stale bundles
- historical provenance checks

It must no longer act as the recommended or default production deployment entry.

## Why this is being deprecated

Historical `dashboard-static-export` bundles created two conflicting truths:

1. the dashboard source tree said one thing
2. a previously exported static bundle said another thing

That split makes it too easy to deploy stale UI.

## New rule

Production deployment authority is now:

- build from the complete `dashboard/` source tree
- verify the new bundle
- publish the fresh build outputs

Never use `.release-artifacts/dashboard-static-export/` as the deciding source of truth.

## What “downgrade the old entry” means in practice

### Allowed
- keep old static exports as generated artifacts
- keep README notes that mark them as deprecated
- inspect them when comparing release provenance

### Not allowed
- using old static exports as the default deployment tutorial
- shipping them because the source tree is incomplete
- treating them as a safe fallback for production freshness

## Migration checklist

- [x] document the deprecation explicitly
- [x] define source-tree-only deployment authority
- [ ] add deploy helper guards that refuse stale fallback deploys
- [ ] remove any README wording that presents static export as the preferred path
- [ ] remove remaining operational habits that equate “artifact exists” with “current source is deployed”
