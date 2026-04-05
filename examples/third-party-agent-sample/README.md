# Third-Party Agent Sample

This sample is the **productized template** for external independent-agent onboarding.

## Goal

Show that a third-party agent can integrate through explicit contracts instead of host-private runtime knowledge.

## Included Files

- `agent-manifest.json`
- `agent-package.json`
- `agent-shell.mjs`

## Usage

Treat these files as a minimal forkable **productized template** for external agent onboarding.

If you are new to the repository, read these first:
- `../README.md`
- `../GETTING-STARTED.md`
- `../src/agent-harness-core/README.md`

They are intentionally:
- host-neutral
- provider-neutral
- free of private node names
- free of OpenClaw-only assumptions

## Productized validation path

```bash
npm run validate:third-party-agent
npm run smoke:third-party-agent
node examples/third-party-agent-sample/agent-shell.mjs package
node examples/third-party-agent-sample/agent-shell.mjs onboarding
```

## What this template now demonstrates

- productized `agent manifest` contract
- productized `agent package` contract
- provider-registry-facing onboarding shape
- explicit `session / desk / host-layer / bridge / capability gate / lifecycle / shell` surfaces
- shell wrapper for package/onboarding/doctor entrypoints
- validator-compatible external onboarding template

## Public Contract Alignment

This sample now aligns with the public schema layer under `schemas/`:

- `schemas/agent-manifest.schema.json`
- `schemas/agent-package.schema.json`
- `schemas/work-item.schema.json`
- `schemas/run-report.schema.json`
- `schemas/artifact-manifest.schema.json`
- `schemas/completion-result.schema.json`
- `schemas/artifact-file-response.schema.json`
- `schemas/dashboard-task-card.schema.json`
- `schemas/dashboard-node-summary.schema.json`
- `schemas/dashboard-thread-summary.schema.json`
- `schemas/dashboard-timeline-entry.schema.json`

This means a third-party sample is no longer only a backend/runtime example; it is also expected to stay compatible with the dashboard read model and public contract surface.
