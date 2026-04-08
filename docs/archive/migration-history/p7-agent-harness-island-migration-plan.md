# P7 Agent Harness Island Migration Plan

## Goal

Complete the `agent-harness` island migration as a real package-owned authority flip.

## Completion rule

P7 is complete only when:

1. `packages/agent-harness/` owns the real implementation,
2. `src/agent-harness-core/*` is reduced to compatibility shims/assets,
3. release/onboarding/architecture docs reflect package-owned reality,
4. smoke coverage validates the migrated state.

## Delivered in P7

- `packages/agent-harness/src/*` now owns the harness substrate implementation
- `src/agent-harness-core/*.mjs` reduced to compatibility shims
- package README and compatibility README updated
- standalone harness docs and smoke boundaries updated to package-owned authority

## Non-goals for P7

- no premature flip for `packages/team-runtime/`
- no premature flip for `apps/api-server/`
- no rewriting of host-specific runtime adapter authority beyond compatibility use
