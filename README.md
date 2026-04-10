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
| **可观测性** | 内置 LangSmith + Langfuse 追踪，完整 trace span 管理 |
| **Skills 系统** | 11 个内置 Skills，支持 Markdown SKILL.md 格式，渐进加载 |
| **Sub-Agent 隔离** | 独立上下文，支持动态 spawn |
| **记忆管理** | 三层记忆 + 自然衰减 + 语义检索，可视化监控面板 |
| **MCP 集成** | 支持 MCP Server 适配器 |
| **多渠道** | Telegram / Feishu / QQ / WeChat 完整支持 |
| **Bot 命令** | /help /status /skills /reset /language /model |
| **人格系统** | 可视化人格配置面板 |
| **桌面应用** | Electron 桌面包装器，支持 .dmg / .exe / AppImage |

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

### 安装向导

```bash
make setup-wizard
```

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

## 仓库结构

```
ai-team/
├── packages/                 # 核心包
│   ├── agent-harness/       # 可复用执行基座
│   │   ├── standalone-agent-package.mjs
│   │   ├── enhanced-model-router.mjs
│   │   ├── convention-plugin-system.mjs
│   │   └── fault-tolerance.mjs
│   ├── team-runtime/        # Team Runtime
│   │   ├── sub-agent-context.mjs    # Sub-Agent 隔离
│   │   ├── context-compression.mjs  # 上下文压缩
│   │   ├── channel-adapters/        # 渠道适配
│   │   │   ├── channel-manager.mjs   # 渠道管理
│   │   │   ├── bot-commands.mjs      # Bot 命令
│   │   │   ├── channel-telegram.mjs
│   │   │   ├── channel-feishu.mjs
│   │   │   ├── channel-qq.mjs
│   │   │   └── channel-wechat.mjs
│   │   ├── desk-storage.mjs
│   │   └── migrations/               # SQLite 迁移
│   ├── team-core/           # Team 核心协议
│   ├── tools/              # 内置工具集
│   │   ├── tool-browser.mjs
│   │   ├── tool-code-executor.mjs
│   │   ├── tool-database.mjs
│   │   ├── tool-url-fetcher.mjs
│   │   └── tool-image-understanding.mjs
│   ├── skills/              # Skills 系统
│   │   ├── skill-registry.mjs
│   │   ├── skill-runtime.mjs
│   │   ├── skill-installer.mjs      # 技能安装器
│   │   ├── SKILL.md.template        # SKILL.md 模板
│   │   ├── marketplace.json          # 技能市场数据
│   │   └── skills/                  # 内置 Skills (11个)
│   │       ├── web-search/
│   │       ├── research/
│   │       ├── report-generation/
│   │       ├── code-review/
│   │       ├── image-generation/
│   │       ├── chart-visualization/
│   │       ├── slide-creation/
│   │       ├── document/
│   │       ├── translation/
│   │       ├── data-analysis/
│   │       └── skill-creator/
│   ├── shared/              # 共享工具
│   │   ├── config-loader.mjs
│   │   ├── cron-scheduler.mjs
│   │   ├── heartbeat.mjs
│   │   ├── memory-decay.mjs
│   │   └── semantic-search.mjs
│   ├── im-channels/          # 渠道适配
│   └── event-bus/            # 事件总线
│
├── apps/
│   ├── api-server/           # API 服务器
│   │   └── src/routes/skills/  # Skills API 路由
│   └── cli/
│
├── dashboard/                 # Dashboard UI (Next.js)
│   └── src/components/
│       ├── panels/
│       │   ├── PersonalityPanel.tsx   # 人格配置面板
│       │   ├── MemoryDecayPanel.tsx   # 记忆衰减面板
│       │   └── SkillMarketplace.tsx   # 技能商店
│       └── views/
│           └── SettingsView.tsx       # 设置视图
│
├── electron/                  # Electron 桌面
│   ├── main.mjs             # 主进程 (完整菜单栏)
│   ├── electron-builder.json  # 多平台打包配置
│   └── preload.mjs
│
├── src/                      # 兼容层和本地实现
│   ├── observability/        # 可观测性
│   │   ├── langsmith-exporter.mjs
│   │   ├── langfuse-exporter.mjs
│   │   ├── trace-span.mjs
│   │   └── trace-exporter.mjs
│   └── ...
│
├── examples/
│   ├── oss-minimal/          # 最小可运行示例
│   └── third-party-agent-sample/
│
├── schemas/                   # JSON Schema 定义
├── scripts/
│   ├── setup/
│   │   └── setup-wizard.mjs  # 交互式安装向导
│   └── ...
│
├── .github/workflows/
│   ├── ci.yml               # CI
│   └── electron-release.yml  # Electron 发布
│
└── docs/
```

---

## 部署方式

| 方式 | 命令 | 说明 |
|------|------|------|
| **Docker** | `docker-compose up -d` | 生产部署 |
| **本地** | `npm run dev` | 开发模式 |
| **桌面** | `cd electron && npm run dev` | Electron 桌面开发 |
| **打包桌面应用** | `cd electron && npm run package` | 生成 .dmg / .exe |

---

## 内置工具

| 工具 | 说明 |
|------|------|
| `browser` | 浏览器自动化 |
| `code-executor` | 代码执行 (JS/Bash) |
| `database` | SQLite 查询 |
| `url-fetcher` | URL 内容获取 |
| `image-understanding` | 图像理解 |
| `mcp` | MCP Server 适配 |

---

## 开发

```bash
# 安装依赖
npm install

# 检查环境
make check

# 运行安装向导
make setup-wizard

# 开发模式
npm run dev

# 测试
npm test

# 构建 Dashboard
npm run dashboard:build

# 代码检查
npm run lint

# Electron 开发
cd electron && npm run dev

# Electron 打包
cd electron && npm run package
```

---

## 文档

- [Getting Started](./GETTING-STARTED.md)
- [Architecture](./ARCHITECTURE.md)
- [Installation](./INSTALL.md)
- [Docker 部署](./DOCKER.md)
- [Scripts](./SCRIPTS.md)

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

---

## License

MIT
