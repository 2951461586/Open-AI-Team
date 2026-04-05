# P3-lite Security Audit — 2026-03-24

> **强覆盖提醒（2026-03-26）**：本文是 2026-03-24 当时的安全收口现场记录，里面提到的旧脚本路径、`/internal/team/output`、以及 remote tunnel 相关验收口径，**都应按历史阶段上下文理解**，不要直接当作现网主链操作手册。当前 visible output canonical 口径请优先看：`docs/ops/visible-output-canonical-migration-2026-03-26.md`。

## 本轮目标

以**最小改动**先收口已经确认的安全断点：

- Dashboard 控制面鉴权缺失
- acceptance / team 脚本硬编码 `x-orch-token`
- 当前 internal / public surface 缺少一份可审计清单

---

## 已落地补丁

### 1．Dashboard 控制面补鉴权

- 路由：`POST /api/dashboard/control`
- 当前行为：服务端新增 `isDashboardAuthorized(req)` 校验
- 接受头：
  - `Authorization: Bearer <DASHBOARD_TOKEN>`
  - 或 `x-dashboard-token: <DASHBOARD_TOKEN>`
- 当前行为：未配置 `DASHBOARD_TOKEN` 也**默认拒绝**
- 未通过鉴权时返回：
  - `401 { ok: false, error: "dashboard_unauthorized" }`

### 2．清除硬编码 ORCH token

已修文件：

- `scripts/acceptance/canonical/team-output-violet-tunnel-live.mjs`
- `scripts/acceptance/canonical/team-output-lebang-tunnel-live.mjs`
- `scripts/team/team-output-violet-tunnel-authoritative-acceptance.mjs`

当前行为：

- 从 `loadIndexConfig().ORCH_KICK_TOKEN` 或 `process.env.ORCH_KICK_TOKEN` 读取
- 若为空，脚本直接抛错退出
- 不再把固定 token 字面量提交到仓库里

---

## 当前 surface 清单

## Public / browser-facing

### Public low-sensitivity read

- `GET /state/team`
- `GET /state/team/contracts`
- `GET /state/team/tasks`
- `GET /state/team/artifacts`
- `GET /state/team/pipeline`
- `GET /state/team/residents`
- `GET /state/team/nodes`
- `POST /api/chat/create`
- `GET /ws/chat`

### Dashboard-token protected read / write

- `GET /state/team/mailbox`
- `GET /state/team/workbench`
- `GET /state/team/dashboard`
- `GET /state/team/dashboard/view`
- `POST /api/dashboard/control`

### CORS boundary

由 `DASHBOARD_CORS_ORIGIN` 控制允许来源；默认只允许：

- `https://board.liziai.cloud`

> 注意：CORS 不是鉴权。写操作必须额外依赖 token；当前已为 `/api/dashboard/control` 补齐。

---

## Internal / orchestrator-only

这些面应继续视为**控制面**，要求 `x-orch-token`：

- `POST /internal/team/task`
- `POST /internal/team/message`
- `POST /internal/team/plan`
- `POST /internal/team/review`
- `POST /internal/team/decision`
- `POST /internal/team/planner-completion`
- `POST /internal/team/critic-completion`
- `POST /internal/team/judge-completion`
- `POST /internal/team/executor-result`
- `POST /internal/team/reroute/consume`
- `POST /internal/team/control`
- `POST /internal/team/dispatch`
- `POST /internal/team/dispatch/classify`
- `POST /internal/team/resident/heartbeat`
- `POST /internal/team/resident/sweep`
- `POST /internal/team/output`
- `POST /internal/debate/*`

---

## 风险判断

### 已收口

- Dashboard 写控制面无 token 校验
- acceptance 脚本硬编码固定 ORCH token

### 仍待下一轮处理

- Dashboard token 当前是 `NEXT_PUBLIC_DASHBOARD_TOKEN`，意味着它是**浏览器可见凭证**；它只能作为“受限控制面口令”，不能等价看作高强度密钥
- 仍需继续审核其它 `/state/team/*` 读接口是否也要继续细分为 public / dashboard-token / internal-only

---

## 下一步建议

### P3-lite 后续小步

1. 继续审查 `/state/team/summary`、`/state/team/governance`、`/state/team/control` 是否也应进入 dashboard-token 保护面
2. 把 internal route contract 和 public route contract 分文件文档化
3. 审查 dashboard 构建产物，确认未混入非 dashboard scope 的 token / internal path 说明

---

## 结论

本轮 P3-lite 不是“写报告”，而是已经完成两处真实补丁：

- **补硬 Dashboard 控制面鉴权**
- **移除仓库内硬编码 ORCH token**

并补齐了当前可继续审计的 surface 基线文档。
