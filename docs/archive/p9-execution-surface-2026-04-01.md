# P9：Skill / Tool / MCP 一等执行面（2026-04-01）

## 目标

把 `Skill / Tool / MCP` 从自然语言里的隐式提示，升级为 AI Team runtime 的**显式执行合同面**，要求：

- workItem 可显式声明 `requiredSkills / requiredTools / requiredMcpServers`
- role contract 可显式声明 `executionSurface.skills / tools / mcpServers`
- runtime 在 **plan / dynamic replan** 两处做 fail-fast 校验
- member prompt 显式展示允许面与必需面
- state / pipeline / workbench 能看到子任务的执行面绑定

## 落地结果

### 1. 合同层

`src/team/team-role-capability-contracts.mjs`

新增：

- `normalizeExecutionSurfaceList()`
- `getRoleExecutionSurfaceContract()`
- `buildExecutionSurfacePrompt()`
- `validateWorkItemExecutionSurfaceContract()`
- `validateWorkItemExecutionSurfaceContracts()`

内置 role surface（builtin fallback）已覆盖：

- planner
- critic
- judge
- executor
- observer
- monitor
- output

### 2. Runtime 主链

`src/team/team-tl-runtime.mjs`

- `normalizeWorkItem()` 新增：
  - `requiredSkills`
  - `requiredTools`
  - `requiredMcpServers`
- `buildMemberPrompt()` 新增 `## Skill / Tool / MCP 执行面` 区块
- `createChildTask()` 会把 execution surface 写入 child task metadata
- `handleTeamRun()` 在 plan 阶段新增 execution surface fail-fast
- dynamic replan 追加 workItems 时，同样校验 execution surface
- final summary 能输出 execution surface contract fail-fast 结果

错误码：

- `role_execution_surface_contract_invalid`
- `dynamic_role_execution_surface_contract_invalid`
- 细分 mismatch：
  - `role_skill_surface_mismatch`
  - `role_tool_surface_mismatch`
  - `role_mcp_surface_mismatch`

### 3. State / Query / Dashboard

`src/routes/index-routes-health-state.mjs`

- `snapshotTask()` 现在会收集 parent task 的 child tasks
- child task payload 新增 `executionSurface`
- `/state/team/pipeline` 新增：
  - `childTasks[]`
  - `executionSurface.{childTaskCount, skillBoundCount, toolBoundCount, mcpBoundCount}`
- `/state/team/workbench` 新增：
  - `board.childTasks[]`
  - `summary.executionSurface`

`dashboard/src/components/panels/WorkbenchPanel.tsx`

新增 **Skill / Tool / MCP 执行面** 展示区块，直接显示：

- 子任务标题 / role / state / assignmentId
- requiredSkills
- requiredTools
- requiredMcpServers
- 顶部统计（Skill / Tool / MCP 绑定数）

## 验收

新增 smoke：

`scripts/team/team-execution-surface-contract-smoke.mjs`

覆盖：

1. plan-stage execution surface fail-fast
2. member prompt 注入 execution surface 合同
3. pipeline / workbench 暴露 child task execution surface
4. dynamic replan execution surface fail-fast

结果：**27 / 27 通过**

## 回归

通过：

- `team-role-capability-contract-smoke.mjs`
- `team-followup-fallback-mainline-smoke.mjs`
- `team-session-completion-event-smoke.mjs`
- `team-dag-fail-fast-smoke.mjs`
- dashboard `tsc --noEmit`

## 当前口径

从 P9 起，`Skill / Tool / MCP` 不再只是 prompt 里的“建议”，而是：

- **可声明**
- **可校验**
- **可持久化**
- **可查询**
- **可视化**

也就是：**一等执行面。**
