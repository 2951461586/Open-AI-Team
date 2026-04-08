# Third-Party Agent Sample

A **host-neutral productized template** for external independent agents.

This sample is the public-facing answer to:

> “How do I integrate an agent into this ecosystem without learning private host/session internals?”

---

## What this sample demonstrates

- explicit agent manifest and agent package contracts
- shell-driven onboarding path
- doctor/package/onboarding entrypoints
- session / desk / bridge / lifecycle / capability-gate surfaces
- compatibility with public schema and dashboard-facing read models

---

## Included files

- `agent-manifest.json`
- `agent-package.json`
- `agent-shell.mjs`

---

## Validation path

```bash
npm install
npm run validate:third-party-agent
npm run smoke:third-party-agent
node examples/third-party-agent-sample/run-demo.mjs --start-only
node examples/third-party-agent-sample/agent-shell.mjs package
node examples/third-party-agent-sample/agent-shell.mjs onboarding
```

---

## Why this matters

This sample turns “independent agent onboarding” from a documentation claim into something you can actually see:
- explicit package/manifest shapes
- shell-driven activation
- public-safe contract alignment
- no OpenClaw-only assumptions

That is what makes the onboarding story externally credible.

---

## Public contract alignment

This sample aligns with public schemas under `schemas/`, including:
- agent/package contracts
- work item / run report contracts
- artifact and completion contracts
- dashboard-facing task/node/thread/timeline read models

This means the sample is not only a runtime example. It is also a public contract example.

---

## What to read next

1. `../../packages/agent-harness/README.md`
2. `../../docs/architecture/independent-agent-onboarding.md`
3. `../../docs/oss/open-source-release-engineering.md`
