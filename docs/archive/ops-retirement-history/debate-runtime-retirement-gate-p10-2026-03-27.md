# Debate Runtime Retirement Gate（P10，2026-03-27）

> 目标：判断 `debate-compat-runtime.mjs`、`debate-dualwrite.mjs`、`debate-legacy-runtime-config.mjs` 这组 **compat runtime 三件套** 是否已经满足整体退役前提。

## 结论

**当前不能整体退役。**

原因不是“情感上还想留”，而是这三件套现在仍然被现网入口、状态面、以及回归合同真实咬住。

## source-first 证据

### 1．webhook debate ingress 仍是 live 合同

- `src/team/team-policy.mjs`
  - `classifyWorkMode()` 仍把 `looksLikeDebate(...)` 识别为 `debate`
- `src/webhook-event-router.mjs`
  - 非 `team_task` 仍落到 `decisionFromEvent(evt)`
  - `decision.mode === 'debate'` 时仍生成 `x-debate-envelope`
- `scripts/index-surface/index-remaining-surface-split-smoke.mjs`
  - 仍直接打 `开始辩论：...`
  - 仍断言 `webhookDebateMode === 'debate'`
  - 仍断言 `x-debate-envelope` 存在

### 2．状态面仍咬着 compat runtime

- `src/routes/index-routes-health-state.mjs`
  - `/state/recent` 仍直接走 `readRecent()`
  - `/state/debate` 仍直接读 `debateSessions`
  - `/health` 仍暴露 debate checkpoint `lastAt`
- `scripts/index-surface/index-health-state-route-split-smoke.mjs`
  - 仍直接验证 `/state/debate`
- `scripts/team/team-runtime-phase1-regression.sh`
  - 仍把 debate start / stop / `/state/debate` 当成验收项

### 3．三件套在主入口里仍是 live wiring

- `src/index.mjs`
  - 仍 import：
    - `createDebateCompatRuntime`
    - `createDebateDualWriter`
    - `buildDebateLegacyRuntimeConfig`
  - 仍实际构造：
    - `createDebateCompatRuntime(buildDebateLegacyRuntimeConfig(...))`
  - 仍执行：
    - `restoreRunningDebates()`
    - `maybeCheckpointDebateDb('interval')`

## 结构判断

### 当前不能退的对象

- `debate-compat-runtime.mjs`
  - 因为 webhook debate ingress、`/state/recent`、`/state/debate`、restore/checkpoint 仍依赖它。

- `debate-dualwrite.mjs`
  - 因为 compat runtime 仍会在 debate start / advance / finalize 路径写 projection / governance read model。

- `debate-legacy-runtime-config.mjs`
  - 因为它仍是 compat runtime 的 live config 聚合层。

### 当前可以明确说的话

**这三件套不是长期保留层，而是“仍被现网 debate ingress / state surface 咬住的阶段保留层”。**

## 最小退役前置刀

如果要推进真正的整退，顺序应该是：

1. **先退 webhook debate ingress**
   - 收口 `TEAM_POLICY.classifyWorkMode()` 的 debate 路由
   - 收口 `webhook-event-router.mjs` 对 `decisionFromEvent()` 的 debate 用法

2. **再退状态面**
   - `/state/debate`
   - `/state/recent` 的 debate 视图
   - `/health` 里的 debate checkpoint 暴露

3. **最后改回归合同**
   - `index-remaining-surface-split-smoke.mjs`
   - `index-health-state-route-split-smoke.mjs`
   - `team-runtime-phase1-regression.sh`

4. **完成以上三步后**
   - `debate-compat-runtime.mjs`
   - `debate-dualwrite.mjs`
   - `debate-legacy-runtime-config.mjs`
   才进入 **整体 delete-ready**

## 可复跑判定

已新增脚本：

- `scripts/index-surface/debate-runtime-retirement-readiness.mjs`

其输出会直接给出：

- `retirementReady`
- `blockers`
- `nextCuts`

当前运行结果应为：

- `retirementReady = false`

## 一句话结论

**P10 的真实判断不是“这三件套还能不能删文件”，而是“现网是否已经不再承认 debate ingress / debate state surface”。答案目前是否定的，所以三件套现在还不能整体退役。**
