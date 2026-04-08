# @ai-team/dashboard-app

Secondary app-packaging surface for the dashboard line.

## Current status

- the current primary dashboard product authority lives at `dashboard/`
- `apps/dashboard/` is not the canonical UI implementation path
- keep this directory secondary until the dashboard authority is actually moved

## Public rule

When documenting the current product:
- point readers to `dashboard/` first
- describe `apps/dashboard/` as secondary packaging surface
- do not let optional plugin/service/electron/project surfaces leak into the dashboard mainline narrative through this directory

## Read next

- `../../README.md`
- `../../ARCHITECTURE.md`
- `../../docs/oss/dashboard-observability-surface.md`
