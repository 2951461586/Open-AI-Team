# Compat Retirement Inventory（第一刀）— 2026-03-24

> **强覆盖提醒（2026-03-26）**：本文是 staged retirement 的第一刀 inventory，保留了大量当时的 compat / fallback 盘点口径。它适合回答“历史上有哪些残留面被收口过”，**不适合**直接回答“现网 visible output 现在到底以什么为准”。当前 visible output canonical 口径请优先看：`docs/ops/visible-output-canonical-migration-2026-03-26.md`。
>
> 目的：把 orchestrator 仓库里仍然可见的 **QQ / NapCat / compat / fallback** 残留面，按“是否仍影响主线”做一次权威分层，作为后续 staged retirement 的基线。

---

## 1．当前结论

当前状态已经不是“是否要考虑开始退 compat”。

更准确的结论是：

- **AI Team Runtime / Dashboard 已是正式主线；用户可见输出的当前 canonical lane 以后续迁移说明为准。**
- **`napcat_http` 不再属于 Team mainline 的可持续依赖。**
- 仓库内残留的 compat 语义，当前主要分为三类：
  - **A．历史运行时残留**：仍在代码里可见，但不应继续扩散
  - **B．文档与配置残留**：口径仍会误导“compat 仍是长期并行面”
  - **C．归档／legacy 子系统残留**：可保留为历史资料或回滚参考，但不进入主线

因此，当前合适动作不是继续把 compat 当并行主链维护，而是：

1. **inventory**
2. **freeze**
3. **staged retirement**

---

## 2．残留面分层

## 2.1 A 类：运行时仍可见，但不应继续扩散

| 路径 | 残留类型 | 当前判断 | 处理策略 |
|---|---|---|---|
| `src/index-env.mjs` | `NAPCAT_HTTP` 环境变量仍保留 | 仍被 legacy / debate compat 侧使用；**不再是 Team mainline 依赖** | 保留，但标记为 legacy-only |
| `src/index.mjs` | 仍装配 `createDebateCompatRuntime(...)` 并注入 `NAPCAT_HTTP` | 属于 legacy debate subsystem，不属于 Team 主链 | 暂保留，后续与 Debate retirement 一起清理 |
| `src/debate/` | 历史 debate runtime / sent fallback / receipt 路径 | 已是 legacy subsystem | 不并入主线，不新增依赖 |
| `config/team/network-ports.json` | output 路由文案仍带 `bridge_rpc_or_local_delivery` / `NAPCAT_HTTP` | **配置口径已落后于现状** | 本轮修正为 canonical dashboard output |
| `scripts/team/team-agent-output-third-cut-smoke.mjs` | 描述仍写“不得 fallback 到 napcat_http” | 语义接近现状，但措辞仍停在“fallback 对手面”时代 | 本轮更新为 retired lane 口径 |

## 2.2 B 类：文档／说明残留（本轮优先 freeze）

| 路径 | 问题 | 本轮动作 |
|---|---|---|
| `README.md` | 仍把 `napcat_http` 描述成 compat lane / fallback | 改成 **historical retired compat path** |
| `ARCHITECTURE.md` | 仍提 `acceptance:qq-compat-observe` | 改成“无默认 compat acceptance 入口；compat 仅保留 legacy/reference” |
| `docs/architecture/current-product-boundaries-and-compat.md` | 仍把 `napcat_http` 描述成活跃 compat lane | 改成 **retired compat path / not-for-mainline** |
| `docs/ops/napcat-bridge-boundaries.md` | 仍写“compat lane 兜底” | 改成 **历史回滚参考，不新增依赖** |
| `docs/architecture/ai-team-runtime-architecture-deployment-map-2026-03-13.md` | 输出链仍写 `fallback napcat_http` | 改成 canonical-only，并显式注历史口径已退役 |

## 2.3 C 类：允许保留的 legacy / archive 区

| 路径 | 当前定位 | 规则 |
|---|---|---|
| `src/debate/` | legacy subsystem | 可保留，但不得再被 README / 主架构文档描述为 Team 主线 |
| `scripts/archive/` | 历史脚本归档 | 可保留，不参与主线入口 |
| `scripts/acceptance/SHIM-RETIRE-DRYRUN.md` | 历史退役过程记录 | 可保留，但不得充当当前操作手册 |
| `docs/changelog/*` | 历史阶段记录 | 可保留，允许保有当时口径 |

---

## 3．Freeze 规则（从本轮开始生效）

### 3.1 主线规则

以下内容视为 **canonical-only**：

- Team visible output
- Dashboard 主产品面
- `/internal/team/output`
- `dashboard_ws`
- `/state/team/*` 主查询面
- canonical smoke / acceptance

### 3.2 禁止新增依赖

从本轮起，**Team mainline 禁止继续新增**下列依赖：

- `napcat_http` 作为 Team visible output 主路径
- `qq-compat` 作为默认 acceptance / smoke 主入口
- 以 `qq_group_id` / `group_id` 作为新 contract 的主字段
- 任何“bridge rpc 不通就自动回落到 NapCat 直投”的新逻辑

### 3.3 允许存在但必须带标签

以下内容若继续保留，必须显式标成：

- `legacy`
- `retired`
- `historical`
- `reference-only`
- `not-for-mainline`

不得再使用会暗示其仍为活跃并行主线的措辞，例如：

- “compat lane（默认可兜底）”
- “fallback path（主线可依赖）”
- “可作为正常通过条件”

---

## 4．本轮之后的建议顺序

### P1．Freeze 已完成后

- 继续扫 `README / ARCHITECTURE / docs/architecture / config/team` 的残留口径
- 把主线心智统一到：
  - **Dashboard / Query API / `/internal/team/output`**

### P2．第二刀

- 对 runtime 内仍可见的 `NAPCAT_HTTP` / debate compat 注入做更明确的 legacy boundary 隔离
- 评估是否把部分历史 compat 代码迁入更窄的 legacy 装配层

### P3．第三刀

- 真正删除不再需要的 compat acceptance / helper / dead docs
- 做一次 canonical smoke / acceptance 全回归

---

## 5．一句话结论

**compat 不是下一阶段要不要讨论的选项，而是已经进入“先冻结口径，再分阶段退役”的执行态。**
egacy 装配层

### P3．第三刀

- 真正删除不再需要的 compat acceptance / helper / dead docs
- 做一次 canonical smoke / acceptance 全回归

---

## 5．一句话结论

**compat 不是下一阶段要不要讨论的选项，而是已经进入“先冻结口径，再分阶段退役”的执行态。**
