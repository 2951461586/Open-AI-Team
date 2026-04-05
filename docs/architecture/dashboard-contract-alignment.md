# Dashboard Contract Alignment

## Goal

Keep dashboard/frontend adaptation aligned with the public runtime contract surface instead of private host-only fields.

## Active Public Read Models

The dashboard should treat the following as active public contracts:

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
- `schemas/artifact-manifest.schema.json`
- `schemas/artifact-file-response.schema.json`
- `schemas/run-report.schema.json`
- `schemas/completion-result.schema.json`
- `schemas/completion-envelope.schema.json`

## Mapping

### Task list / board
- frontend type: `dashboard/src/lib/types.ts -> TaskCard`
- public schema: `schemas/dashboard-task-card.schema.json`

### Node overview / node panel
- frontend type: `dashboard/src/lib/types.ts -> NodeSummary`
- public schema: `schemas/dashboard-node-summary.schema.json`

### Thread list / thread summary
- frontend type: `dashboard/src/lib/types.ts -> ThreadSummaryItem`
- public schema: `schemas/dashboard-thread-summary.schema.json`

### Timeline / event history
- frontend type: `dashboard/src/lib/types.ts -> TimelineEntry`
- public schema: `schemas/dashboard-timeline-entry.schema.json`

### Workbench / task deep view
- route: `/state/team/workbench`
- public schema: `schemas/dashboard-workbench-payload.schema.json`

### Resident registry
- route: `/state/team/residents`
- public schema: `schemas/dashboard-resident-registry.schema.json`

### Summary / task top-line state
- route: `/state/team/summary`
- public schema: `schemas/dashboard-summary-payload.schema.json`

### Pipeline / phase progression
- route: `/state/team/pipeline`
- public schema: `schemas/dashboard-pipeline-payload.schema.json`

### Control / manual interventions
- route: `/state/team/control`
- public schema: `schemas/dashboard-control-payload.schema.json`

### Runtime observability logs
- runtime output: `runtime/event-log.json` and `runtime/stream-log.json`
- public schemas: `schemas/event-log.schema.json`, `schemas/stream-log.schema.json`

### Artifact panel / file links
- frontend consumption: artifact payload normalization in dashboard panels
- public schema: `schemas/artifact-manifest.schema.json`
- file fetch response schema: `schemas/artifact-file-response.schema.json`

### Standalone / independent agent evidence
- runtime output: run directories and run reports
- public schema: `schemas/run-report.schema.json`

### Completion / structured member result
- TL/member completion parsing: `src/team/tl-runtime/completion.mjs`
- public schema: `schemas/completion-result.schema.json`
- completion event envelope schema: `schemas/completion-envelope.schema.json`

## Compatibility Rule

Legacy compat fields may still be normalized in the frontend adapter layer, but:

- they must not be expanded as primary public field names
- dashboard docs and examples must prefer `controlPlane*` and `control*` fields
- third-party samples should target the public schema layer first

## Next Work

- extend route-catalog/SDK examples to cover newly published payload schemas even more explicitly
- grow fixture set with route-derived snapshots instead of only canonical hand-written fixtures
- add fuller real-run fixtures for bridge-state / run-state / event-log families
