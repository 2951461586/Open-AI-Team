# What is AI Team Runtime?

AI Team Runtime is an open-source **team-oriented multi-agent runtime** for complex task execution.

It is designed for work that needs more than “chat with tools”:
- planning
- delegation
- review
- evidence-driven delivery
- operator visibility
- follow-up and closure

---

## One-sentence definition

> AI Team Runtime is a TL-first runtime that routes work through a team-style execution model and treats artifacts, evidence, review, and acceptance as first-class outputs.

---

## Core ideas

## 1. TL-first
Every meaningful request enters a Team Leader runtime first.
The TL decides whether to:
- answer directly
- confirm task creation
- partially delegate
- fully delegate
- continue an existing task/follow-up path

This gives the system a stable execution contract.

## 2. Team-style execution
The runtime is built around explicit execution roles such as:
- planner
- executor
- critic
- judge

The goal is not “many agents for show”, but controlled task decomposition and delivery closure.

## 3. Delivery is more than text
The runtime treats these as first-class:
- deliverables
- artifacts
- evidence
- review/judge outcomes
- acceptance closure

That is why it fits research, coding, and delivery workflows better than chat-only systems.

## 4. Dashboard/workbench visibility
The dashboard is part of the product story, not a bolt-on.
It should expose:
- task flow
- timelines
- runtime state
- artifacts/evidence
- operator follow-up context

## 5. Independent-agent interoperability
The ecosystem is designed so that third-party agents can integrate through explicit contracts instead of private host/session knowledge.

---

## Product boundaries

### Primary
- AI Team Runtime
- Dashboard
- Agent Harness

### Secondary
- Optional integrations such as OpenClaw/channel/host-specific wiring

This matters because the repository should be understandable without starting from private integration surfaces.

---

## Relationship to packages

### `packages/team-runtime`
The package-level runtime/orchestration surface.
Use this when you want the Team Runtime product layer.

### `packages/agent-harness`
The forkable execution substrate.
Use this when you want the reusable harness baseline or independent-agent onboarding path.

---

## Why it matters for open source

A strong open-source runtime needs to be legible in three ways:
1. **What the product is**
2. **How execution works**
3. **How others can extend or integrate with it**

AI Team Runtime is the answer to the first two.
`packages/agent-harness` is the answer to the third.

---

## Read next

- `../../README.md`
- `../../ARCHITECTURE.md`
- `../architecture/current-team-runtime-architecture.md`
- `../../packages/team-runtime/README.md`
- `../../packages/agent-harness/README.md`
