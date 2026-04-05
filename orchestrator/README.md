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

### Product & architecture
- [中文总览 / README_zh.md](./README_zh.md)
- [Dashboard source authority & deployment](./docs/deploy/dashboard-source-authority.md)
- [Dashboard static export deprecation note](./docs/migration/dashboard-static-export-deprecation.md)
- [OSS comparison: DeerFlow / OpenHanako / AI Team](./docs/oss/deerflow-openhanako-comparison.md)

### Practical entry points
- `dashboard/` — full dashboard source tree
- `examples/oss-minimal/` — minimal standalone harness example
- `.release-artifacts/` — generated outputs only, not source authority

## Deployment authority

**Single authority rule:** production dashboard deployment must originate from the **full dashboard source tree**, then build, then deploy.

Authoritative source boundary:
- `dashboard/src/`
- `dashboard/public/`
- `dashboard/package.json`
- `dashboard/package-lock.json`
- dashboard build config files

Non-authoritative surfaces:
- `.release-artifacts/dashboard-static-export/`
- copied static bundles
- ad-hoc exported `out/` directories
- stale local mirrors under `/srv/*`

If a generated bundle disagrees with the source tree, trust the source tree and rebuild.

## Recommended deploy flow

```bash
cd orchestrator/dashboard
npm ci
npm run build
# then publish the fresh ./out bundle to your hosting target
```

See: [docs/deploy/dashboard-source-authority.md](./docs/deploy/dashboard-source-authority.md)

## Open-source cleanup direction

Compared with DeerFlow's strong harness substrate and OpenHanako's more independently pluggable agent-facing UI ideas, this project is currently prioritizing:

1. single runtime / event / deployment authority
2. less OpenClaw-specific coupling
3. fewer historical fallback surfaces
4. clearer public OSS contracts and release surfaces

See the formal checklist: [docs/oss/deerflow-openhanako-comparison.md](./docs/oss/deerflow-openhanako-comparison.md)
