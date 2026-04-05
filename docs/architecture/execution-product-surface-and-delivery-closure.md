# Execution Product Surface and Delivery Closure

> P1 authority document for turning execution read-models into stable product surfaces.

---

## Goal

P1 is not only about showing more data.
It is about giving the dashboard a **single shared delivery-closure object** so that:

- mission view
- workbench
- pipeline
- deliverable view
- timeline navigation

all speak the same product language.

---

## Shared product object

The primary P1 product object is `deliveryClosure`.

It is derived in shared route logic and may be projected into multiple product surfaces.

Current canonical fields:

- `deliverableReady`
- `humanInterventionReady`
- `deliveryStatus`
- `interventionStatus`
- `issueCount`
- `revisionCount`
- `artifactCount`
- `evidenceCount`
- `nextBestAction`
- `executiveSummary`
- `acceptanceState`
- `recommendedSurface`

---

## Authority rule

`deliveryClosure` must be derived from execution authority, not invented inside the UI.

Allowed source path:

1. durable task facts
2. shared route derivation (`task-observability-shared.mjs`)
3. route payloads (`summary`, `workbench`, `pipeline`)
4. dashboard rendering

Disallowed pattern:

- each panel re-deriving its own closure truth
- tabs disagreeing on whether a task is ready / blocked / waiting for human decision
- timeline being present in data but hidden from the main product path

---

## Product-surface rule

### Mission
Shows current judgment and recommended operator move.

### Workbench
Shows closure detail, action context, and operating surface.

### Pipeline
Shows phase/state progression plus the same closure snapshot.

### Timeline
Must be directly reachable from the main mission product path.
It is not a hidden secondary debug-only surface anymore.

### Deliverables
Should act as the final acceptance surface when `deliveryClosure.deliverableReady === true`.

---

## One-line rule

**P1 product surfaces may differ in presentation, but they must share one delivery-closure truth.**
