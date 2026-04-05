# Team Ingress Envelope（team.async_ingress.v1 / team.visible_ingress.v1）

> 目标：把“三节点异步 ingress / 可见消息 ingress”统一纳入 **`POST /internal/team/ingress`** 的规范入口，并落入 Team Runtime 的治理主链（mailbox / blackboard / evidence / task metadata）。`/webhook/qq` 保留为兼容入口，不再作为主叙事入口。

---

## 1．设计边界（必须明确）

- **规范入口**：`POST /internal/team/ingress`（需 `x-orch-token`，推荐给 node / bridge / acceptance 使用）。
- **兼容入口**：`POST /webhook/qq`（保留兼容，不再作为主叙事入口）。
- **协议统一**：所有跨节点异步消息都应包装为 ingress envelope。
- **治理落点统一**：进入 Team Runtime 后，必须能在 `/state/team/*` 查询面回放。

---

## 2．Envelope 类型

### A）team.async_ingress.v1（通用异步入口）
用于：跨节点“发起编排”的异步消息（例如节点侧探测、手工触发、异步回执、跨节点广播等）。

### B）team.visible_ingress.v1（群内可见消息入口）
用于：把“群内可见消息”也纳入主链（例如：某节点在群里说了什么、引用了哪个 task、触发了哪个后续动作）。

> 当前实现上：两者在 ingress 层等价，差异主要体现在 `ingressKind` 与后续治理/路由策略。

---

## 3．字段定义（规范化后的 canonical fields）

> `/internal/team/ingress` 会对 envelope 做 normalize，把字段映射到 Team Runtime 统一使用的一组字段；`/webhook/qq` 复用同一套 normalize，但仅作为兼容表面。

### 必填字段

- `kind`：`team.async_ingress.v1` 或 `team.visible_ingress.v1`
- `payload.messageId`：本次 ingress 的稳定事件 ID（用于追溯与去重）
- `payload.scopeKey`：例如 `group:<recipientId>` 或 `dashboard:<workspace>`
- `payload.originNode`：发起 ingress 的节点或组件标识
- `payload.senderId`：发起者标识（人或节点侧组件）
- `payload.text`：消息正文（可为空，但建议有）

### 推荐字段

- `payload.deliveryTarget`：兼容字段；历史上常承载投递目标字符串
- `payload.recipientId`：平台中立目标 ID（推荐新写法）
- `payload.recipientType`：平台中立目标类型，如 `group | workspace`
- `payload.channel`：如 `external | dashboard | feishu`
- `payload.taskMode`：`analysis | build | config-change | general`（会影响 risk）
- `payload.riskLevel`：`low | medium | high`

---

## 4．请求示例

```json
{
  "kind": "team.async_ingress.v1",
  "payload": {
    "messageId": "async-ingress:9c5d...",
    "scopeKey": "group:ops-room",
    "deliveryTarget": "ops-room",
    "recipientId": "ops-room",
    "recipientType": "group",
    "originNode": "node-c",
    "senderId": "monitor.node-c",
    "channel": "external",
    "taskMode": "analysis",
    "riskLevel": "medium",
    "text": "monitor detected an issue and routed it into the team runtime"
  }
}
```

---

## 5．落库与可观测性（治理锚点）

进入 Team Runtime 后，预期可观测落点：

- Task metadata：
  - `source = async_ingress`
  - `ingressKind = team.async_ingress.v1 | team.visible_ingress.v1`
  - `originNode` / `deliveryTarget` / `recipientId` / `recipientType` / `sourceEventId`

- Blackboard：
  - `section=ingress, entryKey=async_ingress`

- Mailbox：
  - `kind=async_ingress.accepted`

- Evidence：
  - `evidenceType=async_ingress.accepted`

---

## 6．查询面

- 列表：`GET /state/team/ingress?limit=50`
- 过滤：
  - `GET /state/team/ingress?originNode=node-c`
  - `GET /state/team/ingress?deliveryTarget=1085631891`
  - `GET /state/team/ingress?recipientId=1085631891&recipientType=group`

当前 `items[]` 稳定包含：

- `taskId`
- `teamId`
- `state`
- `taskMode`
- `riskLevel`
- `sourceEventId`
- `ingressKind`
- `originNode`
- `deliveryTarget`
- `recipientId`
- `recipientType`
- `deliveryMode`
- `senderId`
- `channel`
- `source`

---

## 7．兼容性说明

- envelope normalize 会把字段映射到：
  - `scopeKey/scope_key`
  - `messageId/message_id`
  - `originNode/bridgeNode`
  - `deliveryTarget`（兼容字段）
  - `recipientId/recipient_id`
  - `recipientType/recipient_type`

- 新写法优先使用 `group:<recipientId>` / `dashboard:<workspace>` 这类平台中立 `scopeKey`。
- `qq_group_id/group_id` 只允许停留在兼容入口读取层，不再进入 Team Runtime 主链的 canonical contract。
- 未提供 `taskMode/riskLevel` 时，会回落到 `TEAM_POLICY` 的文本分类逻辑。
