# AI Team Harness

[English](./README.md) | 中文说明

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
- 交付物 / 证据 / 评审 / 裁决闭环
- 面向 GitHub Release 的 release notes / provenance / version story
- 面向开源的最小 harness 示例

---

## 主入口导航

### 推荐先读
- [英文主入口 / README.md](./README.md)
- [Dashboard 源码 authority 与部署规则](./docs/deploy/dashboard-source-authority.md)
- [旧 dashboard-static-export 退役说明](./docs/migration/dashboard-static-export-deprecation.md)
- [DeerFlow / OpenHanako 对比与开源改造清单](./docs/oss/deerflow-openhanako-comparison.md)

### 仓库关键入口
- `dashboard/`：完整 dashboard 源码树
- `examples/oss-minimal/`：最小可运行 standalone harness 示例
- `.release-artifacts/`：生成产物目录，只用于发布附件 / 验收 / 溯源，不是源码 authority

---

## 项目定位

相较于 DeerFlow / OpenHanako，这个项目更偏向：

- **通用编排基座**，而不是某个特定研究场景框架
- **产品化工作台**，而不是只给开发者看的运行时
- **低平台绑定**，逐步清理历史平台接入痕迹
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

## 唯一部署 authority

**正式规则：只能从完整 `dashboard/` 源码树 fresh build 后再部署。**

authority 范围：
- `dashboard/src/`
- `dashboard/public/`
- `dashboard/package.json`
- `dashboard/package-lock.json`
- dashboard build config

非 authority：
- 历史 `dashboard-static-export` bundle / 路径
- 历史 `out/` 目录
- 本机静态镜像目录
- 不可追溯来源的旧 bundle

如果静态产物和源码树不一致，以源码树为准，重新 build。

---

## 推荐部署流程

```bash
cd orchestrator/dashboard
npm ci
npm run build
# 然后再把 fresh ./out 发布到你的托管目标
```

如需强约束脚本，可用：

```bash
cd orchestrator
bash scripts/deploy-dashboard-from-source.sh
```

---

## 目录说明

```text
orchestrator/
├─ dashboard/                 # 前端看板完整源码
├─ examples/
│  └─ oss-minimal/            # 最小可运行样例
├─ scripts/                   # 部署 / 验收脚本
├─ docs/deploy/               # 部署 authority 文档
├─ docs/migration/            # 退役 / 迁移文档
├─ docs/oss/                  # 开源对比与改造清单
└─ .release-artifacts/        # 生成产物（非 authority）
```

---

## 开源收口原则

当前仓库正在持续做这几件事：

1. 清理历史 fallback 面
2. 收敛 UI 的内部噪音
3. 把版本故事变成 machine-readable contract
4. 让 release / smoke / docs / package 串成一条主线
5. 降低 OpenClaw/宿主环境对公共开源面的直接绑定

---

## 后续方向

- signing / attestations
- structured changelog
- 自动 version bump
- runtime adapter / plugin boundary 继续去平台绑定
- 第三方 agent 接入模板继续产品化

---

一句话：**生成产物可以保留，但只有完整 dashboard 源码树才有部署话语权。**
