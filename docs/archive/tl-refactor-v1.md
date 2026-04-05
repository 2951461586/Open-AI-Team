# AI Team TL 化重构方案 v1

> 生成时间：2026-03-28
> 状态：**历史快照／已退出现役主入口**
>
> 当前请优先阅读：
> - `current-team-runtime-architecture.md`
> - `current-product-boundaries-and-compat.md`
> - `independent-agent-onboarding.md`
> - `standalone-harness-baseline-release.md`
> - `release-preflight-retirement-inventory.md`

---

## 一、背景与问题

引入 TL 系统后，AI Team 形成了"TL 前台 + 旧 pipeline 后台"的双控制面并存状态。
核心问题不是"TL 不够聪明"，而是 **TL 与 team runtime 没统一任务模型、执行协议、验收闭环、续聊路由、治理规则**。

### 当前架构的关键缺陷

| # | 缺陷 | 严重度 | 状态 |
|---|------|--------|------|
| D1 | 单 sessionKey 模型：多 member 并行时后写覆盖，续聊绑错 session | **Critical** | P0 已修 ✅ |
| D2 | TL spawn 绕开统一路由层（多节点、工具沙箱、生命周期） | **High** | P0 已修 ✅ |
| D3 | 任务状态过粗（只有 approved/done），缺少中间执行状态 | **High** | P0 已修 ✅ |
| D4 | 续聊默认绑到随机 member session，不经过 TL | **High** | P0 已修 ✅ |
| D5 | TL 决策协议太薄（只有 role + task 字符串） | Medium | P1 待做 |
| D6 | TL 路径没利用 governance/blackboard/mailbox/artifact contract | Medium | P1 待做 |
| D7 | partial_delegate 语义空壳 | Medium | P1 待做 |
| D8 | Dashboard 替后端修 deliverable 语义 | Medium | P2 待做 |
| D9 | 事件流非结构化（snippet 轮询） | Low | P2 待做 |
| D10 | 文档口径与实际运行口径漂移 | Low | P2 待做 |

---

## 二、P0 改造（已完成 ✅）

### P0-1：多 session 模型

**变更文件**：`src/team/team-tl-runtime.mjs`

**核心改动**：
- task metadata 新增：`sessionsByRole`、`sessionsByAssignment`、`primarySessionKey`、`tlSessionKey`、`followupRoute`
- 每次 member spawn 时按 role + assignmentId 双键写入
- primarySessionKey 保持首个 spawn 的 session（向下兼容 legacy `sessionKey` 字段）
- 新增 `readTaskSessions()` 和 `writeSessionToTask()` 辅助函数

**数据结构**：
```json
{
  "sessionsByRole": {
    "executor": { "sessionKey": "sess-xxx", "runId": "...", "assignmentId": "a1", "spawnedAt": 123 },
    "critic": { "sessionKey": "sess-yyy", "runId": "...", "assignmentId": "a2", "spawnedAt": 124 }
  },
  "sessionsByAssignment": {
    "a1": { "sessionKey": "sess-xxx", "runId": "...", "role": "executor", "spawnedAt": 123 },
    "a2": { "sessionKey": "sess-yyy", "runId": "...", "role": "critic", "spawnedAt": 124 }
  },
  "primarySessionKey": "sess-xxx",
  "tlSessionKey": "",
  "followupRoute": "tl"
}
```

### P0-2：统一 spawn 路由

**变更文件**：`src/team/team-tl-runtime.mjs`、`src/index-bootstrap.mjs`

**核心改动**：
- 新增 `unifiedSpawnSession()` 三级降级链：spawnSessionAdapter → multiNodeGateway → legacy gateway
- `index-bootstrap.mjs` 将 `spawnSessionAdapter` 和 `multiNodeGateway` 注入 TL runtime
- TL 路径现在走与旧 runtime 相同的多节点路由、工具沙箱、生命周期治理

**降级策略**：
```
Tier 1: spawnSessionAdapter（全能力：多节点 + 工具沙箱 + 生命周期）
Tier 2: multiNodeGateway（节点路由，无全适配器包装）
Tier 3: legacy gateway（本地直连 18789）
```

### P0-3：任务状态细化

**变更文件**：`src/team/team-tl-runtime.mjs`

**新状态流转**：
```
analyzing → delegating → executing → summarizing → done
                                                 → blocked
                                                 → replanning
```

**兼容说明**：
- Dashboard 的 task state 展示不受影响，新状态在 UI 中会按已有逻辑映射为可读标签
- 旧 pipeline 的状态流转（pending → planning → plan_review → approved → done）不受影响

### P0-4：续聊默认回 TL

**变更文件**：`src/team/team-tl-runtime.mjs`、`src/routes/team-route-dispatch-v2.mjs`、`dashboard/src/lib/api.ts`、`dashboard/src/components/panels/TaskChatPanel.tsx`

**核心改动**：
- `handleTaskChat` 新增 `target` 参数（可选）
- 无 target 时默认路由到 TL，TL 决定：直接答 / 转发给某 member
- 支持 target 为角色名（executor/critic）或 assignment id（a1/a2）
- 新增 `handleTLFollowup()` 函数，TL 拿到任务上下文后决策续聊路由
- API `/api/chat/task` 接受可选 `target` 字段
- Dashboard `TaskChatPanel` 支持 `/ask <role> <message>` 命令语法
- Dashboard 展示路由来源标注（TL 直接回复 / TL 转发给成员 / 成员回复）

---

## 三、P1 方案（待执行）

### P1-1：TL 决策协议 v2

当前 TL 输出：
```json
{ "action": "delegate", "assignments": [{ "role": "executor", "task": "..." }] }
```

升级为：
```json
{
  "action": "delegate",
  "workItems": [
    {
      "id": "w1",
      "role": "executor",
      "objective": "实现 hello world 功能",
      "context": "使用 Node.js，输出到 stdout",
      "acceptance": "文件存在且 node hello.js 输出 Hello World",
      "deliverables": ["hello.js"],
      "dependencies": [],
      "preferredNode": "violet",
      "toolProfile": "executor",
      "timeoutMs": 120000,
      "riskLevel": "low"
    }
  ],
  "replanPolicy": "on_failure",
  "escalationPolicy": "after_2_retries"
}
```

### P1-2：每个 assignment 变成真正 child task

- 在 team_tasks 表中创建 parentTaskId 指向根任务的子任务
- 子任务独立跟踪状态、独立绑定 session
- Dashboard 任务树展示

### P1-3：member 结果结构化

从自然语言回复升级为：
```json
{
  "status": "completed",
  "summary": "已创建 hello.js",
  "deliverables": [{ "path": "hello.js", "type": "file" }],
  "issues": [],
  "needsReplan": false,
  "needsHuman": false
}
```

### P1-4：接入 governance runtime

- TL 决策前咨询 governance：是否需要 critic/judge
- 任务状态变更经 governance 审批
- 超时/失败触发 governance 升级策略

### P1-5：接入 mailbox/blackboard

- TL 每次决策写入 mailbox
- member 结果写入 blackboard
- 子任务创建/完成写入 mailbox
- Dashboard 可从 mailbox 重建完整决策链

---

## 四、P2 路线图

### P2-1：旧 runtime 降为执行底座

- TL 正式成为唯一入口 authority
- 旧 pipeline（planner→critic→judge→executor）作为 TL 可调度的"复杂任务模板"
- 简单任务 TL 直接派 executor，不走完整 pipeline

### P2-2：结构化事件合同

从 snippet 轮询升级为类型化事件：
```
task.analysis.started / completed
assignment.created / started / progress / blocked / completed
replan.triggered / applied
deliverable.proposed / verified
task.closed
```

### P2-3：Dashboard 消费统一任务对象

- TaskChatPanel 支持多 session lane 切换
- ArtifactsPanel 按 assignment 分组展示
- 任务树视图
- 从 session history 做真实会话回放

### P2-4：文档对齐

- `current-team-runtime-architecture.md` 更新为 TL-first 架构
- API 文档补充 TL 决策协议
- 部署图补充 TL spawn 路由

---

## 五、P0 改造文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/team/team-tl-runtime.mjs` | **重写** — 多 session、统一 spawn、状态细化、TL 续聊 |
| `src/index-bootstrap.mjs` | **修改** — 注入 spawnSessionAdapter + multiNodeGateway |
| `src/routes/team-route-dispatch-v2.mjs` | **修改** — task chat 接口支持 target 参数 |
| `dashboard/src/lib/api.ts` | **修改** — sendTaskChat 支持 target 参数 |
| `dashboard/src/components/panels/TaskChatPanel.tsx` | **重写** — /ask 命令、路由标注、TL 默认 |

**回滚点**：`src/team/team-tl-runtime.mjs.bak.<timestamp>`

---

## 六、测试验证

P0 改造通过 8 项单元测试：

1. ✅ parseTLDecision — delegate + auto-id
2. ✅ parseTLDecision — direct reply
3. ✅ readTaskSessions — 多 session 读取
4. ✅ handleTeamRun — 完整 delegation 流程（多 session 写入验证）
5. ✅ handleTaskChat — 默认路由到 TL
6. ✅ handleTaskChat — 显式 target 到 executor
7. ✅ handleTaskChat — 显式 target 到 assignment id
8. ✅ handleTeamRun — TL 直接回复（无 delegation）
