# Legacy Surface Layering（2026-03-26）

> ⚠️ 历史分层文档：本文件描述的是 P7 / P8 之前的 layering 状态。
> 当前真实结构：legacy receiver route contract 已 retired，相关 host/runtime 已退出主工作树。

> 目的：在完成 `*.bak.*` 快照清理与 retired / renamed 壳文件删除之后，进一步把仓库中仍然存在的 legacy 面按**真实职责**分层，避免下一步误把“活兼容层”和“纯历史包袱”混删。

---

## 1．当前总判断

截至 2026-03-26 晚，`orchestrator` 内与 visible output / legacy 相关的残余面，已经不再是同一种东西，而是至少分成三层：

1. **仍在工作的 legacy compat seam**
2. **历史文档 / 历史阶段说明**
3. **另一个独立 legacy 家族：debate-legacy**

这三层不能继续混在同一波“删除候选”里处理。

---

## 2．A 层：仍保留的非 canonical 验证入口（已从 legacy visible-output seam 收口）

### A1．当前主工作路径仍保留的脚本

- `scripts/team/team-output-receipt-authoritative-writeback-smoke.mjs`

历史 legacy visible-output seam 脚本已完成真实删除，不再保留 `scripts/team/retired/` 过渡层。

### A2．当前角色

它不是 canonical visible output 验收入口，而是一个**仍能测出真实信号**的内部验证脚本：

- 验证 receipt bridge / authoritative writeback 会把 delivered 结果正确写回 mailbox / blackboard

### A3．边界

它当前验证的重点已经不是 `/internal/team/output` 外部 compat seam 本身，而是：

- output request
- command emitted
- receipt consume
- authoritative writeback

### A4．结论

> **当前仍值得保留的，不再是 3 条 visible-output legacy seam，而是 1 条 receipt / writeback 验证入口。**

它已经被明确降级为：**显式运行、无 npm alias、非 canonical 主链入口**。

### A5．后续建议

如果将来要继续收缩，应该问的是：

- receipt writeback 是否已经可以完全由其他 canonical / team-level 验收稳定覆盖？
- `TEAM_OUTPUT_BRIDGE_RPC_URL` 已从当前 runtime loader 移除；后续只需把它当成历史说明项，而不是现行 compat 变量。

在这些问题没有得到明确确认前，不建议直接删除这条 receipt / writeback 验证入口或相关配置入口。

---

## 3．B 层：历史文档 / 历史阶段说明（可继续归档收口，但不属于“活代码删除”）

### B1．仍含旧口径引用的历史 / 说明文档

可见旧引用仍大量存在于以下文档中：

- `docs/ops/visible-output-canonical-migration-2026-03-26.md`
- `docs/ops/compat-retirement-inventory-2026-03-24.md`
- `docs/ops/p3-lite-security-audit-2026-03-24.md`
- `docs/architecture/ai-team-runtime-architecture-deployment-map-2026-03-13.md`
- `docs/architecture/current-product-boundaries-and-compat.md`
- `docs/ops/napcat-bridge-boundaries.md`
- `docs/changelog/2026-03-14-p0-p4-implementation.md`

### B2．这些旧引用为什么还在

因为它们承载的不是“当前主链实现”，而是：

- 历史阶段结论
- 迁移说明
- 兼容面 inventory
- 安全审计现场
- 架构演进轨迹

### B3．现状判断

这些文档大多已经补了以下保护手段之一：

- 强覆盖提醒
- 历史阶段声明
- canonical migration 文档跳转
- compat / legacy 语义标注

所以：

> **它们当前更像“历史档案”，不是“误导性活入口”。**

### B4．下一步合适动作

这层更适合做的是：

1. **归档 / 压缩 / 建索引**
2. 把仍高频被人翻到的旧文档再补更强的顶部提示
3. 逐步把“当前口径”统一导到更少的权威文档

而不是像代码一样直接一把删掉。

---

## 4．C 层：独立 legacy 家族——`debate-legacy-*`（不应误并到 visible output 清理）

### C1．当前文件

- `src/debate/debate-legacy-entry-context.mjs`
- `src/debate/debate-legacy-governance-host.mjs`
- `src/debate/debate-legacy-host.mjs`
- `src/debate/debate-legacy-receipt-runtime-host.mjs`
- `src/debate/debate-legacy-runtime-config.mjs`
- `docs/ops/debate-legacy-prunable-surfaces-2026-03-24.md`

### C2．为什么不能混删

这组不是 visible output 历史壳，而是：

- 仍被 `src/index.mjs` 直接导入
- 仍在主程序装配路径里
- 已被拆成多个 host / context / runtime-config 文件
- 有独立的 prunable surface 分析文档

### C3．结论

> **`debate-legacy-*` 是另一条独立收口线，不能顺着这次 visible output legacy 清理一起删。**

如果未来要继续动这组，应该单开一个独立专题，而不是混在 visible output 清理里做。

---

## 5．现在真正的“下一步问题”是什么

完成两刀真实删除后，当前最该回答的已经不是“还有哪些文件能删”，而是：

### 问题 1

**visible output legacy compat seam 到底还要保留多久？**

### 问题 2

**哪些历史文档值得继续压缩归档，哪些应该保留为长期治理记录？**

### 问题 3

**`debate-legacy-*` 是否要开独立收口计划，而不是继续挂在本轮 visible output 清理后面？**

---

## 6．推荐的后续推进顺序

### P1．文档层收口（低风险）

目标：减少“当前口径”分散。

建议动作：

- 给 1～2 个最容易被误读的旧文档补更强顶部提示
- 在 `docs/index.md` 或对应入口强化“当前权威口径”跳转
- 不删除历史档案，只降低误用概率

### P2．legacy compat seam 价值复核（中风险，先盘点后决定）

目标：确认 3 个 `team-visible-output-legacy-*` 是否仍需要保留。

需要核实：

- 是否仍有人用它们做兼容验收
- 是否仍有 receipt / explicit delivery contract 的现实验证价值
- 是否已经存在等价的 canonical 验证路径

### P3．debate-legacy 独立收口（单开专题）

目标：避免把另一个 legacy 家族混进本轮 visible output 里。

---

## 7．一句话结论

**两刀真实删除之后，visible output 这条线已经完成“快照层 + 护栏层”的清理；现在剩下的主要是“活兼容层、历史档案层、独立 debate-legacy 家族”三层问题，不能再用同一种删除策略继续推进。**
