# P7-P8：Session Capability 可视化与 Follow-up Fallback 文档化（2026-03-30）

## 背景

AI Team 在多节点角色路由已经恢复后，继续推进了 P4-P6：

- 成员任务优先尝试 `subagent mode=session`
- 若平台支持 thread-bound persistent session，则成员支持持续 follow-up
- 若平台不支持，则自动降级到 `run mode`
- follow-up 命中一次性会话、空回复、可见性受限时，由 TL 直接接管

本轮 P7-P8 的目标不是继续强推平台不支持的 persistent session，而是把**真实能力边界**正式暴露到产品与文档层。

---

## P7：Dashboard 正式显示 Session 能力

### 新增可见字段

后端查询面现在稳定暴露：

- `sessionMode`
- `sessionPersistent`
- `sessionFallbackReason`

覆盖范围：

- `/state/team/summary`
- `/state/team/workbench`
- `/state/team/board`
- `/state/team/dashboard`

### 前端展示语义

Dashboard 现已把会话能力显示到两层：

1. **任务卡（TaskCard）**
   - 增加会话模式标签：
     - `持久会话`
     - `一次性会话`
     - `旧桥兜底`
     - `TL 直答兜底`

2. **工作台（WorkbenchPanel）**
   - 增加「路由 / 会话 / 执行节点」状态卡
   - 明确显示：
     - 当前是否 persistent
     - 当前 follow-up 是否会回退 TL
     - 降级原因

---

## P8：现役 Acceptance / 架构口径

### 当前真实能力结论

#### 支持的情况

如果平台支持 `thread=true + mode=session`：

- 成员子会话可升级为 persistent session
- follow-up 可以直接打到成员持续会话
- Dashboard 显示为 `持久会话`

#### 当前环境的真实情况

当前环境下，成员 `subagent mode=session` 返回：

```text
thread=true is unavailable because no channel plugin registered subagent_spawning hooks.
```

所以当前环境的真实行为是：

- 成员执行仍可正常进行
- 角色多节点路由仍成立
- 但成员会话会自动降级为 `run mode`
- 因此成员本身不具备持续 follow-up 能力
- follow-up 必须由 TL 接管兜底，避免出现 `reply=""` 假成功

### 验收标准

以下全部满足，视为 P7-P8 验收通过：

1. Dashboard 任务卡能看见会话模式标签
2. Workbench 能看见路由 / 会话 / 节点 / 降级原因
3. `/state/team/dashboard`、`/state/team/board`、`/state/team/summary`、`/state/team/workbench` 均返回上述字段
4. follow-up 命中 run-mode 成员时，不再返回空 reply，而是 TL 直接接管并返回自然语言答复
5. follow-up 命中 persistent 成员但出现 `empty_member_reply` / 不可续聊时，不再重复二次转发给同一成员，而是**一次尝试后立即回退 TL 直答**
6. follow-up 结果会写回任务状态面：`followupRoute / lastFollowupFallbackReason / lastFollowupTargetRole / lastFollowupAssignmentId / lastFollowupChildTaskId`

---

## 一句话口径

**AI Team 现在的真实现役语义是：优先使用持久成员会话；若平台不支持，则自动降级为一次性成员执行，并由 TL 接管后续 follow-up，确保系统不会再出现“假成功空回复”。**
