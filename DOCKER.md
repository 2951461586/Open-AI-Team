# Docker Compose 部署说明

## 生产模式

1. 准备环境变量：

```bash
cp .env.example .env
```

2. 启动：

```bash
make docker-start
```

3. 查看日志：

```bash
make docker-logs
```

4. 停止：

```bash
make docker-stop
```

## 开发模式

开发模式会：
- 挂载当前源码目录到容器内
- 保留独立 `node_modules` volume
- 使用 `node --watch src/index.mjs` 实现热重载

启动：

```bash
make docker-dev
```

或重新构建后启动：

```bash
make docker-dev-build
```

停止：

```bash
make docker-dev-stop
```

## 配置挂载

以下目录/文件会挂载到容器中：

- `./config/team` → `/app/config/team`（只读）
- `./state` → `/app/state`
- `./task_workspaces` → `/app/task_workspaces`
- `./.env` → `/app/.env`（生产 compose 中显式挂载）

因此 `config/team/*.json` 可直接在宿主机编辑并被容器读取。

## 健康检查

容器使用：

- `GET /health`

作为健康检查端点。

## 架构说明

Docker 部署采用**前后端一体化**架构：

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Container                     │
│                                                          │
│  ┌──────────────┐    ┌─────────────────────────────┐  │
│  │   Frontend    │    │         API Server           │  │
│  │  (Next.js)    │───▶│  /health, /state/team/*    │  │
│  │  Static Files │    │  /api/*, /ws/chat           │  │
│  └──────────────┘    └─────────────────────────────┘  │
│          │                      │                       │
│          │            ┌─────────────────┐               │
│          │            │  MCP Server     │               │
│          │            │  /mcp, /sse    │               │
│          │            └─────────────────┘               │
│          │                      │                       │
│          └──────────────────────┘                       │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │
                    Port 3001 (HTTP)
                    Port 7331 (MCP)
```

### 前后端通信

- **API 请求**：前端通过相对路径 `/state/team/*` 和 `/api/*` 调用后端
- **WebSocket**：前端通过 `/ws/chat` 建立实时连接
- **认证**：通过 `DASHBOARD_TOKEN` 环境变量配置

## 已知限制

### Control Plane 探测

在 Docker 容器内，`controlPlaneStatus` 会显示为 **"不适用"**：

- Docker 容器内没有 systemd（`systemctl` 命令不可用）
- 这是预期行为，不代表服务故障
- Control plane 应在宿主机或 Kubernetes 环境中独立部署

### 远端节点 SSH 探测

Docker 容器内没有 SSH 客户端，无法通过 SSH 探测远端节点状态。如需探测远端节点，应在独立的基础设施上部署。

### 建议的生产架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Kubernetes / VMs                        │
│                                                               │
│  ┌──────────────┐    ┌────────────────┐    ┌──────────────┐ │
│  │   Control    │───▶│   API Server   │───▶│  Agent Node  │ │
│  │   Plane      │    │   (Docker)     │    │   (物理机)   │ │
│  └──────────────┘    └────────────────┘    └──────────────┘ │
│                             │                                 │
│                             ▼                                 │
│                      ┌──────────────┐                        │
│                      │   Frontend   │                        │
│                      │   (Static)   │                        │
│                      └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | API Server 端口 |
| `MCP_PORT` | `7331` | MCP Server 端口 |
| `NODE_ENV` | `production` | 运行环境 |
| `DASHBOARD_TOKEN` | - | Dashboard 认证 Token |
| `NEXT_PUBLIC_ENABLE_REALTIME` | - | 启用 WebSocket（设为 `1`） |
| `IN_DOCKER` | `1` | 标识运行环境（自动设置） |

## 说明

- `Dockerfile` 使用 Node.js 22 多阶段构建。
- 生产镜像会预构建 `dashboard/` 的静态产物（`dashboard/out`）。
- 根服务仍按当前项目方式使用 `npm start` 启动。
