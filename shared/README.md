# Shared

This directory is **not currently a primary product authority surface**.

At the moment it should be treated as a low-authority shared/output area rather than a stable public module boundary.

## Rule

- do not treat `shared/` as equivalent to `packages/` or `src/`
- do not place new core product logic here by default
- if a real shared boundary is needed later, use a more explicit name and ownership model

## Hygiene note

If this directory only contains generated artifacts or sync logs, it should be considered cleanup debt rather than a long-term product surface.
