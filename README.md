# AI Team Runtime

开源的**团队式多 Agent 运行时**，支持规划、委派、评审和基于证据的交付。

[English Documentation](./README.zh-CN.md) (中文版) | [简体中文](./README.md)

---

## 核心能力

| 能力 | 说明 |
|------|------|
| **TL-first 执行模型** | 所有请求先进入 Team Leader，由 TL 决定直接回答或委派给其他角色 |
| **团队协作** | 支持 Planner / Executor / Critic / Judge 风格的委派与评审闭环 |
| **证据驱动交付** | 输出包括 artifacts、evidence、deliverables、acceptance traces |
| **可观测性** | 内置 LangSmith + Langfuse 追踪，完整 trace span 管理 |
| **Skills 系统** | 11 个内置 Skills，支持 Markdown SKILL.md 格式，渐进加载 |
| **Sub-Agent 隔离** | 独立上下文，支持动态 spawn |
| **记忆管理** | 三层记忆 + 自然衰减 + 语义检索，可视化监控面板 |
| **MCP 集成** | 支持 MCP Server 适配器 |

---

## 快速开始

### 1. 配置环境

```bash
cp .env.example .env
# 编辑 .env 添加你的 API keys
```

### 2. 启动服务

**Docker 部署（推荐）**

```bash
make docker-start
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
| **Docker 一键部署** | `make deploy` | 一键部署（推荐） |
| **Docker** | `make docker-start` | 生产部署 |
| **本地开发** | `pnpm run dev` | 开发模式 |
| **桌面应用** | `cd electron && npm run dev` | Electron 开发 |

详细说明见 [INSTALL.md](./INSTALL.md)、[DOCKER.md](./DOCKER.md)

---

## 仓库结构

```
ai-team/
├── packages/                 # 核心包
│   ├── agent-harness/       # 可复用执行基座
│   ├── team-runtime/        # Team Runtime
│   ├── team-core/           # Team 核心协议
│   ├── tools/               # 内置工具集
│   ├── skills/              # Skills 系统
│   ├── shared/              # 共享工具
│   ├── im-channels/         # 渠道适配
│   └── event-bus/           # 事件总线
│
├── apps/
│   ├── api-server/          # API 服务器 (Hono)
│   └── cli/                 # CLI 工具
│
├── dashboard/                # Dashboard UI (Next.js)
├── electron/                 # Electron 桌面应用
├── src/                      # 实现主体（team runtime / agent-harness-core）
├── schemas/                  # JSON Schema 定义
├── scripts/                  # 脚本工具
├── examples/                 # 示例配置
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
| [安全政策](./SECURITY.md) | 安全报告流程 |

项目文档归档: `docs/archive/`

---

## 开发

```bash
make doctor         # 检查环境健康
pnpm install        # 安装依赖
pnpm run dev        # 开发模式
npm test            # 运行测试
npm run dashboard:build   # 构建 Dashboard
```

---

## License

MIT
