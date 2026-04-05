# Team Source Index

## Runtime Core

- `team-tl-runtime.mjs` — **当前唯一 authority + 编排主链**
- `tl-runtime/*` — TL runtime 拆出的 execution / follow-up / single-flight / fail-fast / orchestration 细节
- `team-store.mjs`
- `team-policy.mjs`
- `team-single-flight-guard.mjs`
- `team-node-health.mjs` — facade
- `team-node-health-core.mjs` — scoring / placement semantics
- `team-node-health-probes.mjs` — health probe adapters
- `team-resident-runtime.mjs`
- `team-governance-runtime.mjs`
- `team-session-completion-bus.mjs`

## Deleted Legacy Shell

- 旧 `team-runtime.mjs` / `team-agent-harness.mjs` / `team-multi-node-gateway.mjs` 已物理清退，不再作为 source index 成员

## Config / Deployment / Contracts

- `team-roles-config.mjs`
- `team-role-deployment.mjs`
- `team-role-contracts.mjs`
- `team-role-capability-contracts.mjs`
- `team-role-task-card.mjs`

## Agent / Session Layer

- `team-agent-critic-session-runner.mjs`
- `team-delivery-target.mjs`
- `team-output-receipt-host.mjs`
- `team-parallel-executor.mjs`
- `team-native-chat.mjs`

## Routing / Claim / Reroute

- `team-capability-router.mjs`
- `team-fallback-router.mjs`
- `team-reroute-ack.mjs`
- `team-reroute-consumer.mjs`
- `team-route-claim-guard.mjs`
- `team-task-claim-runtime.mjs`
- `team-task-dispatcher.mjs`

## Query API

- `query-api/*`

## 入口判断

- 想看主链：从 `team-tl-runtime.mjs` 开始。
- 想看执行细节：继续看 `tl-runtime/README.md` 与 `tl-runtime/*`。
- 想看角色落点：从 `team-role-deployment.mjs` 开始。
- 想看清退边界：看 `src/team-runtime-adapters/README.md` 与 `docs/architecture/release-preflight-retirement-inventory.md`。
- 想看外部查询契约：从 `query-api/query-contract.mjs` 开始。
