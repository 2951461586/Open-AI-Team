# Runtime Artifact and Noise Boundary

> This document defines which generated directories are runtime/build artifacts rather than product authority.

## Non-authoritative generated surfaces

The following paths are generated or runtime-local and must not be treated as repository/product authority:

- `dashboard/.next/`
- `dashboard/out/`
- `run/`
- `tmp/`
- `.tmp/`
- `.tmp-skill-registry/`
- `.tmp-skill-registry-2/`
- `examples/**/.runs/`
- `examples/**/.shared/`

## Rules

1. These paths are **rebuildable** or **runtime-local**.
2. They are excluded from the public product story and release narrative.
3. Cleanup of these paths is safe when no live process depends on them.
4. If a script needs them, it must recreate them rather than relying on committed state.

## Product-authoritative alternatives

- source authority: `src/`, selected `packages/`, selected `apps/`
- public examples: `examples/`
- public schemas/contracts: `schemas/`
- public docs: `README.md`, `GETTING-STARTED.md`, `ARCHITECTURE.md`, `docs/architecture/`

## Release rule

Release-facing docs and packaging scripts must not imply that generated runtime directories are part of the shipped product surface.
