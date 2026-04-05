# Mission / Workbench / Deliverables Boundary

> P2 authority for right-panel responsibility split.

## Goal

Keep the execution product surface readable by giving each primary panel a single dominant responsibility.

## Boundary

### Mission
Mission is the **judgment / situational-awareness surface**.

It should emphasize:
- overall state and confidence
- current driver and latest decision posture
- why the task matters now
- timeline / stage narrative
- whether human intervention or direct acceptance is appropriate

Mission must **not** become the default action console or the artifact archive browser.

### Workbench
Workbench is the **execution / coordination surface**.

It should emphasize:
- control actions
- execution structure
- follow-up / replan / retry orchestration
- people, routing, session, and execution-surface context
- progress guidance that helps the operator continue the run

Workbench may show lightweight delivery signals for context, but it must **defer final acceptance and artifact closure** to Deliverables.

### Deliverables
Deliverables is the **acceptance / closure surface**.

It should emphasize:
- final artifacts
- evidence and review signals
- acceptance-ready summary
- archive / output / handoff material
- closure status and operator-facing final confirmation

Deliverables should be the preferred default landing surface when the shared read-model marks a task as ready for direct acceptance.

## Navigation authority

The right panel should prefer a shared source-level recommendation instead of ad-hoc UI guesses.

Current rule:
- task cards / dashboard cards may expose `recommendedSurface`
- `RightPanel` should use `recommendedSurface` as the default detail tab when no explicit focus target overrides it
- task-card CTA copy should reflect the same recommended surface

## One-line rule

Mission judges, Workbench drives, Deliverables closes.
