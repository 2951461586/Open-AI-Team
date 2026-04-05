# AI Team TL 化重构方案 — P1 落地说明

> 时间：2026-03-28
> 状态：**P1 已落地**

---

## 本轮目标

在 P0 的基础上，把 TL runtime 从“会分配任务的多 session 壳”继续推进到**真正有结构合同、child task、治理接线、结构化结果沉淀**的运行层。

本轮完成：

- **P1-1：TL 决策协议 v2**
- **P1-2：assignment → child task 骨架**
- **P1-3：member 结果结构化落库**
- **P1-4：governance 接入 TL 路径**

---

## P1-1：TL 决策协议 v2

旧协议：

```json
{
  "action": "delegate",
  "assignments": [
    { "role": "executor", "task": "..." }
  ]
}
```

新协议：

```json
{
  "action": "delegate",
  "summary": "为什么这样拆",
  "taskMode": "general",
  "riskLevel": "medium",
  "workItems": [
    {
      "id": "w1",
      "role": "executor",
      "title": "实现功能",
      "objective": "要完成的目标",
      "task": "给成员的具体指令",
      "acceptance": "验收标准",
      "deliverables": ["hello.js"],
      "dependencies": [],
      "riskLevel": "medium",
      "needsReview": false,
      "needsDecision": false,
      "context": "补充背景"
    }
  ]
}
```

### 升级点

- assignment 升级为 **workItem** 概念
- 明确支持：
  - `title`
  - `objective`
  - `acceptance`
  - `deliverables`
  - `dependencies`
  - `riskLevel`
  - `needsReview`
  - `needsDecision`
- `partial_delegate` 仍保留，并可同时携带 `directReply + workItems`

---

## P1-2：assignment → child task

每个 TL workItem 在 teamStore 中创建为一个真正的 **child task**：

- `parent_task_id = root task`
- child task 独立：
  - title
  - description
  - state
  - dependencies
  - metadata

### child task metadata 新增内容

```json
{
  "scopeKey": "dashboard",
  "taskMode": "general",
  "riskLevel": "medium",
  "workItemId": "w1",
  "workItemRole": "executor",
  "objective": "创建 hello.js",
  "acceptance": "node hello.js 输出 Hello World",
  "deliverables": ["hello.js"],
  "governance": {
    "critic": { "skip": false, "reason": "" },
    "judge": { "skip": true, "reason": "not_high_risk" }
  }
}
```

### parent task metadata 新增内容

```json
{
  "childTaskIds": ["task:...", "task:..."],
  "workItemToChildTask": {
    "w1": "task:...",
    "w2": "task:..."
  }
}
```

---

## P1-3：member 结果结构化落库

成员执行结果优先要求按结构化 JSON 返回：

```json
{
  "ok": true,
  "status": "completed",
  "summary": "一句话总结结果",
  "deliverables": [{ "path": "hello.js", "type": "file", "title": "hello.js" }],
  "issues": [],
  "needsReplan": false,
  "needsHuman": false
}
```

### 落库策略

#### 通用落库

所有 workItem 统一写入：

- **artifact**：每个 child task 一条结果产物
- **mailbox**：`workitem.created` / `workitem.result`
- **blackboard**：`section=tl_runtime`，按 `workItemId` 记录

#### 角色特化落库

- `planner` → `insertPlan()`
- `critic` → `insertReview()`
- `judge` → `insertDecision()`
- `executor` → `artifactType=deliverable`

---

## P1-4：governance 接入 TL 路径

`index-bootstrap.mjs` 已把 `governanceRuntime` 注入 `createTLRuntime()`。

TL 在创建 child task 时，会基于：

- `taskMode`
- `riskLevel`
- workItem 级别风险

调用：

- `governanceRuntime.shouldSkipStage('critic', ctx)`
- `governanceRuntime.shouldSkipStage('judge', ctx)`

并把结果写进 child task metadata。

TL 汇总阶段还会调用：

- `governanceRuntime.shouldEscalateToHuman(ctx)`

决定 root task 的最终态：

- `done`
- `replanning`
- `blocked`

---

## 本轮改动文件

- `orchestrator/src/team/team-tl-runtime.mjs`
- `orchestrator/src/index-bootstrap.mjs`
- `orchestrator/docs/architecture/tl-refactor-p1.md`

---

## 验证结果

本轮通过的核心测试：

1. **TL v2 决策解析通过**
2. **结构化 member result 解析通过**
3. **完整 P1 run 通过**：
   - root task 创建
   - 3 个 child task 创建
   - parent / child state 正确流转
   - multi-session tracking 正常
   - review / decision 成功落库
   - artifact / mailbox / blackboard 成功落库
4. **task chat 默认回 TL**
5. **显式 target=role 路由通过**
6. **显式 target=workItemId 路由通过**

---

## 当前边界

P1 目前是**结构骨架成立**，但还没把 old pipeline 全量合并进 TL authority。

### 已成立

- TL 决策 v2
- child task 模型
- 结构化结果沉淀
- governance 第一层接线

### 还没做

- child task DAG 调度真正按 dependency 分层执行
- TL 内建自动二次派 critic / judge（目前主要依赖 TL 首次决策直接给出 workItems）
- Dashboard task tree / child task lane 可视化
- output authority 与 TL 汇总态进一步统一

---

## 下一步建议（P2）

下一刀建议直接做：

1. **child task DAG 调度器**
2. **TL 二次补派 critic / judge 自动化**
3. **Dashboard 展示 child task tree / workItem lane**
4. **TL summary → output authority 收口统一**

一句话：

**P1 已把 TL runtime 从“会分配的壳”推进成“有结构合同、有 child task、有治理痕迹的团队运行骨架”。**
