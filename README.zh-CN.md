# AI Team Runtime

[English](./README.md) | [简体中文](./README.zh-CN.md)

一个面向**团队式协作**的开源多 Agent Runtime，用于规划、委派、审阅以及基于证据的交付。

它适合那些需要的不只是聊天，而是真正需要“执行结构”的系统：
- 以 **TL-first（Team Leader 先行）执行模型** 替代临时拼装式 agent 调用
- 支持 **planner / executor / critic / judge** 等角色之间的委派与评审闭环
- 将 **artifacts、evidence、acceptance traces** 作为一等输出
- 通过 **dashboard / workbench** 观察任务、时间线与运行状态
- 提供可复用的 **agent harness**，用于接入独立或第三方 agent

---

## 这个仓库是什么

这个仓库现在可以理解为一个由四个主要表面组成的开源产品族：

1. **AI Team Runtime** —— 主运行时 / 编排产品
2. **Dashboard** —— 运行观测与工作台界面
3. **Agent Harness** —— 可 fork、可复用的执行基座
4. **Optional Integrations** —— OpenClaw / 渠道 / 宿主相关的可选接入层

如果你是第一次来到这里，最重要的一句话是：

> **AI Team Runtime + Dashboard** 是主产品。
> **`packages/agent-harness`** 是可复用的执行基座。
> Optional integrations 是刻意降为次要的。

---

## 核心能力

### TL-first 执行模型
所有主要请求都会先进入 TL（Team Leader）运行时。TL 决定是：
- 直接回答
- 确认创建任务
- 部分委派
- 完全委派
- 继续已有任务 / follow-up 路径

### 团队式委派
运行时支持 planner / executor / critic / judge 风格的协作，具有显式任务拆解与受控 follow-up。

### 基于证据的交付
输出不只是文本。整个运行时围绕以下对象构建：
- artifacts
- evidence
- deliverables
- review / judge signals
- acceptance closure

### Dashboard 与工作台可观测性
Dashboard 不只是聊天窗口，而是用来观察：
- 任务时间线
- 运行状态
- task / workbench 进度
- artifacts 与 evidence
- 操作者 follow-up

### 独立 Agent 接入
第三方 agent 不需要理解 OpenClaw 的内部细节，也可以通过显式契约接入：
- manifest
- package
- provider registry
- shell / doctor / activation checklist
- session / desk / bridge / lifecycle contracts

---

## 快速开始

选择一条路径。

### A. 直接看主产品

```bash
npm install
cp .env.example .env
npm run smoke:team
npm start
```

然后按 `GETTING-STARTED.md` 中描述的方式打开 dashboard / API 入口。

### B. 看可 fork 的 Agent Harness

```bash
npm install
npm run demo:oss-minimal
npm run doctor:oss-minimal
```

然后阅读：
- `packages/agent-harness/README.md`
- `examples/oss-minimal/README.md`

### C. 看第三方 Agent 接入路径

```bash
npm install
npm run validate:third-party-agent
npm run smoke:third-party-agent
node examples/third-party-agent-sample/agent-shell.mjs onboarding
```

然后阅读：
- `examples/third-party-agent-sample/README.md`
- `docs/architecture/independent-agent-onboarding.md`

---

## 产品表面

### 1）AI Team Runtime
规划、委派、审阅、交付闭环的主运行时 / 编排产品。

关键目录：
- `packages/team-runtime/`
- `src/team/`
- `src/team-runtime-adapters/`
- `src/routes/`
- `apps/api-server/`

### 2）Dashboard
用于运行观测、任务 / 工作台流转和操作员交互的主 UI。

关键目录：
- `dashboard/` —— 当前 UI 主 authority
- `electron/` —— 桌面包装器（生产环境加载 `dashboard/out/`）

### 3）Agent Harness
可复用、可 fork 的独立执行基座。

关键目录：
- `packages/agent-harness/`
- `examples/oss-minimal/`
- `examples/third-party-agent-sample/`
- `schemas/`

### 4）Optional Integrations
非主叙事表面，例如：
- `src/integrations/openclaw/`
- channel adapters
- 宿主 / runtime 特定接线
- `plugins/` 下的可选插件生态
- `services/` 下的可选 / 伴随服务

这些都可以有价值，但它们**不是**默认产品故事。
`projects/` 下的旁支 / 实验项目、`electron/` 下的桌面壳，以及 `shared/` 下的低 authority 输出面，也都不属于默认第一阅读路径。

---

## 推荐阅读顺序

如果你想用最短路径正确理解这个仓库，建议按下面顺序阅读：

1. `README.md`
2. `GETTING-STARTED.md`
3. `ARCHITECTURE.md`
4. `dashboard/README.md`
5. `docs/architecture/product-surface-and-repo-map.md`
6. `docs/oss/repo-authority.md`
7. `docs/oss/what-is-ai-team-runtime.md`
8. `docs/architecture/current-team-runtime-architecture.md`
9. `docs/architecture/independent-agent-onboarding.md`
10. `docs/architecture/release-engineering-and-ci.md`
11. `docs/oss/dashboard-observability-surface.md`
12. `docs/oss/dashboard-observability-checklist.md`
13. `docs/oss/open-source-release-engineering.md`

---

## 仓库地图

```text
packages/
  agent-harness/     可复用执行基座
  team-runtime/      打包后的 team runtime 表面
  team-core/         平台中立的 team contracts / domain
  tools/             公共 tool/provider 表面
  skills/            包含 registry 和 runtime 的 skills 系统
  shared/             共享工具（config、scheduler、heartbeat、memory）
apps/
  api-server/        当前 app/server authority surface
src/
  team/              混合 runtime 表面：部分是 package shim，部分仍是本地 runtime 区域
  team-runtime-adapters/
  integrations/
dashboard/           当前主 dashboard 产品 UI
electron/            桌面包装器（生产环境加载 dashboard/out/）
examples/
  oss-minimal/       最小可运行 harness baseline
  third-party-agent-sample/
schemas/             公共 contracts
plugins/             可选插件生态，不是主线 core
services/            可选 / 伴随服务，不是主线 core
projects/            相关或实验性旁支项目
memory/              本地 continuity 表面（仓库中仅保留 README）
```

---

## 为什么这个仓库不太一样

和 chat-first agent 仓库相比，这个项目更强调**执行结构**：
- TL-first 路由
- delegation 与 review
- evidence 与 acceptance
- dashboard / workbench observability
- 面向独立 agent 的 host-neutral onboarding contracts

和宿主绑定、偏私有的 runtime 相比，这个仓库正在收敛成更清晰的开源形态：
- runtime 是产品化的
- harness 是可 fork 的
- integrations 是可选的
- release boundaries 是显式的

---

## 开源仓库默认规则

默认可按以下 authority 假设理解：
- `dashboard/` 是当前 dashboard UI authority
- `packages/agent-harness/` 是执行基座 authority
- `packages/team-runtime/` 是 packaged team-runtime authority
- `apps/api-server/` 是 server entry authority
- `src/` 同时包含兼容 shim 和仍未迁移到 package/app 边界后的本地 runtime 区域
- `plugins/`、`services/`、`electron/`、`projects/`、`shared/` 都是次级 / 可选 / 非主线表面，除非另有明确文档说明

如果你要贡献代码，在对应 authority 已经存在时，应优先把新逻辑写入 owning package/app。

---

## 安全与部署说明

这个仓库包含可选 integration 和部分宿主相关表面，但主线开源叙事仍是：
- host-neutral runtime contracts 优先
- public-safe schemas 与 examples 优先
- optional integrations 其次

关于发布、公开边界和 public-safe 约束，请看：
- `docs/architecture/release-surface-allowlist.md`
- `docs/oss/open-source-release-engineering.md`

---

## License

MIT
