# AI Team Harness

English | [中文说明](./README_zh.md)

Multi-agent orchestration harness focused on **execution**, **observability**, and **deliverable closure**.

## Quick Start

```bash
npm install
cp .env.example .env
npm run smoke:team       # verify everything works
node examples/oss-minimal/product-shell.mjs  # run a demo
```

That's the fastest way to see it in action.

## What It Does

Not a chat-only assistant. A multi-agent runtime where agents **plan**, **execute**, **review**, and **decide** — with a dashboard to watch it all.

- **Planner** → breaks work into tasks
- **Executor** → performs the work
- **Critic** → reviews quality
- **Judge** → makes final decisions

Plus a task dashboard, agent management view, and a deliverable/evidence acceptance loop.

`team-tl-runtime.mjs`：**当前唯一对话 authority ＋ 任务编排主运行时**

## Key Directories

| Path | What |
|---|---|
| `src/agent-harness-core/` | Standalone baseline (no orchestrator) |
| `src/team/` | Runtime & orchestration core |
| `dashboard/` | Web UI |
| `examples/oss-minimal/` | Minimal standalone demo |
| `schemas/` | Public API contracts |
| `scripts/team/` | Smoke tests & validation |

## Key Concepts

- [Execution State & Read-Model Authority](./docs/architecture/execution-state-and-read-model-authority.md) — the UI reads state; it doesn't invent it
- [Product Surface & Delivery Closure](./docs/architecture/execution-product-surface-and-delivery-closure.md) — what counts as "done"
- [Deliverables / Evidence / Acceptance authority](./docs/architecture/deliverables-evidence-acceptance-authority.md) — acceptance boundary
- [Terminal-state / Archive / Evidence boundary](./docs/architecture/terminal-state-archive-evidence-boundary.md) — terminal state
- [Session Capability & Follow-up Fallback](./docs/architecture/session-capability-and-follow-up-fallback.md) — session boundary

## Release & Operations

- [Release Artifacts & Publishing](./docs/architecture/release-artifacts-and-publishing.md)
- [Release Engineering & CI](./docs/architecture/release-engineering-and-ci.md)
- [Release Notes & Provenance](./docs/architecture/release-notes-provenance-and-version-story.md)

## Next Steps

- **[Getting Started](./GETTING-STARTED.md)** — full contributor guide with detailed paths
- **[Architecture](./ARCHITECTURE.md)** — repository layering & boundaries
- **[Dashboard](./dashboard/README.md)** — frontend setup & dev server

## CI Status

[![CI](https://github.com/user/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/user/repo/actions/workflows/ci.yml)

Requires Node 22+. See [GETTING-STARTED.md](./GETTING-STARTED.md) for detailed setup.
