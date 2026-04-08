# OSS Minimal Example

A **minimal runnable baseline** for the standalone Agent Harness.

This example exists to make the harness tangible in a few commands. It is intentionally small, host-neutral, and oriented around the package-owned harness story.

---

## What this example demonstrates

- harness bootstrap and activation
- shell / doctor / status flow
- role-based execution lifecycle
- local runtime adapter usage
- resume/crash-recovery shaped behavior
- a minimal, forkable baseline for independent execution

---

## Quick run

```bash
npm install
npm run demo:oss-minimal
npm run status:oss-minimal
npm run doctor:oss-minimal
```

---

## Why this example exists

This directory is the shortest concrete answer to:

> “What does the standalone harness feel like when I run it locally?”

It is useful for:
- first-time repo readers
- harness-only evaluators
- third-party integrators who want the smallest working baseline
- smoke/regression verification

---

## Key files

| File | Purpose |
|---|---|
| `../../packages/agent-harness/src/standalone-product-runtime.mjs` | canonical runtime/bootstrap entry |
| `product-shell.mjs` | product-facing shell demo |
| `agent-shell.mjs` | shell/doctor/status flow |
| `run-demo.mjs` | runnable demo path |

---

## Position in the repo

This example is:
- a **minimal runnable baseline**
- a **regression facade**
- a **public-facing harness sample**

It is **not** the canonical implementation authority. The canonical substrate lives in:
- `../../packages/agent-harness/`

---

## What to read next

1. `../../packages/agent-harness/README.md`
2. `../../docs/architecture/independent-agent-onboarding.md`
3. `../third-party-agent-sample/README.md`
