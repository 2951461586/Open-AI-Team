# Learnings

Append structured entries:
- LRN-YYYYMMDD-XXX for corrections / best practices / knowledge gaps
- Include summary, details, suggested action, metadata, and status


## [LRN-20260408-001] best_practice

**Logged**: 2026-04-08T12:19:50.120Z
**Priority**: medium
**Status**: pending
**Area**: backend

### Summary
Workspace package export drift can break runtime after pnpm relink

### Details
While wiring the new pool governance routes, liziai-api.service kept crashing. Root cause was not the new route itself but an existing workspace package export drift: apps/api-server imported createStandaloneProductRuntime from @ai-team/agent-harness, but packages/agent-harness/src/index.mjs did not re-export it. After pnpm install relinked local packages, the missing export surfaced immediately and blocked API startup until re-export was added.

### Suggested Action
When touching workspace package consumers, verify package barrel exports match all runtime imports before restart. After any pnpm relink, run a targeted node import smoke test on the affected app entrypoints.

### Metadata
- Source: memory-lancedb-pro/self_improvement_log
---
