# AI Team Harness / AI 团队编排引擎

> An open-source multi-agent orchestration harness for research, coding, and delivery.
> 开源多智能体编排引擎，面向研究、编程与交付。

[English](#english) · [中文说明](#中文说明)

---

## English

### What It Is

Not a chat-only assistant. A **multi-agent runtime** where agents plan, execute, review, and decide — with a web dashboard to watch it all in real time.

### Key Features

- **Team Agent Orchestration** — TL (Team Leader) authority with planning, delegation, and review loops
- **Multi-Agent Roles** — Planner / Executor / Critic / Judge, each with personality & capabilities
- **Sandboxed Execution** — Docker containers with read-only rootfs, seccomp, resource limits (CPU/memory/PIDs)
- **Multi-Model Routing** — Automatic routing across chat/utility/reasoning models with fallback
- **MCP Server** — Full JSON-RPC 2.0 implementation with remote tool discovery & integration
- **Observability** — Structured trace spans (OTel/Langfuse compatible), task lifecycle audit, event bus
- **Governance** — Risk assessment, approval queues, policy engine, behavior audit logging
- **i18n Dashboard** — Bilingual (ZH/EN) web UI with real-time task tracking
- **Personal Agent** — Standalone single-agent mode with personality, memory, and cron jobs
- **IM Channel Router** — Telegram / Feishu / QQ / WeChat webhook integration
- **One-Click Deploy** — Docker Compose with health checks and environment configuration

### Quick Start

```bash
npm install
cp .env.example .env   # or edit .env directly
npm start               # API server on port 19090
```

**Dashboard**: open `http://localhost:19090/`

**One-click Deploy**:
```bash
bash scripts/deploy.sh          # deploy
bash scripts/deploy.sh status   # check status
bash scripts/deploy.sh logs     # follow logs
bash scripts/deploy.sh restart  # restart
bash scripts/deploy.sh stop     # stop
```

### Project Structure

```
├── src/
│   ├── team/                    # Core orchestration (TL runtime, agents, tools)
│   │   ├── tl-runtime/          # Team Leader planning & delegation
│   │   ├── channel-adapters/    # IM channel adapters (Telegram, Feishu, QQ, WeChat)
│   │   └── migrations/          # SQLite schema migrations
│   ├── agent-harness-core/      # Standalone agent baseline (sandbox, tools, models)
│   ├── mcp/                     # MCP Server & Client
│   ├── observability/           # Tracing & event export
│   ├── personal-agent/          # Personal Agent mode
│   └── routes/                  # HTTP route handlers
├── dashboard/                   # Next.js web dashboard (ZH/EN)
├── electron/                    # Desktop client (Tauri/Electron)
├── packages/                    # Monorepo packages (agent-harness, team-core, etc.)
├── config/                      # Configuration (roles, tools, models, MCP)
├── schemas/                     # JSON Schema contracts
├── tests/                       # Unit & integration tests
├── scripts/                     # Deploy, test runner, utilities
├── docker-compose.yml           # Production deployment
└── Dockerfile                   # Multi-stage production build
```

### Requirements

- **Node.js 22+**
- **Docker** (optional, for sandboxed code execution & containerized deployment)

### License

MIT

---

## 中文说明

### 项目简介

这不是一个只会聊天的助手。这是一个**多智能体运行时**，Agent 可以计划、执行、评审和决策，配套的 Web 看板实时监控全流程。

### 核心能力

- **团队智能体编排** — TL（Team Leader）权威模式，支持规划、委派、评审闭环
- **多角色 Agent** — Planner / Executor / Critic / Judge，各自拥有人格与能力配置
- **沙箱执行** — Docker 容器隔离，只读根文件系统 + seccomp + 资源限制（CPU/内存/PID）
- **多模型路由** — chat / utility / reasoning 三模型自动路由，失败自动降级
- **MCP 服务** — 完整 JSON-RPC 2.0 实现，支持远程工具发现与集成
- **可观测性** — 结构化 Trace Span（兼容 OTel/Langfuse）、任务生命周期审计、事件总线
- **治理引擎** — 风险评估、审批队列、策略引擎、行为审计日志
- **国际化看板** — 中英文双语 Web 界面，实时任务追踪
- **个人 Agent** — 单兵模式，支持人格配置、持久化记忆、定时任务
- **IM 通道路由** — Telegram / 飞书 / QQ / 微信 Webhook 接入
- **一键部署** — Docker Compose 健康检查 + 环境变量配置

### 快速开始

```bash
npm install
cp .env.example .env   # 或直接编辑 .env
npm start               # 启动 API 服务，默认 19090 端口
```

**看板地址**：打开浏览器访问 `http://localhost:19090/`

**一键部署**：
```bash
bash scripts/deploy.sh          # 部署
bash scripts/deploy.sh status   # 查看状态
bash scripts/deploy.sh logs     # 实时日志
bash scripts/deploy.sh restart  # 重启
bash scripts/deploy.sh stop     # 停止
```

### 目录结构

```
├── src/
│   ├── team/                    # 核心编排（TL 运行时、Agent、工具）
│   │   ├── tl-runtime/          # TL 规划与委派
│   │   ├── channel-adapters/    # IM 通道适配器（Telegram、飞书、QQ、微信）
│   │   └── migrations/          # SQLite 数据库迁移
│   ├── agent-harness-core/      # 独立 Agent 基线（沙箱、工具、模型）
│   ├── mcp/                     # MCP 服务端与客户端
│   ├── observability/           # 追踪与事件导出
│   ├── personal-agent/          # 个人 Agent 模式
│   └── routes/                  # HTTP 路由处理
├── dashboard/                   # Next.js Web 看板（中英文）
├── electron/                    # 桌面客户端（Electron）
├── packages/                    # Monorepo 包（agent-harness、team-core 等）
├── config/                      # 配置文件（角色、工具、模型、MCP）
├── schemas/                     # JSON Schema 契约
├── tests/                       # 单元测试与集成测试
├── scripts/                     # 部署脚本、测试运行器、工具脚本
├── docker-compose.yml           # 生产部署
└── Dockerfile                   # 多阶段生产构建
```

### 环境要求

- **Node.js 22+**
- **Docker**（可选，用于沙箱代码执行和容器化部署）

### 许可证

MIT
