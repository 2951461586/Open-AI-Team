# AI Team Open-Source Execution Plan

> Status: active
> Mode: continuous delivery with gated release
> Last updated: 2026-04-04 UTC

## Objective

Turn the current AI Team stack into a public-safe, GitHub-friendly, host-neutral product surface while preserving an optional OpenClaw integration path and shipping the validated frontend to `https://board.liziai.cloud/` at the end.

## Operating Rules

1. Treat this as one continuous program, not isolated P0/P1/P2 handoffs.
2. Keep runtime-core, frontend adaptation, and release hardening moving in lockstep.
3. All UI changes must go through frontend design polish and code review gates before release.
4. External deployment is last-step only, after repo cleanup + tests + acceptance evidence.

## Active Workstreams

### 1. Foundation / boundary locking
- Define open-source minimal core and stable release criteria.
- Clarify what is product core vs examples vs integration vs archive.
- Lock current blockers across orchestrator, standalone harness, examples, dashboard.

### 2. Runtime decoupling
- Keep `src/agent-harness-core/*` as canonical execution substrate.
- Continue isolating OpenClaw-specific session/control-plane behaviors behind adapters.
- Ensure local/standalone paths remain runnable without OpenClaw.

### 3. Public contracts and schemas
- Expand schemas beyond current ingress/agent package baseline.
- Add artifact manifest, run report, callback event, work item, task and event-log contracts.
- Align examples and docs to the new public contracts.

### 4. Independent agent onboarding
- Make third-party agent sample runnable, documented, and testable.
- Provide bootstrap/doctor/health expectations.
- Remove hidden assumptions about internal session semantics.

### 5. Frontend adaptation
- Update dashboard/frontend to consume public-neutral runtime contracts.
- Remove remaining OpenClaw-biased labels/fields from active UI paths.
- Keep design quality and review discipline explicit.

### 6. Repo surface cleanup
- Continue downgrading historical/private/compat material out of the main public path.
- Archive or annotate tmp/shadow/legacy surfaces.
- Keep canonical naming dominant in active docs and scripts.

### 7. CI / release hardening
- Turn smoke-heavy coverage into layered contract/integration/product checks.
- Validate schemas, standalone sample, frontend compatibility, and release preflight.
- Produce clear evidence artifacts for final ship/no-ship decision.

### 8. Final deployment
- Release to `board.liziai.cloud` only after acceptance evidence is green.
- Record deployment inputs, version, smoke results, and rollback path.

## Immediate Next Moves

1. Finish repo + dashboard boundary inventory.
2. Identify remaining active OpenClaw coupling points and UI coupling points.
3. Start source edits for runtime decoupling + schema expansion + frontend neutralization.
4. Add/upgrade tests before release cut.
