
## NapCat Bridge 部署成功 (2026-03-03)

### 架构
- **服务器**: laoda (119.91.63.250)
- **Bridge 路径**: `/opt/napcat-bridge/bridge.mjs`
- **Service**: `napcat-bridge.service`
- **NapCat 容器**: `napcat` (mlikiowa/napcat-docker)
- **Bot 账号**: lizi (806543415)
- **目标群**: OpenClaw 测试 (1085631891)

### 技术要点
1. WebSocket 长连接消除 CLI 启动开销
2. Gateway 协议: `agent` 方法 + 监听 `agent` 事件流式响应
3. 流式文本是累积完整文本，直接替换而非追加
4. Markdown 清理转换为 QQ 友好纯文本

### v10 功能
- WebSocket 长连接到 Gateway
- 流式响应处理 (`agent` 事件)
- Markdown 清理:
  - `**粗体**` → 粗体
  - `` `代码` `` → 「代码」
  - `[链接](url)` → 链接: url
  - 标题/列表格式化

### 注意事项
- QQ 卡片消息需要腾讯签名，NapCat 无法直接发送
- 纯文本是最可靠的方案
