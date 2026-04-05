# Debate Receiver Delete-Ready Inventory（2026-03-27）

> ⚠️ 历史盘点文档：本文件主体是 **P7 / P8 之前** 的 delete-ready 分析底稿。
> 当前真实状态：legacy debate receiver 已在 P7 进入 retired contract，相关 host/runtime 已在 P8 退入 `_trash/20260327-p8-debate-runtime-retire/`。

> 目标：把 legacy debate 家族里“接收侧历史 surface”分清楚：哪些已经只是文档/契约残影，哪些仍然是真正 runtime 入口，哪些应先改名/降级后再删。

## 结论先说

当前与 **receiver-side historical surface** 相关的对象，可以分成三层：

1. **已基本死掉、接近可删的残影层**
   - `/internal/debate/kick`
   - `bridgeKickPort: 19100` 在若干 config / docs 中的 debate 语义记录
   - `src/team/team-agent-bridge-spawn-session.mjs`

2. **仍然活着、但属于 legacy host 边界的入口层**
   - `POST /internal/commands/receipt`
   - `POST /internal/debate/sent`
   - `GET /internal/debate/governance[/*]`
   - `src/debate/debate-legacy-host.mjs` 及其 `entry-context / receipt-host / governance-host`

3. **不该混删的 runtime 本体层**
   - `src/debate/debate-runtime-receipt.mjs`
   - `src/debate/debate-runtime-sent.mjs`
   - `src/debate/debate-runtime-sent-governance.mjs`

补充：`src/debate/debate-receipt-bridge.mjs` 已于 P6 退入 `_trash/20260327-p6-debate-receipt-bridge-retire/`，不再属于 live runtime 本体层。

这意味着：

- **下一刀 delete-ready 真正该先打的，不是 runtime 本体，而是 `/internal/debate/kick` 相关残影与 bridgeKick 契约。**
- `receipt / sent / governance` 这几条虽然也是 legacy，但**目前仍有真实 entry route**，不能和 `/internal/debate/kick` 一起当“死面”删掉。

---

## Source-first 证据

### 1）现网入口真实情况

来自 `src/routes/index-routes-entry.mjs`：

- **存在真实 route**
  - `POST /internal/commands/receipt`
  - `POST /internal/debate/sent`
  - `GET /internal/debate/governance`
  - `GET /internal/debate/governance/:debateId`
- **不存在 `/internal/debate/kick` route**
  - 该文件中没有 `/internal/debate/kick` 的 handler

### 2）装配关系

- `src/index.mjs`
  - 仍装配 `createDebateCompatRuntime()` 与 `buildDebateLegacyHost()`
  - 其中 `sendFinalizeKick / sendAdvanceKick` 继续作为 legacy entry context 的依赖注入
- `src/debate/debate-legacy-host.mjs`
  - 只是总装配层，拼接：
    - `debate-legacy-entry-context.mjs`
    - `debate-legacy-receipt-runtime-host.mjs`
    - `debate-legacy-governance-host.mjs`
- `src/debate/debate-legacy-entry-context.mjs`
  - 当前主要为 legacy sent / governance 依赖聚合层；receipt 相关 bridge import 已移除
- `_trash/20260327-p6-debate-receipt-bridge-retire/src/debate/debate-receipt-bridge.mjs`
  - 历史 receipt compat 壳，已退入回收区；team receipt 语义已在 route 层与 team-native host 处理，legacy debate receipt host 已直连 `consumeReceipt()`

### 3）bridge spawn 线的真实状态

- `src/team/team-agent-bridge-spawn-session.mjs`
  - 只定义了 `createBridgeSpawnSession / resolveBridgeSpawnTarget`
- 当前全仓检索结果显示：
  - **没有活文件 import / 调用 `createBridgeSpawnSession`**
  - **没有活文件 import / 调用 `resolveBridgeSpawnTarget`**
- 因此这个文件当前更像 **未被主线消费的桥接遗留件**，而不是 runtime 正在走的能力。

### 4）config / contract 现状

- `config/team/network-ports.json`
  - `laoda.nodes.services.bridgeKick.path = /internal/debate/kick`
  - `status = legacy_optional`
- `config/team/roles.json` / `config/team-roles.json`
  - 仍保留 `bridgeKickPort: 19100`
  - 但文字说明已经写明：**仅保留为兼容/调查面**

这说明 runtime 口径其实已经比 contract 更前：

- **runtime：`/internal/debate/kick` 已无接收 route**
- **contract/docs：仍把它当成历史兼容记录保留**

---

## Delete-ready 分级

## A．可优先删除／收口（delete-ready now）

### A1．`src/team/team-agent-bridge-spawn-session.mjs`

**判断：delete-ready now**

原因：

- 活文件无 import / 无调用
- 语义仍停留在 `bridge_kick` 老路线
- 当前 team mainline 已切到 `sessions_spawn / multi-node gateway / dashboard canonical`

建议动作：

- 先从工作树删除
- 复跑：
  - `node --check` 相关入口
  - `npm run -s smoke:team:canonical`

### A2．`/internal/debate/kick` 的 config / docs 残影

**判断：delete-ready in docs+contract layer**

具体包括：

- `config/team/network-ports.json` 中 laoda/violet 的 `bridgeKick.path=/internal/debate/kick`
- `config/team/roles.json` / `config/team-roles.json` 中 `bridgeKickPort`
- `docs/ops/napcat-bridge-boundaries.md`
- `docs/architecture/ai-team-runtime-architecture-deployment-map-2026-03-13.md`

原因：

- source code 中已经没有 `/internal/debate/kick` route
- 继续保留这类记录，检索时很容易把“历史 debate kick 面”误看成真实接收入口

建议动作：

- 不一定要全删字段；更稳的是：
  - 从“端口/路径合同”降为 **archive / historical note**
  - 从主配置里去掉具体 `path=/internal/debate/kick`
  - 若保留端口，也要改为 `historical_reference_only`

---

## B．可先降级命名，再观察一轮（soft-delete candidate）

### B1．`bridgeKickPort` / `bridgeKick` 词汇本身

**判断：rename-first**

原因：

- 它现在既指旧 debate kick，又曾夹带旧 visible-output bridge 语义
- 同一个词在 `network-ports / roles / 旧架构文档` 里承载的历史语义并不一致

建议动作：

- 不直接删光数字 `19100`
- 先把命名从 `bridgeKick` 改成类似：
  - `legacyBridge19100`
  - `legacyCompat19100`
- 先做一轮“去当前语义化”，再决定要不要彻底删字段

这样能避免后面有人看到 `bridgeKick` 还以为系统里仍存在“正式 kick receiver”。

---

## C．暂不应删（not delete-ready yet）

### C1．`src/debate/debate-legacy-host.mjs`
### C2．`src/debate/debate-legacy-entry-context.mjs`
### C3．`src/debate/debate-legacy-receipt-runtime-host.mjs`
### C4．`src/debate/debate-legacy-governance-host.mjs`
### C5．`src/debate/debate-runtime-receipt.mjs`
### C6．`src/debate/debate-runtime-sent.mjs`
### C7．`src/debate/debate-runtime-sent-governance.mjs`

**判断：not delete-ready yet**

原因：

- `/internal/commands/receipt`、`/internal/debate/sent`、`/internal/debate/governance*` 仍由 `index-routes-entry.mjs` 真挂载
- 它们不是“死 route”，而是仍有 live contract 的 legacy host
- 现在删，会直接改 entry contract，而不是只收文档残影

建议动作：

- 若后续真要删这层，应作为**单独一整 P**处理：
  1. 先证明没有外部调用方
  2. 再做 route deprecation / fail-fast
  3. 再删 host 与 runtime 本体

---

## 推荐的下一刀顺序

### P3.1
- 删除 `src/team/team-agent-bridge-spawn-session.mjs`
- 把相关 `bridge_kick` 命名从活文档/活配置中继续降级

### P3.2
- 收掉 `config/team/network-ports.json`、`roles*.json` 中 `/internal/debate/kick` 的“像活入口”的表述
- 改成历史档案/参考口径

### P3.3
- 单独做 `receipt / sent / governance` legacy route 的调用方盘点
- 只有证明外部无消费者后，才进入真正删 route / 删 host

---

## 当前一句话判断

**`/internal/debate/kick` 这条“接收侧历史 surface”在现网 runtime 里其实已经死掉了；而 `receipt / sent / governance` 这组也已在 P7 进入 retired contract 收口阶段。当前仍保留主线活入口的，只剩 `/internal/commands/receipt` 上的 `team_output_receipt` 语义。**
