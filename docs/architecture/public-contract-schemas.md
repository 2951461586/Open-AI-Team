# Public Contract Schemas

This document marks the first public schema surface for external contributors.

## Scope

The following contract files are treated as public, reviewable repository assets:

- `src/agent-harness-core/oss-agent-manifest.json`
- `src/agent-harness-core/oss-agent-package.json`
- `config/team/roles.json`

## Publication Rule

Until dedicated JSON Schema files are split out, these JSON documents act as the canonical contract examples for:

- runtime bootstrap and worker wiring
- host / session / desk / bridge / shell contracts
- plugin references and capability gates
- role contracts and deployment hints

## Current Schema Files

The repository now includes public schema files under `schemas/`:

- `schemas/agent-manifest.schema.json`
- `schemas/agent-package.schema.json`
- `schemas/team-ingress-envelope.schema.json`
- `schemas/work-item.schema.json`
- `schemas/run-report.schema.json`
- `schemas/artifact-manifest.schema.json`
- `schemas/completion-result.schema.json`
- `schemas/completion-envelope.schema.json`
- `schemas/artifact-file-response.schema.json`
- `schemas/dashboard-task-card.schema.json`
- `schemas/dashboard-node-summary.schema.json`
- `schemas/dashboard-thread-summary.schema.json`
- `schemas/dashboard-timeline-entry.schema.json`
- `schemas/dashboard-board-payload.schema.json`
- `schemas/dashboard-dashboard-payload.schema.json`
- `schemas/dashboard-nodes-payload.schema.json`
- `schemas/dashboard-threads-payload.schema.json`
- `schemas/dashboard-thread-detail-payload.schema.json`
- `schemas/dashboard-workbench-payload.schema.json`
- `schemas/dashboard-resident-registry.schema.json`
- `schemas/dashboard-summary-payload.schema.json`
- `schemas/dashboard-pipeline-payload.schema.json`
- `schemas/dashboard-control-payload.schema.json`
- `schemas/event-log.schema.json`
- `schemas/stream-log.schema.json`
- `schemas/bridge-state.schema.json`
- `schemas/run-state.schema.json`
- `schemas/fixture-provenance.schema.json`
- `schemas/published-route-catalog.schema.json`

## Current Alignment Focus

The current contract publication wave is aligning three surfaces together:

1. **runtime / execution core** — work item and run report
2. **third-party independent agent onboarding** — manifest / package / host/session/desk contracts
3. **frontend read model** — dashboard task card / node summary / thread / timeline / workbench / residents / summary / pipeline / control

## Next Step

Extend the public schema set with versioned validation for:

- role contract
- stronger SDK / route-catalog examples around published payload schemas
- derive more fixtures from real route/runtime outputs, not only curated minimal fixtures
- validate fuller real-run published samples and provenance alongside canonical fixtures
