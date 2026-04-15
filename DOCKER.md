# Docker Compose 部署说明

## 一键部署

```bash
# 1. 克隆项目
git clone <repo-url>
cd <project-dir>

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 设置必要的配置

# 3. 构建并启动
docker-compose up -d --build

# 4. 查看状态
docker-compose ps
```

## 生产模式

```bash
docker-compose up -d
```

查看日志：

```bash
docker-compose logs -f
```

停止：

```bash
docker-compose down
```

## 开发模式

开发模式会：
- 挂载当前源码目录到容器内
- 保留独立 `node_modules` volume
- 使用 `node --watch src/index.mjs` 实现热重载

```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

## 架构说明

Docker 部署采用**前后端一体化**架构，容器内运行完整的服务栈：

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Container                      │
│                                                          │
│  ┌──────────────┐    ┌─────────────────────────────┐  │
│  │   Frontend    │    │         API Server         │  │
│  │  (Next.js)    │───▶│  /health, /state/team/*  │  │
│  │  Static Files │    │  /api/*, /ws/chat         │  │
│  └──────────────┘    └─────────────────────────────┘  │
│          │                      │                       │
│          │            ┌─────────────────┐             │
│          │            │  MCP Server      │             │
│          │            │  /mcp, /sse     │             │
│          │            └─────────────────┘             │
│          │                      │                     │
│          └──────────────────────┘                     │
└─────────────────────────────────────────────────────────┘
                          │
                    Port 3001 (HTTP)
                    Port 7331 (MCP)
```

### 前后端通信

- **API 请求**：前端通过相对路径 `/state/team/*` 和 `/api/*` 调用后端
- **WebSocket**：前端通过 `/ws/chat` 建立实时连接
- **认证**：通过 `DASHBOARD_TOKEN` 环境变量配置

### 健康检查

容器使用 `GET /health` 作为健康检查端点。

## 配置挂载

以下目录/文件会挂载到容器中：

- `./config/team` → `/app/config/team`（只读）
- `./state` → `/app/state`
- `./task_workspaces` → `/app/task_workspaces`
- `./.env` → `/app/.env`（生产 compose 中显式挂载）

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `19090` | API Server 端口 |
| `MCP_PORT` | `7331` | MCP Server 端口 |
| `NODE_ENV` | `production` | 运行环境 |
| `DASHBOARD_TOKEN` | - | Dashboard 认证 Token |
| `NEXT_PUBLIC_ENABLE_REALTIME` | - | 启用 WebSocket（设为 `1`） |
| `IN_DOCKER` | `1` | 标识运行环境（自动设置） |
| `CONTAINER` | - | 备用容器标识 |

## 服务状态说明

在 Docker 环境中运行时，服务状态显示为 **"健康"**：

- Docker 容器本身提供了进程隔离和管理
- 不依赖 systemd 或其他系统服务管理器
- Control Plane 状态通过容器健康检查机制监控

## 远程节点探测

Docker 容器内不支持 SSH 远程节点探测。如需探测远程节点，请：

1. 在远程节点上部署独立的 Agent 服务
2. 使用 HTTP API 进行健康检查
3. 通过 `ssh` 从宿主机进行远程探测

## 生产建议

- 使用 Docker Compose 或 Kubernetes 进行容器编排
- 配置持久化存储（`state` 和 `task_workspaces` 目录）
- 设置合适的资源限制（CPU、内存）
- 配置日志收集和监控
- 使用反向代理（Nginx）进行 SSL 终止和负载均衡
