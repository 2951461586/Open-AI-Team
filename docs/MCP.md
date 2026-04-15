# MCP Server Configuration Guide

## Overview

AI Team Harness supports MCP (Model Context Protocol) for extending tool capabilities and integrating with external MCP servers.

## Quick Start

### 1. Enable MCP Server

Edit `config/team/mcp.json`:

```json
{
  "auth": {
    "enabled": true,
    "bearerToken": "your-secure-token",
    "allowLocalhostWithoutAuth": false
  }
}
```

### 2. Connect External MCP Servers

Add to `mcp.json`:

```json
{
  "clients": [
    {
      "name": "filesystem",
      "url": "http://localhost:8090/mcp",
      "token": "optional-token",
      "enabled": true
    }
  ]
}
```

## Configuration Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | number | 1 | Config version |
| `name` | string | AI Team Harness MCP | Server name |
| `serverVersion` | string | 1.0.0 | Server version |
| `transport` | string | both | Transport type: stdio, http, or both |
| `host` | string | 127.0.0.1 | HTTP host |
| `port` | number | 7331 | HTTP port |
| `auth.enabled` | boolean | false | Enable authentication |
| `auth.bearerToken` | string | - | Bearer token |
| `auth.allowLocalhostWithoutAuth` | boolean | true | Allow localhost without auth |

## Built-in Tools

| Tool | Description |
|------|-------------|
| `team.task.list` | List team tasks |
| `team.task.get` | Get task details |
| `team.task.create` | Create new task |
| `team.task.update_state` | Update task state |
| `team.agent.roles` | List team roles |
| `team.agent.members` | List team members |
| `team.mailbox.list` | List mailbox messages |
| `team.mailbox.append` | Append mailbox message |

## HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/mcp` | POST | JSON-RPC endpoint |
| `/sse` | GET | Server-Sent Events |

## Usage Examples

### CLI Mode

```bash
node src/mcp/mcp-server.mjs --stdio
```

### HTTP Mode

```bash
node src/mcp/mcp-server.mjs --http --port 7331
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ai-team": {
      "command": "node",
      "args": ["/path/to/src/mcp/mcp-server.mjs", "--stdio"],
      "env": {
        "ROOT_DIR": "/path/to/project"
      }
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "ai-team": {
      "command": "node",
      "args": ["./src/mcp/mcp-server.mjs", "--stdio"]
    }
  }
}
```

## Security

- Always use authentication in production
- Use strong bearer tokens
- Restrict tool access using `allowlist`
- Enable HTTPS for production HTTP endpoints
