# 当前产品边界与兼容层（2026-03-18）

> 目的：给当前 AI Team 项目一个**不混淆历史与现状**的权威读法。
>
> 这份文档不是完整架构图，而是回答三个问题：
>
> 1. **什么是当前正式产品面？**
> 2. **什么属于历史兼容层？**
> 3. **下一步要从哪里继续去平台化？**

---

## 1．正式产品面

当前应被视为正式主线的部分：

### 1.1 Team Runtime

- 任务创建、推进、评审、裁决、执行、输出
- mailbox / blackboard / artifacts / evidence
- reroute / claim / single-flight / output gate

核心目录：

- `src/team/`
- `src/routes/index-routes-team.mjs`

### 1.2 Dashboard

- 任务看板
- 节点观察
- 实时聊天
- 交付物查看

核心目录：

- `dashboard/src/`
- `GET /state/team/dashboard`
- `GET /ws/chat`
- `POST /api/chat/create`

### 1.3 Query API

- `/state/team*` 系列稳定查询面
- 面向 Dashboard、运维、调试与治理观察

关键接口：

- `/state/team`
- `/state/team/dashboard`
- `/state/team/nodes`
- `/state/team/contracts`
- `/state/team/artifacts`
- `/state/team/evidence`

### 1.4 Output Authority

用户可见输出当前正式收口点：

- Dashboard websocket canonical output（`visible_output` / `agent_reply` broadcast）

`POST /internal/team/output` 当前只保留为历史兼容 / 调查语义入口，不再是 Team visible output 的 mainline。

---

## 2．历史兼容层

以下部分仍可运行、可参考、可兼容，但不再代表项目主定义。

### 2.1 QQ / NapCat ingress 语义

包括但不限于：

- `/webhook/qq`
- `qq_group_id / group_id`
- `scopeKey = qq:*`
- 默认 `channel = qqbot`
- `parseQqGroupIdFromScope()`

这些语义说明系统仍带有历史平台耦合，但它们现在属于：

- 兼容层
- 迁移残留
- 旧生产背景

### 2.2 NapCat / bridge 直投递 fallback

包括：

- `napcat_http`
- 旧 Bridge 时代输出链
- 与 QQ 群消息直接投递相关的兜底路径

当前应明确理解为：

- `dashboard_ws` = **canonical lane**
- `bridge_rpc` / `napcat_http` = **legacy compat path（historical / not-for-mainline）**

当前价值已收缩为：

- 历史背景说明
- 局部回滚参考
- 退役过程中的残留审计

而不是未来主产品边界，也不应再作为 Team mainline 的新增依赖。

### 2.3 Debate / compat archive

当前 debate runtime 主实现已退出主工作树，相关资产主要保留在：

- `_trash/20260327-p11-debate-runtime-full-retire/`
- `scripts/debate/`
- `scripts/governance/`
- `docs/ops/` 中的退役／边界盘点文档

这些内容仍可用于：

- 历史兼容背景核对
- retired contract 审计
- legacy surface 排障参考

但它们不再是当前产品叙事中心。

### 2.4 `_ops/orchestrator/` 工程文档仓

这里面有很多真实事实，但它的定位是：

- 设计稿
- first-cut
- closure
- 历史过程文档

不是当前产品入口文档。

---

## 3．当前仓库的真实状态

项目当前不是下面这两种极端：

### 不是 A：仍然只是 QQ 多 Bot 项目

原因：

- Dashboard 已进入正式产品面
- Team Runtime 已成为主战场
- dashboard websocket canonical lane 已成为正式 visible output 口径；`/internal/team/output` 仅保留历史兼容 / 调查语义
- `/state/team*` 查询面已经稳定化

### 也不是 B：已经完全平台中立

原因：

- runtime 仍默认 `qqbot`
- scope 仍大量使用 `qq:*`
- sender / ingress / scripts 仍保留明显 QQ 语义
- 仓库命名、README、夹具仍有较强历史包袱

### 当前准确描述

**这是一个已经把主产品面切到 AI Team Runtime / Dashboard，但运行时 contract 仍在逐步摆脱 QQ / NapCat 历史耦合的系统。**

---

## 4．当前正式入口清单

### 用户可见／前端相关

- `GET /state/team/dashboard`
- `GET /state/team/nodes`
- `GET /state/team/contracts`
- `GET /state/team/artifacts`
- `GET /ws/chat`
- `POST /api/chat/create`

### 后端 authority 相关

- Dashboard websocket canonical output（`visible_output` / `agent_reply` broadcast）
- `POST /internal/team/output`（legacy compat / investigate only）
- `/state/team*` 系列 read model

---

## 5．当前需要谨慎对待的入口

以下入口在仓库中仍可见，但不要默认当作“继续扩建的主入口”：

- `/webhook/qq`
- `napcat_http`（**retired compat path**）
- 直接以 `qq_group_id` 为中心的 runtime 设计
- 直接把 scope 固定理解成 `qq:<groupId>`

如果继续围绕这些入口做系统定义，容易把项目再次拉回历史架构。

---

## 6．待去平台化清单

### P2：运行时 contract 去 QQ 化

建议优先处理：

- `scopeKey`：从 `qq:*` 历史假设抽出来
- `deliveryTarget`：从 group-only 语义抽出来
- `recipientId / recipientType`：作为平台中立目标语义主字段，引入并逐步替代 group-only 内部心智
- `channel`：从默认 `qqbot` 抽到更中立枚举
- `providerMessageId`：降级为兼容字段；新脚本 / 新展示优先使用 `externalMessageId`
- `team-agent-output-sender.mjs`：把 `parseQqGroupIdFromScope()` 抽象为平台无关解析

### P3：脚本／夹具去 QQ 化

- smoke 用例从 QQ 样例 envelope 改为平台中立样例
- acceptance 从 `/webhook/qq` 主叙事迁到更中立入口口径（优先 `POST /internal/team/ingress`）
- 把历史 QQ 样例降格为 compat fixtures

### P4：命名与文档彻底收口

- `package.json` 名称
- 历史 README 文案
- Team ingress 文档命名
- 记忆与工程文档的统一口径

---

## 7．推荐的当前阅读顺序

1. `README.md`
2. `docs/architecture/ai-team-runtime-architecture-deployment-map-2026-03-13.md`
3. `docs/architecture/current-product-boundaries-and-compat.md`
4. `src/team/README.md`
5. `dashboard/README.md`

---

## 8．一句话

**当前产品定义已经切到 AI Team Runtime / Dashboard；QQ / NapCat 仍然重要，但更准确的角色是“兼容层与迁移背景”，而不是项目本体。**
��然重要，但更准确的角色是“兼容层与迁移背景”，而不是项目本体。**
