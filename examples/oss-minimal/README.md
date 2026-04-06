# OSS Minimal Example

A standalone agent harness demo — no orchestrator, no dashboard, no host dependencies.

## Quick Run

```bash
npm install
npm run demo:oss-minimal     # run the demo
npm run status:oss-minimal   # check status
npm run doctor:oss-minimal   # health check
```

## What It Shows

- Agent lifecycle (bootstrap → activation → execution → completion)
- Plugin system and provider registry
- Local runtime adapter (no external broker needed)
- Role-based task execution
- Crash/resume behavior

## Key Files

| File | Purpose |
|---|---|
| `../../src/agent-harness-core/standalone-product-runtime.mjs` | Canonical bootstrap/runtime entry |
| `product-shell.mjs` | Interactive shell |
| `agent-shell.mjs` | Agent lifecycle demo |
| `run-demo.mjs` | Full demo runner |

## What This Is Not

This is a **wrapper / regression facade / runnable sample**, not the canonical standalone runtime. The actual substrate lives in `src/agent-harness-core/`.

## Regression

This directory also serves as a regression facade. Run `.runs/` artifacts stay out of git.

```bash
npm run smoke:oss-minimal
```
