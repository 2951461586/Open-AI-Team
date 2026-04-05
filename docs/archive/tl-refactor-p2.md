# AI Team TL 化重构方案 — P2 落地说明

> 时间：2026-03-28
> 状态：**P2 已落地**

---

## 本轮目标

在 P1 的结构骨架之上，继续把 TL runtime 推进到更像真正的 team orchestrator：

- **P2-1：child task DAG 分层执行**
- **P2-2：治理驱动的 auto-critic / auto-judge 补派**
- **P2-3：层级执行事件广播**
- **P2-4：P2 回归文档化**

---

## P2-1：child task DAG 分层执行

本轮把 TL workItems 接到了 `team-parallel-executor.mjs` 的 DAG layering 能力。

### 新行为

TL 不再把所有 workItems 一把并发 dispatch，而是：

1. 读取每个 workItem 的 `dependencies`
2. 构建 DAG steps
3. 用 `buildExecutionLayers()` 计算执行层
4. 按层执行：
   - 同层并发
   - 跨层串行

### 结果

如果 TL 产出：

- `executor(w1)`
- `critic(w1_critic)` 依赖 `w1`
- `judge(w1_judge)` 依赖 `w1_critic`

那么实际执行顺序变为：

- Layer 1：executor
- Layer 2：critic
- Layer 3：judge

而不是三者同时起跑。

---

## P2-2：治理驱动的 auto-critic / auto-judge

TL 第一次决策之后，不再完全依赖 TL 自己把 critic / judge 明写出来。

本轮新增 **治理扩展器**：

- `synthesizeGovernedWorkItems()`
- `workItemNeedsAutoCritic()`
- `workItemNeedsAutoJudge()`

### 规则

对于 executor workItem：

- 如果 governance 判断 **critic 不应跳过** → 自动补派 critic
- 如果 governance 判断 **judge 不应跳过**，或任务为高风险 / needsDecision → 自动补派 judge

### 依赖关系自动生成

- auto critic 依赖 executor workItem
- auto judge：
  - 如果有 critic → 依赖 critic
  - 否则 → 依赖 executor

### 结果

TL 即使只产出一个 executor workItem，runtime 也会把它扩展成：

- executor
- critic
- judge

前提是 governance 要求这样做。

---

## P2-3：执行层事件广播

TL runtime 新增两类 orchestration event：

- `execution.layer.started`
- `execution.layer.completed`

这让 Dashboard 后续可以直接识别：

- 当前在执行第几层
- 哪一层有哪些成员 / workItems
- 是否已经从 executor 进入 critic / judge

这一步是后面做 child task lanes / task tree UI 的关键基础。

---

## 本轮改动文件

- `orchestrator/src/team/team-tl-runtime.mjs`
- `orchestrator/docs/architecture/tl-refactor-p2.md`

---

## 核心实现点

### 新增 import

- `buildExecutionLayers` from `team-parallel-executor.mjs`

### 新增函数

- `workItemNeedsAutoCritic()`
- `workItemNeedsAutoJudge()`
- `synthesizeGovernedWorkItems()`
- `buildWorkItemExecutionLayers()`

### handleTeamRun 关键变化

- `parseTLDecision()` 后不再直接用原始 workItems
- 先做：

```js
const initialDecision = parseTLDecision(...)
const synthesizedWorkItems = synthesizeGovernedWorkItems(initialDecision)
const decision = { ...initialDecision, workItems: synthesizedWorkItems }
```

- 然后 child tasks 改为基于治理扩展后的 workItems 创建
- 执行阶段改成按 layer 循环 dispatch

---

## 验证结果

本轮已通过的关键验证：

1. **governance auto expansion 生效**
   - TL 原始只给一个 executor workItem
   - runtime 自动扩展为 executor + critic + judge

2. **child task 扩展正确**
   - childTasks 数量从 1 变为 3

3. **执行顺序正确**
   - `executor -> critic -> judge`
   - 不是全量并发

4. **结构化沉淀正确**
   - review 成功落库
   - decision 成功落库

5. **层级事件广播正确**
   - 3 层 start + 3 层 complete 全部出现

---

## 当前边界

P2 已经让 TL runtime 更接近真正 orchestrator，但还没完全到产品完成态。

### 已成立

- 治理驱动的自动补派
- child task DAG 分层执行
- layer 级可观测事件

### 还没做

- Dashboard 真正渲染 child task tree / layer lane
- TL 汇总时根据上层结果动态改写后续 workItem 指令
- 失败分支的自动 replan / selective retry
- 更细的 workItem 状态聚合与 lane UI

---

## 下一步建议（P3）

建议下一刀直接收：

1. **Dashboard child task tree / lane 展示**
2. **TL follow-up 能按 child task / layer 继续调度**
3. **失败 workItem selective retry / replan**
4. **TL 汇总与 output authority 更彻底收口**

一句话：

**P2 已把 TL runtime 从“会生成 child task 的骨架”推进成“会按治理自动补派、按 DAG 分层执行的真正编排器”。**
