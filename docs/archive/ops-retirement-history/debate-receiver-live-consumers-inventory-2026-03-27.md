# Debate Receiver Live Consumers Inventory（2026-03-27）

> ⚠️ 历史盘点文档：本文件主体记录的是 **P7 / P8 之前** 的 source-first 证据。
> 当前真实状态以 `debate-receiver-retired-contract-p7-2026-03-27.md` 与 `debate-runtime-retired-p8-2026-03-27.md` 为准：legacy debate receiver 已失去 route contract，相关 host/runtime 也已退出主工作树。

> 目标：把 `receipt / sent / governance` 这组 legacy receiver 的**P7 之前真实消费者**钉死，同时为 P7 retired contract 收口保留 source-first 背景。

## 结论

- `POST /internal/commands/receipt`
- `POST /internal/debate/sent`
- `GET /internal/debate/governance`
- `GET /internal/debate/governance/:debateId`

这些 surface 在 **P7 之前** 确实是 live contract；但在 **P7 之后**，已发生以下收口：

1. `team_output_receipt` 继续保留在 `/internal/commands/receipt` 主线
2. legacy debate receipt 改为 `410 Gone + legacy_receiver_retired`
3. `/internal/debate/sent` 改为 retired contract
4. `/internal/debate/governance*` 改为 retired contract
5. `src/index.mjs` 已移除 `buildDebateLegacyHost()` 的 live import / 构造 / 注入

因此，这份文档现在的角色是：**说明 P7 为什么能退役，而不是继续主张这些 route 仍应保持 live。**

---

## Source-first 证据

## 1．运行时入口装配

`src/routes/index-routes-entry.mjs` 仍显式注册：

- `POST /internal/commands/receipt`
- `POST /internal/debate/sent`
- `GET /internal/debate/governance`
- `GET /internal/debate/governance/:debateId`

这说明它们不是“历史文档残影”，而是**当前 server 真正对外可匹配的 route**。

## 2．legacy host 与 runtime 依赖链

这些 route 当前仍会落到：

- `src/debate/debate-legacy-host.mjs`
- `src/debate/debate-legacy-entry-context.mjs`
- `src/debate/debate-legacy-receipt-runtime-host.mjs`
- `src/debate/debate-legacy-governance-host.mjs`
- `src/debate/debate-runtime-receipt.mjs`
- `src/debate/debate-runtime-sent.mjs`

换句话说：**receipt / sent / governance 这组 legacy receiver 仍然具有真实 wiring；其中 team receipt mainline 已在 route 层先分流，legacy debate receipt host 也已直连 `debate-runtime-receipt.mjs`，历史 bridge 壳已退入 `_trash/20260327-p6-debate-receipt-bridge-retire/`。**

## 3．主线 smoke 的真实消费者

### A．入口层守门 smoke

`scripts/index-surface/index-remaining-surface-split-smoke.mjs` 当前会直接打：

- `POST /internal/commands/receipt`
- `POST /internal/debate/sent`
- `GET /internal/debate/governance`
- `GET /internal/debate/governance/:debateId`

并校验：

- unauthorized
- bad request
- empty diagnostics
- team receipt bridge success

这意味着删掉任何一条 route，都会先把 index surface contract smoke 打断。

### B．team receipt mainline bridge smoke

`scripts/team/team-output-receipt-mainline-bridge-smoke.mjs` 当前已改为直接 import：

- `handleTeamOutputReceipt` from `src/team/team-output-receipt-host.mjs`

它验证的是：

- `output.request`
- 通过 team-native receipt host 进入 authoritative writeback
- `output.delivered` / blackboard authoritative 标记成立

所以即便 legacy debate receiver 仍存活，**team receipt mainline smoke 已不再依赖 `src/debate/debate-receipt-bridge.mjs`**。

---

## 不应误判为 delete-ready 的对象

- `src/debate/debate-legacy-host.mjs`
- `src/debate/debate-legacy-entry-context.mjs`
- `src/debate/debate-legacy-receipt-runtime-host.mjs`
- `src/debate/debate-legacy-governance-host.mjs`
- `src/debate/debate-runtime-receipt.mjs`
- `src/debate/debate-runtime-sent.mjs`
- `src/routes/index-routes-entry.mjs`
- `scripts/index-surface/index-remaining-surface-split-smoke.mjs`
- `scripts/team/team-output-receipt-mainline-bridge-smoke.mjs`

---

## 退役前置条件（下一阶段才该做）

如果后面要真正删 `receipt / sent / governance`，建议顺序必须是：

1. **先替换主线 smoke 依赖**
   - 让 receipt authoritative writeback 走 team-native / non-debate bridge 验证面
2. **再给 route 做 deprecation / fail-fast**
   - 明确返回 retired / gone，而不是静默消失
3. **最后再删 host 与 runtime 本体**
   - 包括 legacy host、receipt bridge、sent runtime、governance query 面

---

## 一句话结论

**P3.3 已盘清：`receipt / sent / governance` 这组不是 delete-ready dead surface，而是仍被入口装配与 smoke 真实消费的 live legacy receiver；这轮应收口的是“把它们与已死的 `/internal/debate/kick` 明确分层”，而不是直接动刀删 runtime。**
