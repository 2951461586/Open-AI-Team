# Docker 部署说明

## 快速部署

```bash
# 1. 克隆项目
git clone <repo-url>
cd <project-dir>

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 LLM API Key

# 3. 启动服务
docker compose up -d

# 4. 查看状态
docker compose ps
```

## 生产模式

```bash
docker compose up -d
```

查看日志：

```bash
docker compose logs -f
```

停止：

```bash
docker compose down
```

## 开发模式（热重载）

```bash
make docker-dev
# 或
docker compose -f docker-compose.dev.yml up
```

开发模式会：
- 挂载当前源码目录到容器内
- 使用 `node --watch src/index.mjs` 实现热重载

## 架构说明

Docker 部署采用**前后端一体化**架构，容器内运行完整的服务栈：

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Container                      │
│                                                          │
│  ┌──────────────┐    ┌─────────────────────────────┐  │
│  │   Frontend    │    │         API Server          │  │
│  │  (Next.js)    │───▶│  /health                   │  │
│  │  Static Files │    │  /api/v1/state/team/*      │  │
│  └──────────────┘    │  /api/v1/team/*             │  │
│                      │  /mcp, /ws/chat             │  │
│                      └─────────────────────────────┘  │
│                            │                           │
│                      Port ${PORT:-19090} (HTTP)         │
└─────────────────────────────────────────────────────────┘
```

### 前后端通信

- **API 请求**：前端通过相对路径 `/api/v1/*` 调用后端
- **WebSocket**：前端通过 `/ws/chat` 建立实时连接
- **认证**：通过 `DASHBOARD_TOKEN` 环境变量配置

### 健康检查

容器使用 `GET /health` 作为健康检查端点。

## 配置挂载

以下目录/文件会挂载到容器中：

- `./config/team` → `/app/config/team`（只读）
- `./state` → `/app/state`
- `./task_workspaces` → `/app/task_workspaces`
- `./.env` → `/app/.env`（生产 compose 中通过 env_file 注入）

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `19090` | API Server 端口 |
| `NODE_ENV` | `production` | 运行环境 |
| `LLM_PROVIDER` | `openai` | LLM 服务商 |
| `LLM_MODEL` | `gpt-4o-mini` | LLM 模型 |
| `OPENAI_API_KEY` | - | OpenAI API Key |
| `DASHBOARD_TOKEN` | - | Dashboard 认证 Token |

## 生产建议

- 使用 Docker Compose 或 Kubernetes 进行容器编排
- 配置持久化存储（`state` 和 `task_workspaces` 目录）
- 设置合适的资源限制（CPU、内存）
- 配置日志收集和监控
