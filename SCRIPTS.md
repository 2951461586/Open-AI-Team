# Monorepo Migration Guide

This repository now includes a **planning-only monorepo scaffold**.

Important:
- `src/` has **not** been moved.
- Existing code paths remain in place.
- `dashboard/` remains where it is today.
- The new `packages/` and `apps/` directories are placeholders for a future migration.

## Target Structure

```text
.
├── apps/
│   ├── api-server/
│   ├── cli/
│   └── dashboard/
├── packages/
│   ├── agent-harness/
│   ├── event-bus/
│   ├── im-channels/
│   ├── memory/
│   ├── skills/
│   ├── team-core/
│   ├── team-runtime/
│   └── tools/
├── src/                  # legacy flat source tree, untouched for now
├── dashboard/            # existing frontend, untouched for now
├── package.json
└── pnpm-workspace.yaml
```

## What Was Added

- Root `package.json` with workspace configuration
- `pnpm-workspace.yaml`
- Placeholder package directories under `packages/`
- Placeholder app directories under `apps/`
- README files describing ownership and migration intent

## What Was Not Changed

To keep this safe and reversible, the scaffold intentionally avoids:
- moving files from `src/`
- moving the existing `dashboard/`
- rewriting imports
- changing runtime entrypoints
- splitting dependencies package-by-package

## Recommended Migration Sequence

Migrate in small, reviewable slices.

### Phase 0 — Install workspace tooling

```bash
pnpm install
```

If pnpm is not installed:

```bash
npm install -g pnpm
```

### Phase 1 — Move contracts and shared schemas first

Candidate mappings from current `src/` tree:

- `src/team-core/*` → `packages/team-core/`
- shared contracts from `src/team/*` → `packages/team-core/` or `packages/team-runtime/`

Suggested steps:

1. Create `packages/team-core/package.json`
2. Move type/schema/contract files only
3. Export them from a single package entrypoint
4. Update imports in legacy code to consume the new package
5. Run smoke tests before continuing

Example command pattern:

```bash
mkdir -p packages/team-core/src
# then move files intentionally, one reviewed batch at a time
```

### Phase 2 — Extract runtime/orchestration

Likely targets:

- `src/team-runtime-adapters/*` → `packages/team-runtime/`
- orchestration/runtime modules from `src/team/*` → `packages/team-runtime/`

Keep runtime extraction separate from transport adapters when possible.

### Phase 3 — Extract harness substrate

Likely targets:

- `src/agent-harness-core/*` → `packages/agent-harness/`

This package should become the execution substrate: worker lifecycle, sandboxing, plugin/tool runtime, host integration.

### Phase 4 — Extract cross-cutting subsystems

Potential future homes:

- memory logic → `packages/memory/`
- tool provider registry/adapters → `packages/tools/`
- event/session bus concerns → `packages/event-bus/`
- IM/chat integrations → `packages/im-channels/`
- skill loading/runtime concerns → `packages/skills/`

Do **not** force these early if boundaries are still unstable.

### Phase 5 — Stand up app packages

#### `apps/api-server/`

Goal:
- become the home for the existing server/API entrypoints
- eventually absorb `src/index.mjs` and route assembly

Suggested eventual contents:

- `apps/api-server/src/server.*`
- `apps/api-server/src/routes/*`
- app-local config/bootstrap files

#### `apps/dashboard/`

Goal:
- eventually replace the current top-level `dashboard/`
- migrate only after frontend build and deployment paths are reviewed

Suggested migration approach:

```bash
# planning only — do not run blindly
mkdir -p apps/dashboard
# copy or move after validating CI, env files, and Next.js assumptions
```

Checklist before moving dashboard:
- audit `.env*` usage
- audit CI/CD build paths
- audit deployment scripts under `scripts/deploy/`
- confirm Next.js output assumptions
- remove or update any `cd dashboard` scripts

#### `apps/cli/`

Goal:
- future home for operator tooling, diagnostics, bootstrap, and developer commands

### Phase 6 — Add per-package manifests

For each package/app, add a local `package.json` with:
- `name`
- `version`
- `private` (if appropriate)
- `type`
- `main`/`exports`
- `scripts`
- local dependencies

Example starter:

```json
{
  "name": "@ai-team-harness/team-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.mjs",
  "scripts": {
    "build": "echo build team-core",
    "test": "echo test team-core",
    "lint": "echo lint team-core"
  }
}
```

### Phase 7 — Replace legacy root scripts gradually

The root scripts now provide generic workspace entrypoints:

- `pnpm run dev`
- `pnpm run build`
- `pnpm run test`
- `pnpm run lint`

These are safe now because they use `--if-present`.

As packages are introduced, each package/app can define its own scripts and start participating automatically.

## Suggested Source Mapping

This is a planning map, not a command list.

| Current area | Likely destination |
|---|---|
| `src/team-core/` | `packages/team-core/` |
| `src/team-runtime-adapters/` | `packages/team-runtime/` |
| `src/agent-harness-core/` | `packages/agent-harness/` |
| `src/routes/` | `apps/api-server/` |
| `src/index*.mjs` | `apps/api-server/` |
| `src/team/` | split between `packages/team-runtime/`, `packages/memory/`, `packages/event-bus/`, `packages/skills/` depending on responsibility |
| top-level `dashboard/` | `apps/dashboard/` |

## Migration Safety Rules

1. Move one boundary at a time.
2. Keep commits small and reviewable.
3. Prefer export shims over massive import rewrites.
4. Run smoke tests after each logical slice.
5. Do not mix frontend migration with backend package extraction.
6. Expect circular dependencies to appear; resolve them before moving more code.
7. Keep deployment scripts working until replacements are verified.

## Useful Commands During Migration

Inspect dependencies:

```bash
rg "from '|from \"|import\(" src
```

Find package candidates:

```bash
find src -maxdepth 2 -type d | sort
```

Review dashboard coupling:

```bash
rg "dashboard|cd dashboard|next" scripts package.json .
```

Run legacy server entrypoint:

```bash
node src/index.mjs
```

Run workspace scripts safely:

```bash
pnpm run build
pnpm run test
pnpm run lint
```

## Notes on the Current Scaffold

- The root `package.json` is now marked `private: true` because it acts as a workspace root.
- Legacy commands were preserved under compatibility-style names where helpful.
- `apps/api-server/` is currently a placeholder even though the migration target is already defined in workspaces.

## Next Recommended Step

The cleanest first real migration is probably:

1. `packages/team-core`
2. `packages/agent-harness`
3. `packages/team-runtime`
4. `apps/api-server`
5. `apps/dashboard`

That order keeps contracts first, substrate second, orchestration third, and app assembly last.
