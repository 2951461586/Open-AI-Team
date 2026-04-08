# Index Surface Scripts 索引

## 目录定位

本目录集中保存 orchestrator 入口层 surface 的：
- route smoke
- structure-check
- split 回归
- registrar wiring 验证

重点覆盖 `index.mjs` 拆分后，对外 / internal surface 是否仍保持既定 contract。

---

## 1．Health / State Surface

### 主要脚本
- `index-health-state-route-split-smoke.mjs`
- `index-health-state-route-structure-check.mjs`

### 关注点
- health / state surface 仍可访问
- route split 后 contract 未漂移
- entry wiring 正常

---

## 2．Team Surface

### 主要脚本
- `index-team-route-split-smoke.mjs`
- `index-team-route-structure-check.mjs`

### 关注点
- team route wiring
- internal team surface contract
- split 后 team surface 未断

---

## 3．Remaining Surface

### 主要脚本
- `index-remaining-surface-split-smoke.mjs`
- `index-remaining-surface-structure-check.mjs`

### 关注点
- `/webhook/qq`（compat surface）
- `/internal/team/ingress`（canonical team ingress）
- `/internal/commands/receipt`（仅 `team_output_receipt` 保留主线；legacy debate receipt 应返回 retired）
- `/internal/debate/sent`（retired surface）
- `GET /internal/debate/governance`（retired surface）
- `GET /internal/debate/governance/:debateId`（retired surface）
- unauthorized / bad_request / retired surface
- route registrar matched / unmatched discipline

---

## 推荐使用方式

### 小改动
- 改 health / state：先跑 `index-health-state-*`
- 改 team route：先跑 `index-team-route-*`
- 改 entry / governance / webhook / sent / receipt：先跑 `index-remaining-surface-*`

### 大改动
- 若改了 `apps/api-server/src/index.mjs`、`src/routes/`、route registrar 或 surface wiring：
  - 先跑对应主题脚本
  - 再补跑 `index-remaining-surface-split-smoke.mjs`

---

## 当前一句话总结

> `scripts/index-surface/` 是 orchestrator 入口层 contract 的守门桶；凡是入口 wiring、internal route、webhook、governance surface 的改动，都应该优先回到这里做验证。
