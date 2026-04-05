# Debate Receiver Retired Contract（P7，2026-03-27）

> 目标：把 legacy debate receiver 从“仍可命中 live host/runtime”收口到**显式 retired contract**，避免后续继续把历史入口当成现役能力。

## 本轮动作

- `POST /internal/commands/receipt`
  - **仅保留** `team_output_receipt` 主线语义。
  - 非 team receipt 的 legacy debate receipt 请求，统一返回：
    - `410 Gone`
    - `error=legacy_receiver_retired`
    - `reason=legacy_debate_receipt_retired`
- `POST /internal/debate/sent`
  - 统一返回 retired contract：
    - `410 Gone`
    - `error=legacy_receiver_retired`
    - `reason=legacy_debate_sent_retired`
- `GET /internal/debate/governance`
- `GET /internal/debate/governance/:debateId`
  - 统一返回 retired contract：
    - `410 Gone`
    - `error=legacy_receiver_retired`
    - `reason=legacy_debate_governance_retired`

## 结构同步

- `src/routes/index-routes-entry.mjs`
  - route 层直接返回 retired contract，不再把 legacy receiver 请求继续转交 debate host
- `src/index.mjs`
  - 已移除 `buildDebateLegacyHost()` 的 live import / 构造 / 注入
- `scripts/index-surface/index-remaining-surface-structure-check.mjs`
  - 已改为校验：主入口不再 import / passthrough `debateLegacyHost`
- `scripts/index-surface/index-remaining-surface-split-smoke.mjs`
  - 已改为校验 retired contract：`401` 仍保留，授权命中 legacy receiver 时应返回 `410` 与 retired reason

## 当前主线结论

- `team_output_receipt` 仍是 live mainline contract
- `legacy debate receipt / sent / governance` 已不再是 live route contract
- 后续若继续推进删除，目标应转为：
  1. 删除已失去 route contract 的 host/runtime 残留
  2. 收 archive / docs / structure-check 中的历史说明

## 一句话判断

**P7 完成后，legacy debate receiver 已从“还能打到 live host”收口为“显式 retired contract”；当前仍保留主线价值的只剩 `team_output_receipt`。**
