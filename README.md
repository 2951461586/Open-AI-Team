# AI Team Runtime

开源的**团队式多 Agent 运行时**，支持规划、委派、评审和基于证据的交付。

[English](./README.zh-CN.md) | [简体中文](./README.md)

---

## 核心能力

| 能力 | 说明 |
|------|------|
| **TL-first 执行模型** | 所有请求先进入 Team Leader，由 TL 决定直接回答或委派给其他角色 |
| **团队协作** | 支持 Planner / Executor / Critic / Judge 风格的委派与评审闭环 |
| **证据驱动交付** | 输出包括 artifacts、evidence、deliverables、acceptance traces |
| **可观测性** | 内置 LangSmith + Langfuse 追踪，完整 trace span 管理 |
| **Skills 系统** | 内置 Skills，支持 Markdown SKILL.md 格式，渐进加载 |
| **Sub-Agent 隔离** | 独立上下文，支持动态 spawn |
| **记忆管理** | 三层记忆 + 自然衰减 + 语义检索 |
| **MCP 集成** | 支持 MCP Server 适配器 |

---

## 快速开始

### 1. 配置环境

```bash
cp .env.example .env
# 编辑 .env，填入你的 LLM API Key
```

### 2. 启动服务

**Docker 部署（推荐）**

```bash
make deploy
# 访问 http://localhost:19090
```

**本地开发**

```bash
pnpm install
pnpm run dev
```

---

## 部署方式

| 方式 | 命令 | 说明 |
|------|------|------|
| **Docker 一键部署** | `make deploy` | 推荐，自动构建并启动 |
| **Docker Compose** | `docker compose up -d` | 标准部署 |
| **本地开发** | `pnpm run dev` | 开发模式 |

详细说明见 [INSTALL.md](./INSTALL.md)、[DOCKER.md](./DOCKER.md)

---

## API 端点

所有 API 统一使用 `/api/v1/` 前缀：

| 类别 | 端点 | 说明 |
|------|------|------|
| **聊天** | `POST /api/v1/team/chat` | 创建对话 |
| | `POST /api/v1/team/chat/task` | 任务内聊天 |
| **状态** | `GET /api/v1/state/team` | 团队概览 |
| | `GET /api/v1/state/team/summary` | 任务摘要 |
| | `GET /api/v1/state/team/workbench` | 工作台 |
| | `GET /api/v1/state/team/artifacts` | 产物列表 |
| | `GET /api/v1/state/team/evidence` | 证据列表 |
| **任务** | `POST /api/v1/team/tasks/:id/control` | 任务控制 |
| | `GET /api/v1/team/tasks/:id/files` | 任务文件 |
| **健康** | `GET /health` | 健康检查 |
| **MCP** | `POST /mcp` | MCP JSON-RPC |

> 遗留端点（如 `/state/team`、`/internal/team/*`）已退役，返回 410 并提示迁移路径。

---

## 仓库结构

```
ai-team/
├── packages/                 # 核心包 (agent-harness, team-runtime, team-core...)
├── apps/
│   ├── api-server/          # API 服务器 (Hono)
│   └── cli/                 # CLI 工具
├── dashboard/                # Dashboard UI (Next.js)
├── electron/                 # Electron 桌面应用
├── src/                      # 实现主体 (team runtime, agent-harness-core, tools...)
├── schemas/                  # JSON Schema 定义
├── scripts/                  # 脚本工具
├── examples/                 # 示例配置
├── config/                   # 配置文件
├── state/                    # 运行时状态 (git ignored)
└── docs/                     # 文档
```

---

## 文档

| 文档 | 说明 |
|------|------|
| [Getting Started](./GETTING-STARTED.md) | 三条入门路径指南 |
| [Architecture](./ARCHITECTURE.md) | 产品架构 |
| [Installation](./INSTALL.md) | 安装指南 |
| [Docker 部署](./DOCKER.md) | Docker 部署说明 |
| [Scripts](./SCRIPTS.md) | 脚本命令参考 |
| [Testing](./TESTING.md) | 测试指南 |
| [MCP Server](./docs/MCP.md) | MCP 配置指南 |

归档文档：`docs/archive/`

---

## 开发

```bash
make doctor         # 检查环境
pnpm install        # 安装依赖
pnpm run dev        # 开发模式
npm test            # 运行测试
make docker-dev     # Docker 开发模式
```

---

## License

MIT
