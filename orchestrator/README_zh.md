# AI Team Harness

面向开源的多 Agent 编排执行基座。

## 这是什么

AI Team Harness 关注的是 **可执行、可观测、可交付** 的多 Agent 协作，而不是只做一个会聊天的单 Agent。

核心链路：

- Planner：拆解任务
- Executor：执行任务
- Critic：评审质量
- Judge：做最终裁决

同时提供：

- Dashboard 看板
- Agent 管理视图
- 节点状态视图
- 交付物 / 证据 / 风险闭环
- 面向 GitHub Release 的 release notes / provenance / version story

---

## 项目定位

相较于 DeerFlow / OpenHanako，这个项目更偏向：

- **通用编排基座**，而不是某个特定研究场景框架
- **产品化工作台**，而不是只给开发者看的运行时
- **低平台绑定**，逐步清理 QQ / Telegram / Feishu 等历史接入痕迹
- **面向开源发布**，强调 release contract、artifact、provenance 和可复现性

---

## 当前能力

### 1. Agent Harness

- 标准化 agent package / manifest
- provider registry
- lifecycle / bridge / shell 插件面
- onboarding / doctor / capabilities / routes 等 product shell 命令

### 2. Dashboard

- 任务总览与看板
- Workbench 交付闭环
- Agent 管理页
- 节点状态聚合
- 低噪音 UI，尽量不暴露内部 runtime 信号

### 3. Release Engineering

- `release-manifest.json`
- `PROVENANCE.json`
- `VERSION-STORY.json`
- `RELEASE-NOTES.md`
- dedicated smoke + mainline 守门

---

## 快速开始

### 安装依赖

```bash
cd orchestrator
npm install
cd dashboard
npm install
```

### 构建 Dashboard

```bash
cd orchestrator/dashboard
npm run build
```

### 运行示例

```bash
cd orchestrator
npm run demo:oss-minimal
```

### 运行主线 smoke

```bash
cd orchestrator
node scripts/smoke/team-mainline.mjs
```

---

## 目录说明

```text
orchestrator/
├─ dashboard/                 # 前端看板
├─ examples/
│  ├─ oss-minimal/            # 最小可运行样例
│  └─ third-party-agent-sample/
├─ scripts/team/              # 编排 / release / smoke 脚本
├─ docs/architecture/         # 架构与开源面文档
├─ fixtures/public-contracts/ # 对外 contract fixtures
└─ src/                       # 核心运行时代码
```

---

## 开源收口原则

当前仓库正在持续做这几件事：

1. 清理历史平台绑定
2. 收敛 UI 的内部噪音
3. 把版本故事变成 machine-readable contract
4. 让 release / smoke / docs / package 串成一条主线

---

## 部署

Dashboard 线上部署脚本：

```bash
cd orchestrator
bash scripts/deploy-dashboard-cloudbase.sh
```

默认会：

- 构建 `dashboard`
- 同步静态产物到本机目录
- 发布到 CloudBase Hosting

---

## 后续方向

- signing / attestations
- structured changelog
- 自动 version bump
- 第三方 agent 接入模板继续产品化

---

如需英文说明，可补 `README.md` 主入口或双语导航。 
