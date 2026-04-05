# Debate Runtime Full Retirement（P11，2026-03-27）

> 目标：按整层退役口径，把 historical debate runtime 从主工作树与现网合同中整体清理。

## 本轮结论

`debate` 这层已不再作为现网 runtime 使用，现已完成：

- `src/debate/` 退主树
- webhook fallback 不再走 debate decision/runtime
- `/state/recent`、`/state/debate` 下线
- health 不再暴露 debate DB / checkpoint
- team runtime 不再接收 `debateStore`
- debate 专项 smoke / governance read-model smoke 退役

## 当前现网真相

- `/webhook/qq`
  - 复杂任务：进入 `team_task`
  - 非复杂任务：返回 `simple_reply`
- `/internal/commands/receipt`
  - 只保留 team output authoritative receipt
  - legacy debate receipt 已 retired
- `/internal/debate/sent`
  - retired
- `/internal/debate/governance*`
  - retired
- `/state/recent`
  - removed
- `/state/debate`
  - removed

## 结构变化

- `src/index.mjs`：不再 import 任何 `./debate/*`
- `src/index-bootstrap.mjs`：不再打开 debate store
- `src/team/team-policy.mjs`：不再把 `debate` 识别为 live workMode
- `src/webhook-event-router.mjs`：不再调用 `decisionFromEvent()`，simple fallback 改为 team-native `simple_reply`
- `src/team/team-runtime.mjs`：不再接收 `debateStore`

## 验收目标

- 主线只剩 team runtime
- 结构检查与 split smoke 同步到 team-only 真相
- canonical smoke 继续全绿
