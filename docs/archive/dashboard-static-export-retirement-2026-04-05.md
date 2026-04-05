# Dashboard Static Export Retirement — 2026-04-05

## Decision

The historical `.release-artifacts/dashboard-static-export/` directory is retired from the repository mainline.

## Why

Keeping a visible repo path for stale static exports created a second pseudo-authority next to the real dashboard source tree.
That made it too easy to confuse:

1. current source truth
2. historical generated bundle

## What changed

- production deploy authority remains the full `dashboard/` source tree
- the old directory is removed from the repo surface
- retirement context stays in docs instead of a half-alive artifact directory

## Surviving references

References may still appear in:

- deployment authority docs
- migration notes
- provenance / release history notes

Those references are historical only and do not restore the old path as a supported repo surface.

## Follow-up

- keep `.release-artifacts/` focused on generated release outputs only
- avoid keeping deprecated subdirectories around as empty shells
- prefer explicit retirement notes over zombie directories
