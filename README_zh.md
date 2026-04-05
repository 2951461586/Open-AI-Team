# AI Team Harness

[English](./README.md) | 中文说明

面向开源的多 Agent 编排执行基座 —— 可执行、可观测、可交付。

## 快速上手

```bash
npm install
cp .env.example .env
npm run smoke:team       # 验证全部通过
node examples/oss-minimal/product-shell.mjs  # 跑一个 demo
```

## 它做什么

不是一个聊天机器人。是一个让 Agent **规划、执行、评审、决策** 的多 Agent 运行时，配上 Dashboard 让你能看到一切。

- **Planner** → 拆解任务
- **Executor** → 执行任务
- **Critic** → 评审质量
- **Judge** → 最终决策

加上任务看板、Agent 管理、交付物/证据/验收闭环。

## 关键目录

| 路径 | 说明 |
|---|---|
| `src/team/` | 运行时与编排核心 |
| `dashboard/` | Web UI |
| `examples/oss-minimal/` | 最小可运行 demo |
| `schemas/` | 公开 API 契约 |
| `scripts/team/` | Smoke 测试与验证 |

## 下一步

- **[入门指南](./GETTING-STARTED.md)** — 完整的贡献者指南
- **[架构说明](./ARCHITECTURE.md)** — 仓库分层与边界
- **[Dashboard](./dashboard/README.md)** — 前端开发与运行

## CI 状态

[![CI](https://github.com/user/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/user/repo/actions/workflows/ci.yml)

需要 Node 22+。详细配置见 [GETTING-STARTED.md](./GETTING-STARTED.md)。
