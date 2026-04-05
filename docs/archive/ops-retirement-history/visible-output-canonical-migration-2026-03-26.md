# Visible Output Canonical Migration（2026-03-26）

## 目的

这份说明用于明确：**AI Team Runtime 的用户可见输出主链已经从历史的 `19100 /internal/team/output` 兼容链，收口到 dashboard websocket canonical lane。**

后续排障、验收、文档、脚本命名都必须遵守这个口径，避免继续把历史链路误判为主链故障。

---

## 一句话结论

- **当前 canonical visible output**：dashboard websocket broadcast
- **当前 canonical 事件**：`visible_output` / `agent_reply`
- **`POST /internal/team/output`**：仅 `legacy compat / investigate`
- **19100 remote tunnel authoritative receipt**：已退役，不再作为主验收口径

---

## 为什么要迁移口径

历史上，`/internal/team/output` 承担过 Team visible output 的正式入口语义，因此很多脚本、文档、排障习惯会把它当作“主链”。

但现网真实产品行为已经变化：

- 用户可见输出最终以 **dashboard websocket** 广播为准
- authoritative delivered 的验活也以 dashboard 读模型 / broadcast / mailbox / blackboard 为准
- 19100 与 remote tunnel 链更适合归类为：
  - 历史兼容语义
  - 调查 / 回放辅助面
  - 退役期残留脚本的旧依赖

如果继续把 19100 口径当主链，会带来两个问题：

- **假阴性**：旧 tunnel 失败，被误判成现网 visible output 主链失败
- **排障跑偏**：工程师会去盯 `/internal/team/output`、19102/19104 alias、remote receipt，而不是 dashboard websocket / read model

---

## 迁移后的正式口径

### 正式主链

```text
Dashboard / API / WS 输入
  -> Orchestrator / Team Runtime
  -> output gate
  -> dashboard websocket canonical broadcast
  -> visible_output / agent_reply
  -> mailbox / blackboard / artifacts / evidence / read model
```

### 正式验收口径

优先使用：

- `scripts/acceptance/canonical/team-output-authoritative-live.mjs`
- `scripts/acceptance/canonical/team-three-node-live.mjs`

关键成功信号：

- `outputDeliveredCount >= 1`
- `authoritative = true`
- `channel = dashboard`
- `deliveryMode = dashboard`
- `via = dashboard_ws`
- 存在 `visible_output` / `agent_reply` broadcast

---

## 已退役 / 不再作为主链的内容

### 已退役 / 改名脚本

以下旧脚本路径曾作为 retired / renamed 迁移护栏存在，现已进入真实删除阶段；如需对应能力，请直接使用 canonical 入口或当前仍保留的准确命名脚本：

- `scripts/acceptance/canonical/team-output-violet-tunnel-live.mjs`（已删；改用 canonical authoritative acceptance）
- `scripts/acceptance/canonical/team-output-lebang-tunnel-live.mjs`（已删；改用 canonical authoritative acceptance）
- `scripts/team/team-output-violet-tunnel-authoritative-acceptance.mjs`（已删；改用 dashboard authoritative output acceptance）
- `scripts/team/team-visible-output-bridge-rpc-smoke.mjs`（已退场；其历史 retired 哨兵价值已收口进文档，不再保留单独 smoke）
- `scripts/team/team-visible-output-explicit-delivery-smoke.mjs`（已退场；其历史 retired 哨兵价值已收口进文档，不再保留单独 smoke）
- `scripts/team/team-visible-output-bridge-rpc-acceptance-smoke.mjs` → `scripts/team/team-output-receipt-authoritative-writeback-smoke.mjs`（旧 legacy 文件名已真实删除）

### 已降级为 legacy compat 的入口

- `POST /internal/team/output`
- `laoda:19100/internal/team/output`
- `19102 -> violet:19100`
- `19104 -> lebang:19100`
- “remote tunnel authoritative receipt” 相关口径

这些内容**不是现网 canonical visible output 主链**，只可用于：

- 历史兼容说明
- 调查 / 回放辅助
- 退役资产梳理

---

## 文档与配置同步结果

本轮已同步收口的活文件包括：

- `README.md`
- `docs/architecture/current-team-runtime-architecture.md`
- `docs/architecture/current-product-boundaries-and-compat.md`
- `docs/ops/napcat-bridge-boundaries.md`
- `docs/architecture/ai-team-runtime-architecture-deployment-map-2026-03-13.md`
- `config/team/network-ports.json`
- `src/index-env.mjs`
- `package.json`

统一后的口径是：

- **dashboard websocket = canonical**
- **`/internal/team/output` = legacy compat / investigate**

---

## 后续操作建议

### 该怎么验活

优先跑：

- `node scripts/acceptance/canonical/team-output-authoritative-live.mjs`
- `node scripts/acceptance/canonical/team-three-node-live.mjs`

### 不该再怎么排障

避免再把以下现象直接解释为主链故障：

- `19100 /internal/team/output` 不通
- `19102/19104` alias 失效
- remote tunnel authoritative receipt 脚本失败

先确认的是：

- dashboard websocket broadcast 是否产生
- mailbox / blackboard / output.delivered 是否落账
- `channel=dashboard` / `deliveryMode=dashboard` / `via=dashboard_ws` 是否成立

---

## 备注

如果后续需要彻底删除 legacy compat 入口，应单开一次“真实删除”收口，而不是在这次口径迁移里混做。

本次迁移的目标是：**先把“什么才是主链”讲清楚，并让误跑旧脚本的人立即得到正确提示。**
