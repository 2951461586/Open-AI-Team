# P4: 团队会话流式恢复

## 目标
Dashboard 与 Orchestrator 之间从 SSE 改为 WebSocket，实现真正的实时流式响应。

## 任务清单

### P4.1 前端 WS 客户端改造
- [ ] 将 `SSEEventSource` 替换为 `WebSocket` 连接
- [ ] 连接路径: `ws://<host>:18789/ws/chat?token=<dashboard_token>`
- [ ] 处理 `subscribe` / `unsubscribe` 消息
- [ ] 处理 `stream_start` / `stream_chunk` / `stream_end` 事件
- [ ] 处理 `task_created` / `task_update` 事件
- [ ] 保持向后兼容（SSE 降级可选）

### P4.2 后端 WS 验证
- [ ] 确认 WebSocket 升级握手正确
- [ ] 确认 `broadcastToDashboard` 能正确投递到所有订阅客户端
- [ ] 确认 `dispatchDashboardChat` 的 `onChunk` 回调工作正常

### P4.3 物理聊天流式增强
- [ ] `generateReplyStream` 实际分块返回（可选增强）

### P4.4 端到端测试
- [ ] Dashboard 发送消息 → WS → Orchestrator → 流式返回 → Dashboard 渲染
- [ ] 任务创建事件正确触发任务卡片更新
- [ ] 多客户端订阅隔离（scopeKey）

## 状态
- [x] P4.1 前端 WS 客户端改造（已存在 useWebSocket hook，只需配置环境变量）
- [x] P4.2 后端 WS 服务端（已加到 orchestrator/src/index.mjs）
- [x] P4.3 物理聊天流式增强（已修改 generateReplyStream）
- [x] P4.4 前端 stream 事件处理（已修复支持非 task 流式）
- [ ] P4.5 端到端测试（需要部署后验证）

## 已完成
1. **orchestrator/src/index.mjs**: 添加 WebSocket 服务器，路径 `/ws/chat`
2. **orchestrator/src/team/team-physical-chat.mjs**: 修复 generateReplyStream 返回完整内容
3. **dashboard/src/app/page.tsx**: 修复 stream_* 事件处理，支持非 task 场景
4. **dashboard/.env.local**: 添加 `NEXT_PUBLIC_ENABLE_REALTIME=1` 和 `NEXT_PUBLIC_DASHBOARD_TOKEN`

## 待完成
- [ ] 部署 dashboard 到生产环境（CloudBase）
- [ ] 验证 WS 连接和流式响应
- [ ] 检查 api.liziai.cloud 的 443 端口是否正确转发到 orchestrator
