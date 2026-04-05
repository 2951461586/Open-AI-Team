# Visible Output Final Status（2026-03-26）

> 目的：给 visible output 这一轮收口提供一份**最终巡检状态表**。
>
> 这份文档回答三个问题：
>
> 1. **当前主链到底是什么**
> 2. **仓内还看到的 `19100 /internal/team/output` 属于什么性质**
> 3. **哪些命中是兼容变量 / 运行契约，哪些只是历史文档**

---

## 1．一句话结论

- **当前 canonical visible output 主链**：dashboard websocket broadcast
- **当前 canonical 验收入口**：`scripts/acceptance/canonical/team-output-authoritative-live.mjs`、`scripts/acceptance/canonical/team-three-node-live.mjs`
- **当前仍保留的非 canonical 验证入口**：`scripts/team/team-output-receipt-authoritative-writeback-smoke.mjs`
- **`19100 /internal/team/output`**：仍存在于 compat / receipt writeback / 契约文档层，但**不是现网 visible output mainline**
- **旧 `team-visible-output-legacy-*` 文件名**：已从工作树清零

---

## 2．最终状态表

| 类别 | 现状 | 代表位置 | 处理结论 |
|---|---|---|---|
| canonical 主链 | dashboard websocket canonical lane | `README.md`、`docs/ops/visible-output-canonical-migration-2026-03-26.md`、`scripts/acceptance/canonical/team-output-authoritative-live.mjs` | **当前权威口径** |
| canonical live acceptance | 仍在使用 | `scripts/acceptance/canonical/team-output-authoritative-live.mjs`、`scripts/acceptance/canonical/team-three-node-live.mjs` | **保留** |
| receipt authoritative writeback 验证 | 仍在使用，但非 canonical；已切到 team-native receipt host | `scripts/team/team-output-receipt-authoritative-writeback-smoke.mjs` | **保留，显式标注非 canonical** |
| `/internal/team/output` 运行契约 | 仍存在，但仅 compat / investigate / receipt writeback 语义 | `config/team/network-ports.json`、receipt smoke | **保留，不得再当主链** |
| `TEAM_OUTPUT_BRIDGE_RPC_URL` | 已退出当前 runtime loader；剩余命中仅在历史说明层 | 旧 changelog、历史评审文档 | **运行面已移除，历史说明保留** |
| 旧 `team-visible-output-legacy-*` 文件名 | 工作树已清零 | grep 无活文件命中 | **已完成删除** |
| 历史迁移 / 评审文档 | 仍保留 | `docs/ops/visible-output-canonical-migration-2026-03-26.md`、`docs/ops/legacy-compat-seam-value-review-2026-03-26.md` | **保留为治理记录** |
| 历史架构快照 | 仍保留旧拓扑叙述，但已有强覆盖提醒 | `docs/architecture/ai-team-runtime-architecture-deployment-map-2026-03-13.md` | **保留为历史档案，不按现网口径引用** |

---

## 3．这次全仓巡检的精确结论

### 3.1 旧 legacy visible-output 文件名

本轮再次精确搜索后，结果是：

- **工作树内已不存在旧 `team-visible-output-legacy-*` 脚本文件**
- 剩余命中只在：
  - 历史评审文档
  - 历史迁移说明

这意味着：

> **旧文件名已经退出运行面，只剩历史说明面。**

### 3.2 为什么还会继续看到 `19100 /internal/team/output`

因为它没有被“全量抹掉”，而是被收口到三个明确层次：

1. **compat / investigate 契约层**
   - 如 `config/team/network-ports.json`
2. **内部 receipt writeback 验证层**
   - 如 `scripts/team/team-output-receipt-authoritative-writeback-smoke.mjs`
3. **历史文档层**
   - migration / audit / architecture / changelog

所以当前再 grep 到 `19100`，**不能直接推出主链仍在走 19100**。

### 3.3 当前真正该看的权威信号

判断 visible output 是否正常，优先看：

- `channel = dashboard`
- `deliveryMode = dashboard`
- `via = dashboard_ws`
- `outputDeliveredCount >= 1`
- `authoritative = true`
- dashboard broadcast / mailbox / blackboard / read model 是否一致

而不是先看：

- `19100 /internal/team/output` 是否通
- `19102/19104` alias 是否活着
- remote tunnel receipt 是否成功

---

## 4．残余命中的分层解释

### A．当前入口层

这是**现在就该跑 / 该看的**：

- `scripts/acceptance/canonical/team-output-authoritative-live.mjs`
- `scripts/acceptance/canonical/team-three-node-live.mjs`
- `docs/ops/visible-output-canonical-migration-2026-03-26.md`

### B．兼容变量 / 契约层

这是**仍存在，但不能误当主链**：

- `config/team/network-ports.json` 里的 `19100 /internal/team/output`
- `scripts/team/team-output-receipt-authoritative-writeback-smoke.mjs` 的 receipt writeback 验证
- 历史文档里保留的 `TEAM_OUTPUT_BRIDGE_RPC_URL` 说明

### C．历史文档层

这是**允许保留，但只能按历史阶段理解**：

- `docs/changelog/2026-03-14-p0-p4-implementation.md`
- `docs/ops/p3-lite-security-audit-2026-03-24.md`
- `docs/ops/compat-retirement-inventory-2026-03-24.md`
- `docs/architecture/ai-team-runtime-architecture-deployment-map-2026-03-13.md`

---

## 5．现在是否还需要继续删除

当前最准确判断是：

- **不需要继续沿着 visible output 这条线做“见 19100 就删”的清理**
- 这条线的主收口已经完成
- 剩余命中大多已经有了合理分层：
  - 当前入口
  - compat 契约
  - 历史文档

如果后续还要继续动，应该是两个独立专题：

1. **compat 变量是否还能再缩**
2. **历史架构档案是否要继续归档压缩**

而不是继续按“visible output 主链误导”来处理。

---

## 6．关账结论

截至 2026-03-26 晚，这条线已经完成：

- canonical 主链口径统一
- retired / renamed / legacy visible-output 文件名真实退出工作树
- receipt writeback 验证入口准确命名并单独留存
- 历史评审 / 迁移 / 架构文档改成“当前口径优先、历史语境次级”
- 全仓检索时，**主链判断不会再被旧 visible-output 脚本名带跑偏**

> **可以把 visible output 主链收口这条线视为已基本关账。**
线视为已基本关账。**
�条线视为已基本关账。**
线视为已基本关账。**
