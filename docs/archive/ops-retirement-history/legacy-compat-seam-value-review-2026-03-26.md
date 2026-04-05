# Legacy Compat Seam Value Review（2026-03-26）

> **状态更新（2026-03-26 晚）**：本文评审的 3 个 legacy visible-output 脚本都已退出工作树。
>
> 如果你在找**当前仍可执行的入口**，请优先看：
>
> - `scripts/team/team-output-receipt-authoritative-writeback-smoke.mjs`
> - `docs/ops/visible-output-canonical-migration-2026-03-26.md`
>
> 本文保留的旧文件名，仅用于解释：它们为什么被判定为“应收口 / 应删除”的**历史依据**，不是当前推荐入口清单。

---

## 1．历史评审对象（现已删除）

- 对象 A：`scripts/team/team-visible-output-legacy-compat-seam-smoke.mjs`
- 对象 B：`scripts/team/team-visible-output-legacy-explicit-delivery-contract-smoke.mjs`
- 对象 C：`scripts/team/team-visible-output-legacy-compat-receipt-acceptance-smoke.mjs`

---

## 2．评审方法

本轮评审当时不是只看文件名或注释，而是同时核了三类证据：

1. **仓内引用**：哪些活文档 / 索引 / 配置仍引用它们
2. **代码实际测点**：脚本到底想验证什么
3. **现场执行结果**：脚本当时跑出来到底还剩什么信号

---

## 3．共同背景

### 3.1 当前现网口径

已确认：

- visible output canonical lane = **dashboard websocket**
- `/internal/team/output` = **legacy compat / investigate only**
- `team-agent-output-sender.mjs` 对外部输出会返回：
  - `error = external_output_retired`
  - `reason = dashboard_only_output`

### 3.2 评审发生当时的仓内语境

这些历史对象在评审发生当时，主要还会出现在：

- `scripts/team/README.md`
- `scripts/team/INDEX.md`
- `docs/ops/visible-output-canonical-migration-2026-03-26.md`
- `docs/ops/legacy-surface-layering-2026-03-26.md`

同时，`src/index-env.mjs` 仍保留：

- `TEAM_OUTPUT_BRIDGE_RPC_URL`

但这并不自动说明三条历史脚本都还有同等现实价值。

---

## 4．逐项判断（历史评审结论）

## 4.1 对象 A：legacy compat seam smoke

### 目标语义

原意是验证：

- `team.visible_output` 是否还能经由 `/internal/team/output` 这条 legacy compat seam 发出

### 当时现场结果

当时实跑结果：

- `ok = false`
- `error = external_output_retired`
- `reason = dashboard_only_output`
- `deliveryLane = retired`
- `via = none`
- `rpcCallCount = 0`
- `seen = []`

### 当时判断

这说明该对象已经**不再验证 compat seam 真的还能打通**，而只是验证：

- 当前实现会在更前面直接把外部输出判为 retired
- 根本不会真正触发 `/internal/team/output` 调用

> **当时结论：接近可删。**

它剩下的主要价值不是“compat seam 可用性验证”，而只是：

- 一个会返回 `external_output_retired / dashboard_only_output` 的历史哨兵

### 当前状态

- **已删除**

---

## 4.2 对象 B：legacy explicit delivery contract smoke

### 目标语义

原意是验证：

- legacy compat seam 上 explicit delivery contract 的映射（`deliveryTarget / channel / deliveryMode`）

### 当时现场结果

当时实跑结果：

- `ok = false`
- `error = external_output_retired`
- `reason = dashboard_only_output`
- `deliveryLane = retired`
- `via = none`
- `rpcDeliveryTarget = ''`
- `rpcChannel = ''`
- `rpcDeliveryMode = ''`

### 当时判断

这说明它连 explicit contract 映射都**没有真正测到**。

也就是说：

- 文件名看起来在测 contract
- 但当时实现实际只会在更早阶段被 retired
- 因此它已经无法提供“contract mapping 仍然成立”的有效证据

> **当时结论：最接近可删。**

### 当前状态

- **已删除**

---

## 4.3 对象 C：legacy compat receipt acceptance smoke

### 目标语义

原意是验证：

- 在 legacy compat seam 语义下，output request / command emitted / receipt consume / authoritative writeback 这一段是否还能闭环

### 当时现场结果

当时实跑结果：

- `rpcCallCount = 0`
- `outputRequestExists = true`
- `emittedExists = true`
- `receiptOk = true`
- `receiptType = team_output_receipt`
- `receiptAuthoritative = true`
- `deliveredAfterReceipt = 1`
- `blackboardDeliveredAuthoritative = true`

### 当时判断

这条脚本虽然名字里还有 legacy compat，但它当时**仍能测出一个真实信号**：

- receipt mainline 的 authoritative writeback 逻辑是通的
- mailbox / blackboard 的 delivered 记录会被正确写回

同时也说明：

- 它测到的重点，已经不是 `/internal/team/output` 这条外部 compat seam 本身
- 而更像是 **receipt bridge / authoritative writeback** 这段内部语义

> **当时结论：不该继续挂在 legacy visible-output seam 名下，应合并改名。**

### 当前状态

- 旧文件名已删除
- 真实验证价值已由：
  - `scripts/team/team-output-receipt-authoritative-writeback-smoke.mjs`
  承接

---

## 5．分级结论（历史判断 vs 当前状态）

| 对象 | 当时真实测到的东西 | 当时判断 | 当前状态 |
|---|---|---|---|
| A（见 §1） | 只证明外部输出已 retired，未触发 RPC | **接近可删** | **已删除** |
| B（见 §1） | 连 contract 映射都未真正测到，只在 retired 前短路 | **最接近可删** | **已删除** |
| C（见 §1） | 仍能验证 receipt authoritative writeback | **应合并改名** | 已由 `scripts/team/team-output-receipt-authoritative-writeback-smoke.mjs` 承接 |

---

## 6．一句话结论

这份评审的最终落点已经完成：

- **A / B 两个历史对象已删除**
- **C 的真实验证价值已由准确命名的新入口承接**
- 因此本文现在是**删除依据文档**，不是当前可执行入口清单

---

## 7．已执行结果（2026-03-26 晚）

已按原评审结论落地：

1. 对象 C 已收口为更准确命名的 `scripts/team/team-output-receipt-authoritative-writeback-smoke.mjs`
2. §1 中列出的 3 个 legacy visible-output 文件名已完成真实删除
3. `scripts/team/README.md`、`scripts/team/INDEX.md`、`docs/ops/visible-output-canonical-migration-2026-03-26.md` 已同步更新引用

### 执行后结论

visible-output legacy seam 这组历史脚本已完全退出工作树；当前主工作路径只保留 1 条**准确命名**的 receipt / authoritative writeback 验证入口。
