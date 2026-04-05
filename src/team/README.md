# `src/team/` 目录说明

## 目录职责

集中存放 Team Runtime 主域：

- `team-tl-runtime.mjs` 驱动的 TL-first authority 与 delegated execution 主链
- callback / completion / spawn session 适配层
- capability routing / fallback routing
- output gate / output bridge / reroute / claim runtime
- team store / team policy / resident / node health / governance host

## 当前主线入口

### authority / runtime
- `team-tl-runtime.mjs` — **当前唯一对话 authority + 任务编排 authority**
- `team-store.mjs`
- `team-policy.mjs`
- `team-resident-runtime.mjs`
- `team-governance-runtime.mjs`
- `team-node-health.mjs` — facade
- `team-node-health-core.mjs` — 节点打分 / 选路 authority
- `team-node-health-probes.mjs` — 本地/远端健康探针采集

### retired / deleted surfaces
- 旧 `team-runtime.mjs` / `team-agent-harness.mjs` / `team-multi-node-gateway.mjs` 已完成**物理清退**，不再保留壳文件

### agent / session / adapters
- `team-agent-*.mjs`
- `team-session-completion-bus.mjs`
- `tl-runtime/*`

### routing / reroute / claim
- `team-capability-router.mjs`
- `team-fallback-router.mjs`
- `team-reroute-*.mjs`
- `team-route-claim-guard.mjs`
- `team-task-claim-runtime.mjs`

## 维护原则

- Team cluster 内部允许细分，但不要再把 team 文件放回 `src/` 根目录。
- `team-tl-runtime.mjs` 负责 authority + wiring；大块执行细节继续下沉到 `tl-runtime/`。
- 已物理清退的 compat 壳不得回流工作树；若未来需要兼容层，必须走新的中性命名面，而不是恢复旧文件名。
- 新的 team smoke / regression 优先放 `scripts/team/`。
- source index、README、smoke 口径必须同步把 `team-tl-runtime.mjs` 视为主链，把 compat 壳视为边界而不是入口。
