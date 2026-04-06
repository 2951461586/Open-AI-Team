# AI Team Harness MCP Server

轻量 MCP Server 实现，兼容 Anthropic MCP 的核心能力，不依赖 `@modelcontextprotocol/sdk`。

## 已实现

- JSON-RPC 2.0
- `stdio` 传输
- HTTP RPC: `POST /mcp`
- SSE 事件流: `GET /sse`
- MCP Tools
- MCP Resources
- MCP Prompt Templates
- 会话跟踪（内存态）

## 文件

- `src/mcp/mcp-server.mjs` — MCP Server 核心
- `src/mcp/mcp-tools.mjs` — Tools 映射层
- `src/mcp/mcp-resources.mjs` — Resources 定义
- `src/mcp/mcp-prompts.mjs` — Prompt 模板
- `config/team/mcp.json` — MCP 配置
- `scripts/start-mcp.mjs` — 启动脚本

## 启动

### stdio

```bash
node scripts/start-mcp.mjs --stdio
```

### HTTP + SSE

```bash
node scripts/start-mcp.mjs --http --port 7331
```

### 两者同时

```bash
node scripts/start-mcp.mjs --stdio --http
```

## Claude Desktop 示例

可把 stdio 命令配置为：

```json
{
  "mcpServers": {
    "ai-team-harness": {
      "command": "node",
      "args": ["/root/.openclaw/workspace/scripts/start-mcp.mjs", "--stdio"]
    }
  }
}
```

## 已暴露的 Tools

### 文件与基础运行时

来自现有 `tool-runtime` / provider：
- 日历工具
- 邮件工具
- 以及 legacy tool runtime 中已注册的基础工具

### Team 相关

- `team.task.list`
- `team.task.get`
- `team.task.create`
- `team.task.update_state`
- `team.agent.roles`
- `team.agent.members`
- `team.agent.add_member`
- `team.mailbox.list`
- `team.mailbox.append`

## Resources

- `team://{scope}/tasks`
- `team://{scope}/status`
- `team://{scope}/members`
- `team://{scope}/board`
- `team://config/roles`
- `team://config/governance`
- `team://config/tools`
- `team://config/personalities`

其中 `{scope}` 默认可用 teamId；也可用 `default` / `all` 查看最近任务聚合。

## Prompts

- `team_task`
- `agent_config`
- `code_review`

## JSON-RPC 方法

- `initialize`
- `ping`
- `tools/list`
- `tools/call`
- `resources/list`
- `resources/read`
- `prompts/list`
- `prompts/get`
- `sessions/list`

## HTTP 接口

- `GET /health`
- `POST /mcp`
- `GET /sse`

## 说明

### 关于 stdio

当前实现使用 **newline-delimited JSON**：每行一条 JSON-RPC 请求/响应。对 Claude Desktop 这类 stdio MCP 场景已经足够轻量、稳定，便于调试和集成。

### 关于 HTTP + SSE

- RPC 请求通过 `POST /mcp`
- 服务端事件（如 tool 调用通知）通过 `GET /sse`

### 与现有 runtime 的关系

MCP Tools 映射层复用了：
- `src/agent-harness-core/tool-runtime.mjs`
- `src/tools/tool-calendar.mjs`
- `src/tools/tool-email.mjs`
- `src/team/team-store.mjs`
- `config/team/roles.json`
- `config/team/governance.json`

这意味着它不是另起炉灶，而是在现有能力上做统一 MCP 暴露。

## 后续建议

如果要进一步对标更完整的 MCP 生态，下一步可以补：

1. 更严格的 capability negotiation
2. 基于配置白名单过滤 tools/resources/prompts
3. bearer token / local network auth
4. resource subscribe / list changed 通知
5. 更完整的 task / agent / scheduler / reminder 映射
6. 将更多现有工具（weather/git/reminder/browser）纳入 MCP

## 快速自测

### stdio

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node scripts/start-mcp.mjs --stdio
```

### HTTP

```bash
curl -s http://127.0.0.1:7331/health
curl -s -X POST http://127.0.0.1:7331/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
