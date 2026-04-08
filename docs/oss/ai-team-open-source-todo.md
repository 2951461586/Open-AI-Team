# AI Team 开源改造 TODO（按目录 / 模块 / 优先级拆解）

> 状态：active
> 目标：把当前 AI Team 从“可运行的内部系统”收敛为“可理解、可复现、可扩展的 GitHub 开源项目”
> 原则：先清边界，再强基座，再松接入，最后补演示与发布

---

## 一、简表（图表版）

| 优先级 | 目录/模块 | 现状问题 | 改造动作 | 产出 |
|---|---|---|---|---|
| P0 | 根目录 / 仓库卫生 | 运行产物、临时目录、双路径入口并存 | 清理 node_modules / logs / tmp / run / data 说明，补审计脚本 | 可公开仓库表面 |
| P0 | README / GETTING-STARTED / docs | 主路径存在过渡语义，读者首次理解成本偏高 | 收敛主入口、标注 canonical / transition / legacy | 外部可读主线 |
| P0 | `dashboard/` vs `apps/dashboard/` | 前端主路径不唯一 | 确认 authority surface，另一侧归档或标记 transition | 单一前端权威路径 |
| P0 | `src/` vs `packages/*` | monorepo 迁移未完全收口 | 标注 authority inventory，逐步把可迁移面移入 packages | 清晰代码归属 |
| P1 | `packages/agent-harness` | 尚未完全承担强执行基座职责 | 上提 response normalize / fallback / tool audit / event tracing | 强执行 Harness |
| P1 | `packages/team-runtime` | 仍承担部分兼容脏活 | 收缩为 team semantics / orchestration 层 | 稳定 runtime 边界 |
| P1 | `schemas/` + API + dashboard | 公共契约还需继续统一 | 补 run / task / artifact / evidence / review / callback schema | 对外可接 contracts |
| P1 | `apps/api-server` / route surface | API 需进一步公共化 | 将前端只依赖公共 read models 与 schema | host-neutral API |
| P1 | `packages/tools` / `packages/im-channels` | 工具与渠道边界需更清楚 | 分权限级别、补适配约定与可选加载说明 | 可控扩展面 |
| P2 | Agent onboarding | 独立 Agent 接入仍偏文档化 | 设计 agent manifest / lifecycle / SDK sample | 第三方 Agent 接入路径 |
| P2 | examples | 样例存在，但需要更产品化 | 保留最小可运行 demo、第三方 agent demo、自定义 tool demo | 外部上手样例 |
| P2 | release engineering | 已有 smoke，但发布故事还可更完整 | 补 release checklist / evidence / versioned notes | 可持续发布 |

---

## 二、按目录拆解

### P0：仓库表面与退役面清理（立即执行）

#### 1. 根目录
- [ ] 统一说明以下目录是否为运行时产物：`logs/` `run/` `tmp/` `reports/` `artifacts/` `data/` `state/`
- [ ] 确认 `.gitignore` / `.dockerignore` 覆盖这些运行产物
- [ ] 审计 `.env`、本地配置、私有 URL、调试残留
- [ ] 新增仓库卫生审计脚本，并纳入发布前检查

#### 2. `dashboard/` 与 `apps/dashboard/`
- [ ] 明确哪一个是当前前端 authority
- [ ] 非 authority 一侧标注为 `transition` 或归档
- [ ] README / ARCHITECTURE / GETTING-STARTED 全部统一口径

#### 3. `src/` 与 `packages/*`
- [ ] 为 `src/` 中仍存活的模块做 authority inventory
- [ ] 识别可迁移到 `packages/team-runtime` / `packages/agent-harness` 的模块
- [ ] 逐步消灭“同一能力双路径存在”

#### 4. `docs/archive/`
- [ ] 标注 archive 文档不可作为当前 authority
- [ ] 抽取仍有效的结论同步到正式 docs
- [ ] 退役历史保留，但降权

---

### P1：执行基座与公共契约（核心工程）

#### 5. `packages/agent-harness`
- [ ] 建统一 Model Response Normalizer
- [ ] 建统一 blocking / streaming / tool-call 协议
- [ ] 建 fallback policy（retry / breaker / provider degrade）
- [ ] 建 trace / span / run event 协议
- [ ] 让其成为唯一强执行基座

#### 6. `packages/team-runtime`
- [ ] 收敛为 TL-first orchestration / role semantics / delivery closure
- [ ] 去掉 provider-specific 兼容补丁责任
- [ ] 把 runtime 与 harness 分层写清楚

#### 7. `schemas/`
- [ ] 补齐 `task` `run` `work-item` `artifact-manifest` `evidence` `review` `judge` `callback-event`
- [ ] 建 schema versioning 说明
- [ ] 前后端、examples、API 共用同一批 schema

#### 8. `apps/api-server`
- [ ] 将 dashboard 所需 read models 与内部执行对象隔离
- [ ] API 只暴露公共可消费 contracts
- [ ] 减少宿主/私有运行假设

#### 9. `packages/tools` / `packages/im-channels`
- [ ] 划分工具权限等级
- [ ] 区分 core tools 与 optional tools
- [ ] 区分 core channels 与 optional channels

---

### P2：独立 Agent 接入与开源体验（扩展能力）

#### 10. Agent onboarding
- [ ] 定义 `agent.json` / `agent-package.json` manifest
- [ ] 定义 lifecycle：`init / observe / plan / act / review / handoff / complete`
- [ ] 设计 `agent-sdk` 或最小 authoring helper
- [ ] 保证外部 Agent 不改主干即可接入

#### 11. examples/
- [ ] 只保留强信号样例：
  - [ ] 最小 team run
  - [ ] 第三方 agent 接入
  - [ ] 自定义 tool
  - [ ] dashboard public contract
- [ ] 其余实验样例归档或降权

#### 12. 发布工程
- [ ] 补 release checklist
- [ ] 补 changelog / version story
- [ ] 将 smoke 分层为 unit / integration / product / release gates
- [ ] 对外提供最小 demo 与截图/录像证据

---

## 三、按模块拆解

### Runtime / Harness
- [ ] Harness 负责：模型归一化、工具调用、重试降级、事件流、追踪
- [ ] Team Runtime 负责：TL-first、delegation、review/judge、acceptance closure
- [ ] Team Core 负责：领域语义与公共对象

### Dashboard
- [ ] 只依赖公共 contracts
- [ ] 可视化任务、timeline、artifact、evidence、review、acceptance
- [ ] 移除内部宿主偏置命名

### Docs
- [ ] 一条最短阅读路径
- [ ] 一份最短启动路径
- [ ] 一份第三方 Agent 接入路径
- [ ] 一份部署/运维路径

### Repo Hygiene
- [ ] 审计运行产物、临时脚本、日志、报告、产物目录
- [ ] 标记 archive / experimental / transition
- [ ] 清退“内部救火逻辑”与一次性兼容层

---

## 四、执行顺序（推荐）

### 第 1 批（本周）
- [x] 仓库卫生审计脚本
- [x] 退役面盘点报告
- [x] README / ARCHITECTURE 统一 authority 口径
- [x] 明确 dashboard authority
- [x] 明确 src/packages authority inventory
- [x] 目录级 retirement inventory
- [x] 高噪音目录去留决策表（projects/services/plugins/shared/electron）

### 第 2 批
- [ ] Harness response normalize
- [ ] fallback / timeout / tool audit
- [ ] event protocol / tracing
- [ ] 公共 run/task/artifact schema

### 第 3 批
- [ ] Agent manifest + lifecycle
- [ ] 第三方 agent 样例跑通
- [ ] dashboard 改只吃公共 contracts

### 第 4 批
- [ ] 发布工程、CI、版本化、演示站、release evidence

---

## 五、完成定义（DoD）

满足以下条件，才算“达到面向 GitHub 开源的第一阶段完成”：

- [ ] 外部开发者能在 15~30 分钟内跑起最小可用版本
- [ ] 仓库主路径唯一、authority 清晰
- [ ] dashboard / API / examples 使用同一批公共 contracts
- [ ] Harness 成为强执行基座
- [ ] 第三方 Agent 能通过 contract 接入
- [ ] 仓库无明显退役面、无 secrets、无临时运行产物误导
- [ ] 有最小 demo、测试、发布说明

---

## 六、当前已启动项

- [x] 输出开源改造 TODO 总表
- [x] 启动仓库卫生与退役面审计
- [x] 收敛 authority 口径
- [x] 生成首次退役面盘点报告
- [x] 形成首批可执行清理清单
- [ ] 开始第一批低风险清理与文档固化
