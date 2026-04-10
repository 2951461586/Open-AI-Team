# AI Team Runtime

[English](./README.md) | [简体中文](./README.zh-CN.md)

开源的**团队式多 Agent 运行时**，支持规划、委派、评审和基于证据的交付。

---

## 核心能力

| 能力 | 说明 |
|------|------|
| **TL-first 执行模型** | 所有请求先进入 Team Leader，由 TL 决定直接回答或委派给其他角色 |
| **团队协作** | 支持 Planner / Executor / Critic / Judge 风格的委派与评审闭环 |
| **证据驱动交付** | 输出包括 artifacts、evidence、deliverables、acceptance traces |
| **可观测性** | 内置 LangSmith + Langfuse 追踪 |
| **Skills 系统** | Markdown SKILL.md 格式，支持渐进加载 |
| **Sub-Agent 隔离** | 独立上下文，支持动态 spawn |
| **记忆管理** | 三层记忆 + 衰减 + 语义检索 |
| **MCP 集成** | 支持 MCP Server 适配器 |
| **多渠道** | Telegram / Feishu / Slack / WeCom |
| **桌面应用** | Electron 桌面包装器 |

---

## 快速开始

### Docker 部署（推荐）

```bash
docker-compose up -d
# 访问 http://localhost:3001
```

### 本地开发

```bash
npm install
cp .env.example .env
npm run dev
```

### 独立 Agent 示例

```bash
npm run demo:oss-minimal
```

---

## 仓库结构

```
ai-team/
├── packages/                 # 核心包
│   ├── agent-harness/       # 可复用执行基座
│   ├── team-runtime/        # Team Runtime
│   ├── team-core/           # Team 核心协议
│   ├── tools/               # 内置工具集
│   │   ├── tool-browser.mjs
│   │   ├── tool-code-executor.mjs
│   │   ├── tool-database.mjs
│   │   ├── tool-url-fetcher.mjs
│   │   └── tool-image-understanding.mjs
│   ├── skills/              # Skills 系统
│   │   ├── skill-registry.mjs
│   │   ├── skill-runtime.mjs
│   │   └── skills/          # 内置 Skills
│   │       ├── web-search/
│   │       ├── research/
│   │       ├── report-generation/
│   │       └── code-review/
│   ├── shared/              # 共享工具
│   │   ├── config-loader.mjs    # 统一配置加载
│   │   ├── cron-scheduler.mjs    # 定时任务
│   │   ├── heartbeat.mjs         # 心跳检测
│   │   ├── memory-decay.mjs     # 记忆衰减
│   │   └── semantic-search.mjs   # 语义搜索
│   ├── im-channels/          # 渠道适配
│   └── event-bus/            # 事件总线
│
├── apps/
│   └── api-server/           # API 服务器
│
├── dashboard/                 # Dashboard UI (Next.js)
├── electron/                  # Electron 桌面包装器
├── examples/
│   ├── oss-minimal/         # 最小可运行示例
│   └── third-party-agent-sample/
├── schemas/                   # JSON Schema 定义
├── scripts/                   # 脚本
├── src/                       # 兼容层和本地实现
└── docs/                      # 文档
```

---

## 部署方式

| 方式 | 命令 | 说明 |
|------|------|------|
| **Docker** | `docker-compose up -d` | 生产部署 |
| **本地** | `npm run dev` | 开发模式 |
| **桌面** | `cd electron && npm run dev` | Electron 桌面 |

---

## 内置工具

| 工具 | 说明 |
|------|------|
| `browser` | 浏览器自动化 |
| `code-executor` | 代码执行 (JS/Bash) |
| `database` | SQLite 查询 |
| `url-fetcher` | URL 内容获取 |
| `image-understanding` | 图像理解 |
| `calendar` | 日历 |
| `email` | 邮件 |
| `git` | Git 操作 |
| `reminder` | 提醒 |
| `weather` | 天气查询 |

---

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 测试
npm test

# 构建 Dashboard
npm run dashboard:build

# 代码检查
npm run lint
```

---

## 文档

- [Getting Started](./GETTING-STARTED.md)
- [Architecture](./ARCHITECTURE.md)
- [Docker 部署](./DOCKER.md)
- [Scripts](./SCRIPTS.md)

---

## License

MIT
