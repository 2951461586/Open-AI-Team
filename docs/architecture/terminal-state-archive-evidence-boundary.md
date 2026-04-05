# Terminal State / Archive / Evidence Boundary

> P4 authority for terminal-state closure, archive visibility, and evidence retrieval.

## Goal

P4 closes the gap left after P3:

- Deliverables already owns acceptance.
- Workbench already exposes terminal hints.
- But terminal-state / archive / evidence retrieval were not yet fully unified behind one shared source.

P4 makes `deliveryClosure` the shared authority for:

- terminal-state semantics
- archive eligibility / archive route
- evidence retrieval route / blocking evidence posture

## Shared authority

The source authority remains shared task observability.
UI surfaces must consume these fields from shared `deliveryClosure`:

- `terminalState.isTerminal`
- `terminalState.terminalKind`
- `terminalState.headline`
- `terminalState.operatorHint`
- `terminalState.archiveEligible`
- `terminalState.archiveStatus`
- `terminalState.archiveRoute`
- `evidenceRetrieval.route`
- `evidenceRetrieval.totalCount`
- `evidenceRetrieval.reviewIssueCount`
- `evidenceRetrieval.blockingCount`
- `evidenceRetrieval.recommendedSection`
- `evidenceRetrieval.preferredSource`

## Boundary

### Workbench
Workbench may summarize terminal posture and route the operator onward.
It must not invent its own terminal truth separate from shared observability.

### Deliverables
Deliverables remains the acceptance surface, and now also becomes the first-class evidence retrieval surface for terminal review.
It should show:
- blocking evidence
- supporting evidence
- final deliverables
- archive-oriented closure hints

### Archive route
Archive is a visibility/index surface.
It should not redefine whether a task is terminal or whether evidence is blocking.

## One-line rule

**Terminal-state meaning comes from shared observability; Archive lists it, Deliverables verifies it, Workbench routes to it.**
