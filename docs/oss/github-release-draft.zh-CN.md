# GitHub Release 中文版草案

## AI Team Runtime：开源仓库收口发布

这次发布的重点，不是单一功能点，而是把仓库从“带有较强内部工程痕迹的系统”收束成一个更清晰、更可信、更适合 GitHub 开源协作的产品形态。

---

## 本次发布亮点

- **AI Team Runtime + Dashboard** 已明确成为项目的主产品叙事。
- **Agent Harness** 已明确为可独立复用的执行基座。
- **独立 Agent 接入** 不再只是文档描述，而是有可运行样例、manifest/package 契约和校验链路支撑。
- **Dashboard 公共契约** 与稳定 read model 的对齐更完整。
- **Release engineering / repo hygiene / repo boundary** 的开源护栏已补齐。

---

## 这次主要做了什么

### 1）统一开源主叙事
仓库现在围绕四个核心表面组织：

1. **AI Team Runtime** —— 主运行时 / 编排产品
2. **Dashboard** —— 观测与工作台界面
3. **Agent Harness** —— 可复用、可 fork 的执行基座
4. **Optional Integrations** —— 可选宿主 / 渠道 / 平台接入层

这让外部开发者第一次进入仓库时，不再需要先理解大量历史路径、宿主特例或迁移残留。

### 2）强化执行基座
本次进一步把 Agent Harness 打磨成更强的执行底座，包括：

- 标准化 execution envelope
- tool / runtime evidence 记录
- standalone baseline 路径打通
- remote broker / worker / scheduler 路径可靠性提升
- OSS minimal 基线可运行性增强

这使它更接近一个真正可以复用、接入、扩展的独立执行基座，而不仅仅是主项目内部的一层实现细节。

### 3）收敛 Dashboard 与公共契约
Dashboard 侧已经进一步从“依赖 payload 局部结构”转向“优先消费稳定 shared read models”。

这意味着：
- 前端对后端结构的依赖更稳定
- dashboard/workbench 更像一个公开可依赖的观测层
- 未来对外开放 API / schema / read model 时更自然

### 4）让独立 Agent 接入故事站得住
这次把独立 Agent onboarding 从“概念上支持”推进到了“公开样例可验证”：

- 第三方 Agent 示例可运行
- manifest / package 契约显式化
- onboarding / doctor / package / shell 等入口更完整
- 配合 validation / smoke，可以证明这条接入路径不是摆设

### 5）补齐开源发布护栏
围绕 GitHub 开源发布，补齐了以下关键边界：

- repo authority map
- release engineering 文档
- repo boundary guard
- repo hygiene audit
- runtime/generated 噪音面收口
- reports 与 docs 的保留策略分离

这让项目不只是“代码能跑”，而是“作为开源仓库也说得清、收得住、对外可信”。

---

## 当前仓库适合怎样理解

如果你是第一次接触这个仓库，建议这样理解：

- **AI Team Runtime** 是主产品
- **Dashboard** 是运行时观测与工作台
- **Agent Harness** 是可独立复用的执行基座
- **Optional Integrations** 是可选接入，不是主叙事

也就是说，这个项目的重点不是“聊天 UI”或者“某个宿主平台适配”，而是：

> 一个面向团队式编排、委派、审阅、证据交付的多 Agent Runtime 产品线。

---

## 验证快照

当前发布准备过程中，以下关键检查已通过：

- `npm run smoke:release-engineering`
- `npm run smoke:oss-minimal`
- `npm run validate:agent-package`
- `npm run audit:repo-boundary`
- `npm run audit:repo-hygiene`

---

## 给外部贡献者的入口

如果你是第一次看这个仓库，建议从这里开始：

1. `README.md`
2. `GETTING-STARTED.md`
3. `ARCHITECTURE.md`
4. `docs/oss/repo-authority.md`
5. `docs/oss/contributor-start-here.md`

---

## 一句话总结

这次发布的核心价值是：

> **把 AI Team 从“内部系统整理中”推进到“更适合公开协作、理解、运行和扩展的 GitHub 开源仓库”。**

如果你关心的是多 Agent Runtime、TL-first 编排、可审阅交付、可观测执行基座、以及第三方 Agent 接入，这个版本已经比之前清晰和可信得多。
