# AI Team Harness

English | [中文说明](./README_zh.md)

Multi-agent orchestration harness focused on **execution**, **observability**, and **deliverable closure**.

## What this repository is for

AI Team Harness is not a chat-only assistant shell. It is a product-facing multi-agent runtime surface built around:

- **Planner** — break work down
- **Executor** — perform work
- **Critic** — review quality and gaps
- **Judge** — make the final decision

It also includes:

- dashboard / workbench UI
- agent management view
- runtime / release contracts
- release notes / provenance / version story
- OSS minimal harness example

## Start here

### Product & authority
- [中文总览 / README_zh.md](./README_zh.md)
- [Dashboard UI surface](./dashboard/README.md)
- [Release engineering & CI](./docs/architecture/release-engineering-and-ci.md)
- [Release artifacts & publishing](./docs/architecture/release-artifacts-and-publishing.md)
- [Dashboard source authority & deployment](./docs/deploy/dashboard-source-authority.md)
- [Dashboard static export deprecation note](./docs/migration/dashboard-static-export-deprecation.md)
- [OSS comparison: DeerFlow / OpenHanako / AI Team](./docs/oss/deerflow-openhanako-comparison.md)
- [Docs index](./docs/index.md)

### Practical entry points
- `dashboard/` — full dashboard source tree
- `examples/oss-minimal/` — minimal standalone harness example
- `.release-artifacts/` — generated outputs only, not source authority

### Repo surface map
- **Primary product surfaces** — `src/`, `dashboard/`, `docs/architecture/`, `schemas/`
- **Public examples / samples** — `examples/`, `fixtures/`
- **Secondary / maintainer surfaces** — `config/team/`, `docs/ops/`, `scripts/ops/`, `scripts/acceptance/`
- **Background / continuity surfaces** — `references/`, `memory/`
- **Historical surface** — `docs/archive/`

## Deployment authority

**Single authority rule:** production dashboard deployment must originate from the **full dashboard source tree**, then build, then deploy.

Authoritative source boundary:
- `dashboard/src/`
- `dashboard/public/`
- `dashboard/package.json`
- `dashboard/package-lock.json`
- dashboard build config files

Non-authoritative surfaces:
- historical `dashboard-static-export` bundles / paths
- copied static bundles
- ad-hoc exported `out/` directories
- stale local mirrors under `/srv/*`

If a generated bundle disagrees with the source tree, trust the source tree and rebuild.

## Recommended deploy flow

```bash
cd dashboard
npm ci
npm run build
# then publish the fresh ./out bundle to your hosting target
```

Or use the authority guard script:

```bash
bash scripts/deploy/dashboard-from-source.sh
```

See: [docs/deploy/dashboard-source-authority.md](./docs/deploy/dashboard-source-authority.md)

## Repo layering

Current public-facing repo layers:

- `src/` — runtime / orchestration core
- `dashboard/` — product UI surface
- `examples/` — runnable public examples
- `scripts/` — validation, release, deploy, acceptance helpers
- `docs/` — current authority docs
- `.release-artifacts/` — generated outputs only

Working directories such as `run/`, `state/`, and local bundles are runtime residue, not product authority.
Maintainer/private operational material may also remain in-tree during transition, but it is a secondary maintainer context rather than the public product authority.

## Open-source cleanup direction

Compared with DeerFlow's strong harness substrate and OpenHanako's more independently pluggable agent-facing UI ideas, this project is currently prioritizing:

1. single runtime / event / deployment authority
2. less OpenClaw-specific coupling
3. fewer historical fallback surfaces
4. clearer public OSS contracts and release surfaces

See the formal checklist: [docs/oss/deerflow-openhanako-comparison.md](./docs/oss/deerflow-openhanako-comparison.md)
