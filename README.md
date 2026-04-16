# AI Team Runtime

[English](./README.md) | [简体中文](./README.zh-CN.md)

开源的**团队式多 Agent 运行时**，支持规划、委派、评审和基于证据的交付。

---

## 功能截图

> Dashboard 界面预览（需要添加截图）

```
+------------------------------------------------------------------+
|  AI Team Dashboard                                                |
+------------------------------------------------------------------+
|  [侧边栏]           |  [主内容区]                                  |
|  - 团队概览          |  +----------------------------------------+  |
|  - 任务列表          |  |  Team Overview                         |  |
|  - 任务看板          |  |                                        |  |
|  - 智能体监控        |  |  Active Tasks: 5                       |  |
|  - 技能商店          |  |  Agents: 4 online                      |  |
|  - 系统设置          |  |                                        |  |
|                     |  |  +--------+ +--------+ +--------+       |  |
|                     |  |  | Task 1 | | Task 2 | | Task 3 | ...  |  |
|                     |  |  +--------+ +--------+ +--------+       |  |
|                     |  +----------------------------------------+  |
+------------------------------------------------------------------+
```

**截图预览** (点击查看大图):
- [Dashboard Main View](./docs/screenshots/dashboard-main.png)
- [Task Board](./docs/screenshots/task-board.png)
- [Agent Monitor](./docs/screenshots/agent-monitor.png)

> **提示**: 运行 `npm run dashboard:build` 构建后访问 http://localhost:3000 查看实际效果

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
| **多渠道** | Telegram / Feishu / QQ / WeChat 完整支持 |
| **Bot 命令** | /help /status /skills /reset /language /model |
| **人格系统** | 可视化人格配置面板 |
| **桌面应用** | Electron 桌面包装器，支持 .exe / .dmg / AppImage |

---

## 快速开始

### 1. 检查环境（推荐）

```bash
make doctor
```

### 2. 配置（首次使用）

```bash
cp .env.example .env
# 编辑 .env 添加你的 API keys
```

### 3. 启动

**Docker 部署（推荐）**

```bash
make docker-start
# 或使用一键部署
make deploy
# 访问 http://localhost:19090
```

**本地开发**

```bash
pnpm install
pnpm run dev
```

---

## 下载安装

### 直接下载 (exe / zip / dmg)

从 GitHub Releases 下载最新版本：

| 平台 | 安装包 | 便携版 (无需安装) |
|------|--------|-------------------|
| **Windows** | [AI Team Setup.exe](https://github.com/ai-team/ai-team/releases) | [AI Team win-portable.zip](https://github.com/ai-team/ai-team/releases) |
| **macOS** | [AI Team.dmg](https://github.com/ai-team/ai-team/releases) | [AI Team mac.zip](https://github.com/ai-team/ai-team/releases) |
| **Linux** | [AI Team.AppImage](https://github.com/ai-team/ai-team/releases) | [AI Team linux.tar.gz](https://github.com/ai-team/ai-team/releases) |

详细说明见 [electron/DOWNLOAD.md](./electron/DOWNLOAD.md)

---

## 部署说明

| 方式 | 命令 | 说明 |
|------|------|------|
| **Docker 一键部署** | `make deploy` | 一键部署（推荐） |
| **Docker** | `make docker-start` | 生产部署 |
| **本地** | `pnpm run dev` | 开发模式 |
| **桌面** | `cd electron && npm run dev` | Electron 桌面开发 |
| **打包桌面应用** | `cd electron && npm run package` | 生成 .exe / .dmg |

---

## 文档

- [Getting Started](./GETTING-STARTED.md)
- [Architecture](./ARCHITECTURE.md)
- [Installation](./INSTALL.md)
- [Docker 部署](./DOCKER.md)
- [Scripts](./SCRIPTS.md)
- [桌面应用下载](./electron/DOWNLOAD.md)

---

## 内置 Skills (11)

| Skill | 说明 | 类型 |
|-------|------|------|
| `web-search` | 网页搜索 | skill |
| `research` | 综合研究工作流 | compound |
| `report-generation` | 生成结构化报告 | skill |
| `code-review` | 代码审查 | skill |
| `image-generation` | 图像生成 | skill |
| `chart-visualization` | 图表可视化 | skill |
| `slide-creation` | PPT/幻灯片创建 | skill |
| `document` | 文档处理 | skill |
| `translation` | 翻译 | skill |
| `data-analysis` | 数据分析 | skill |
| `skill-creator` | 技能创建器 | meta |

---

## 渠道集成

| 渠道 | 状态 | 配置 |
|------|------|------|
| Telegram | ✅ | `TELEGRAM_BOT_TOKEN` |
| Feishu | ✅ | `FEISHU_APP_ID` / `FEISHU_APP_SECRET` |
| QQ | ✅ | QQ Bot API |
| WeChat | ✅ | 企业微信 API |

### Bot 命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/status` | 显示系统状态 |
| `/skills` | 列出可用技能 |
| `/reset` | 重置对话上下文 |
| `/language <lang>` | 切换界面语言 |
| `/model <name>` | 切换 AI 模型 |

---

## 国际化

支持 5 种语言界面：

- 🇺🇸 English (en)
- 🇨🇳 简体中文 (zh)
- 🇯🇵 日本語 (ja)
- 🇰🇷 한국어 (ko)
- 🇹🇼 繁體中文 (zh-TW)

---

## API 架构

统一 REST API，前缀 `/api/v1/`：

| 类别 | 端点 |
|------|------|
| **聊天** | `POST /api/v1/team/chat` - 创建对话 |
| | `POST /api/v1/team/chat/task` - 任务内聊天 |
| **任务** | `POST /api/v1/team/tasks/:taskId/control` - 任务控制 |
| | `GET /api/v1/team/tasks/:taskId/files` - 任务文件 |
| **状态** | `GET /api/v1/state/team` - 团队概览 |
| | `GET /api/v1/state/team/summary` - 任务摘要 |
| | `GET /api/v1/state/team/workbench` - 工作台 |
| | `GET /api/v1/state/team/artifacts` - 产物列表 |
| | `GET /api/v1/state/team/evidence` - 证据列表 |
| | `GET /api/v1/state/team/threads` - 线程列表 |
| **内部** | `POST /api/v1/internal/team/dispatch` - 消息分发 |
| | `POST /api/v1/internal/team/control` - 内部控制 |

详细 API 文档见 [docs/api/](./docs/api/)

---

## 仓库结构

```
ai-team/
├── packages/                 # 核心包
│   ├── agent-harness/       # 可复用执行基座
│   ├── team-runtime/        # Team Runtime
│   ├── team-core/           # Team 核心协议
│   ├── tools/              # 内置工具集
│   ├── skills/              # Skills 系统 (11个内置)
│   ├── shared/              # 共享工具
│   ├── im-channels/          # 渠道适配
│   └── event-bus/            # 事件总线
│
├── apps/
│   ├── api-server/           # API 服务器 (Hono)
│   │   └── src/routes/v1/    # 统一 API v1 路由
│   └── cli/                  # CLI 工具
│
├── dashboard/                 # Dashboard UI (Next.js)
│   └── src/components/        # React 组件
│
├── electron/                  # Electron 桌面
│   ├── main.mjs             # 主进程
│   ├── preload.mjs           # 预加载脚本
│   ├── electron-builder.json # 多平台打包配置
│   └── DOWNLOAD.md           # 下载说明
│
├── src/                      # 兼容层和本地实现
│   ├── observability/        # 可观测性
│   └── ...
│
├── schemas/                   # JSON Schema 定义
├── scripts/                   # 脚本工具
├── examples/                  # 示例配置
└── docs/                      # 文档
```

---

## 开发

```bash
# 检查环境健康状态
make doctor

# 安装依赖
pnpm install

# 开发模式
pnpm run dev

# 测试
npm test

# 构建 Dashboard
npm run dashboard:build

# Electron 开发
cd electron && npm run dev

# Electron 打包
cd electron && npm run package
```

---

## 对比 DeerFlow / OpenHanako

| 特性 | AI Team | DeerFlow | OpenHanako |
|------|---------|----------|------------|
| Skills 数量 | 11 | 10+ | 10+ |
| Skills 格式 | Markdown | Markdown | Markdown + JS |
| 人格系统 | ✅ UI | ❌ | ✅ UI |
| 记忆衰减 | ✅ UI | ❌ | ✅ |
| 多渠道 | ✅ 4个 | ✅ 4个 | ✅ 5个 |
| i18n | ✅ 5种 | ❌ | ✅ 5种 |
| Electron | ✅ | ❌ | ✅ |
| SQLite 持久化 | ✅ | ❌ | ✅ |
| Bot 命令 | ✅ | ❌ | ❌ |
| API 统一 | ✅ Hono | ❌ | ❌ |
| exe 便携版 | ✅ | ❌ | ✅ |

---

## 更新日志

### v2.0 (2026-04-16)

**架构重构**

- 引入 Hono 框架，统一 API 路由 `/api/v1/`
- 前后端配置统一管理
- Electron 集成 Hono Server，支持 exe 便携版

**API 统一**

- 所有端点统一使用 `/api/v1/` 前缀
- 统一使用 camelCase 命名
- 标准化响应格式 (Envelope)

**性能优化**

- 全站压测通过 (100% 成功率，P95 < 11ms)
- 支持高并发请求处理

详细变更见 [.monkeycode/docs/refactor-v1.md](./.monkeycode/docs/refactor-v1.md)

---

## License

MIT
