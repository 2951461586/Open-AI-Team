# Deliverables / Evidence / Acceptance Authority

> P3 authority for turning Deliverables into the final acceptance surface.

---

## Goal

P3 finishes the product split started in P1/P2:

- Mission judges
- Workbench drives
- Deliverables closes

The Deliverables surface must stop behaving like a generic artifact list.
It should become the **operator-facing final acceptance surface**.

---

## Deliverables surface responsibility

Deliverables should answer these questions first:

1. **Can this task be accepted now?**
2. **What final deliverables are ready for review/export?**
3. **What evidence supports acceptance or blocks it?**
4. **What is the operator expected to do next: accept, wait, inspect, or send back?**

Deliverables may still expose process records for traceability,
but process trace must remain secondary to final acceptance.

---

## Shared acceptance authority

The source authority remains the shared `deliveryClosure` read-model.

P3 depends on these canonical fields:

- `deliverableReady`
- `humanInterventionReady`
- `deliveryStatus`
- `interventionStatus`
- `artifactCount`
- `evidenceCount`
- `issueCount`
- `revisionCount`
- `acceptanceState`
- `recommendedSurface`
- `nextBestAction`
- `executiveSummary`

UI surfaces must not invent a separate acceptance truth.

---

## Acceptance-state rule

Current product-facing interpretation:

- `ready_for_acceptance` → Deliverables is the preferred default surface
- `needs_human_decision` → Mission remains the preferred judgment surface
- `needs_issue_resolution` → Deliverables should show blocking evidence and unresolved issues
- `in_progress` → Workbench / Timeline may remain better default views

---

## Panel boundary rule

### Mission
Should say whether the operator ought to inspect or accept.
It must not become the final artifact archive browser.

### Workbench
Should continue to show action context and execution guidance.
It may point to Deliverables when acceptance is near,
but it must not act like the final acceptance console.

### Deliverables
Should present:
- acceptance status
- final deliverables
- blocking evidence / review issues
- export / preview entrypoints
- a clear operator-facing acceptance recommendation

---

## One-line rule

**Deliverables is the acceptance authority surface; Mission and Workbench may guide toward closure, but they do not replace closure.**
