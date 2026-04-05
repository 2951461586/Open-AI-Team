# tl-runtime

## 目标

`tl-runtime/` 是 `team-tl-runtime.mjs` 的分层执行面。
主文件负责：

- TL authority
- 顶层 wiring
- team/task 创建入口
- 把决策接到 delegated execution 主链

这个目录负责：

- prompt 构建
- decision 解析
- work-item 规范化
- memory 注入
- artifact / state 写回
- execution / follow-up / single-flight / fail-fast / orchestration

---

## 推荐阅读顺序

| 顺序 | 文件 | 为什么先看它 |
|---|---|---|
| 1 | `common.mjs` | 最基础的 parse / ensure / risk / fallback policy |
| 2 | `work-item.mjs` | 看清 workItem 的 canonical shape |
| 3 | `decision.mjs` | TL 输出如何变成 decision |
| 4 | `prompt.mjs` | TL / member prompt 怎么拼 |
| 5 | `memory.mjs` | 三层 memory / blackboard 注入逻辑 |
| 6 | `artifact.mjs` | 结果如何落 artifact |
| 7 | `runtime-harness.mjs` | execution harness glue 和 session 判定 |
| 8 | `execution.mjs` | 真正的 spawn / wait / result writeback |
| 9 | `followup.mjs` | follow-up / member continuation |
| 10 | `single-flight.mjs` | 活跃任务复用 |
| 11 | `fail-fast.mjs` | capability / execution-surface / DAG 守门 |
| 12 | `planning.mjs` | governed workItem 扩展、child task 创建 |
| 13 | `orchestration.mjs` | delegated execution 总控 |

---

## 文件职责

| 文件 | 职责 |
|---|---|
| `common.mjs` | 基础通用工具 |
| `work-item.mjs` | `normalizeWorkItem` / `resolveTimeout` |
| `decision.mjs` | `parseTLDecision` |
| `prompt.mjs` | TL / member prompt 构建 |
| `memory.mjs` | L1/L2/L3 memory、blackboard 提取/注入、upstream context |
| `artifact.mjs` | artifact 写入 |
| `runtime-harness.mjs` | execution harness 组装、spawn/session/follow-up 判定 glue |
| `execution.mjs` | member spawn / session wait / completion / result writeback |
| `followup.mjs` | TL follow-up、member follow-up、session continuation |
| `single-flight.mjs` | 同 scope 活跃任务复用 |
| `fail-fast.mjs` | capability / execution-surface / DAG fail-fast |
| `planning.mjs` | governed workItems、child task、result line summary |
| `orchestration.mjs` | delegated execution loop、retry、review loop、dynamic replan、final summary |

---

## 边界约定

### 1．不要把大逻辑重新塞回主文件

如果逻辑满足以下任一条件，优先放在 `tl-runtime/`：

- 可以独立解释职责
- 可以被 smoke 断言到
- 需要独立演进
- 会让 `team-tl-runtime.mjs` 明显变厚

### 2．主文件保留什么

`team-tl-runtime.mjs` 应优先只保留：

- authority
- wiring
- team/task 创建入口
- top-level routing
- very small glue

### 3．跨模块传参原则

优先显式依赖注入，不偷读外层闭包。
尤其注意这些字段名必须保持一致：

- `dependencies`
- `requiredCapabilities`
- `requiredSkills`
- `requiredTools`
- `requiredMcpServers`
- `expectedContractVersion`
- `expectedOutputType`

### 4．改动后最小验证

至少跑：

```bash
node --check src/team/team-tl-runtime.mjs
node --check src/team/tl-runtime/*.mjs
npm run smoke:team
```

若动了 harness 组装或 helper-factory 口径，再补：

```bash
node scripts/team/team-harness-authority-smoke.mjs
```

---

## 当前维护目标

当前目录的目标不是继续“功能堆叠”，而是：

- 让 TL runtime 更像装配层
- 让 helper 边界稳定
- 让 smoke / docs / code 口径一致
- 降低以后继续拆分时的认知成本
