# Open-Source Release Engineering

This document describes the non-code work required to keep the repository credible as an open-source product.

Open-source readiness here is not only about implementation. It also depends on:
- product-facing documentation
- public-safe boundaries
- example validity
- release surface clarity
- smoke and validation coverage
- optional integration containment

---

## 1. Release story

The public release story is:

- **Primary product** = AI Team Runtime + Dashboard
- **Reusable substrate** = Agent Harness
- **Optional integrations** = OpenClaw / channel / host-specific wiring
- **Historical material** = archive only

Anything that makes the repository feel OpenClaw-first, QQ-first, or maintainer-host-first weakens the open-source release story.

---

## 2. What must stay aligned before release

## A. Product docs
These should agree with each other:
- `README.md`
- `GETTING-STARTED.md`
- `ARCHITECTURE.md`
- `docs/architecture/product-surface-and-repo-map.md`
- `docs/oss/repo-authority.md`
- `docs/oss/what-is-ai-team-runtime.md`

## B. Package docs
These should reflect real authority and real runnable paths:
- `packages/agent-harness/README.md`
- `packages/team-runtime/README.md`
- `examples/oss-minimal/README.md`
- `examples/third-party-agent-sample/README.md`

## C. Public examples and schemas
These should remain valid together:
- `examples/oss-minimal/`
- `examples/third-party-agent-sample/`
- `schemas/`

## D. Release boundaries
These should remain explicit:
- public product surfaces
- optional integrations
- maintainer/private surfaces
- archive/historical surfaces

---

## 3. Minimum release checklist

### Product and package clarity
- [ ] README describes the product family correctly
- [ ] GETTING-STARTED offers clear entry paths
- [ ] ARCHITECTURE reflects current public layering
- [ ] package READMEs describe real authority

### Runnable credibility
- [ ] `npm run smoke:team`
- [ ] `npm run smoke:oss-minimal`
- [ ] `npm run validate:third-party-agent`
- [ ] `npm run smoke:third-party-agent`

### Public contract credibility
- [ ] public schemas are current
- [ ] examples match schemas
- [ ] dashboard-facing read-model references are still accurate

### Boundary hygiene
- [ ] optional integrations are not presented as the default story
- [ ] `plugins/`, `services/`, `electron/`, `projects/`, and `shared/` are not presented as primary product authority
- [ ] runtime/generated directories such as `state/`, `data/`, `run/`, `logs/`, `tmp/`, `artifacts/`, and `reports/` are not promoted in public docs
- [ ] private/maintainer-local paths are not promoted in public docs
- [ ] historical docs stay in archive

---

## 4. Optional integration rule

Optional integrations are allowed in-tree, but they must not dominate the release narrative.

That means:
- they should be framed as optional
- they should not redefine the top-level reading order
- public docs should remain runnable without assuming those integrations

---

## 5. Dashboard release rule

The dashboard should be presented as an execution visibility surface, not just a chat UI.

Release-facing docs should reinforce that it helps surface:
- task/workbench flow
- timeline/progress
- runtime visibility
- artifacts/evidence/review state

---

## 6. Why this document exists

Large repos often improve their code structure while their public story drifts.
This document exists to prevent that drift.

The question before release is not only:

> “Does the code work?”

It is also:

> “Does the repository still tell the truth, quickly, to an external reader?”
