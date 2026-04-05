# Memory Surface

> Maintainer/internal continuity, daily notes, and derived memory-compiler state.

## What lives here

This directory currently contains two kinds of material:

1. **Daily / historical memory notes**
   - files such as `2026-03-24.md`, `2026-03-24-dashboard-audit.md`
   - working notes, continuity breadcrumbs, and historical context

2. **Derived memory-compiler outputs and control-plane state**
   - `compiler/`
   - reports, indexes, session-pack state, scheduler state, and related derived artifacts

## Boundary

`memory/` may remain in-tree during transition, but it is **not** part of the default public product story.

Treat it as:
- useful for maintainers / continuity work
- background or derived state
- non-authoritative for public product boundaries
- not a substitute for public examples, public schemas, or product docs

## If you are a new contributor

Start with:
- `../README.md`
- `../GETTING-STARTED.md`
- `../ARCHITECTURE.md`
- `../docs/architecture/`

For public-safe runnable examples, prefer:
- `../examples/`
- `../fixtures/public-contracts/`

## Rule of thumb

If `memory/` disagrees with a current authority doc, prefer the current authority doc.
