# Debate Runtime Retired Cleanup（P8，2026-03-27）

> 目标：在 P7 已完成 legacy receiver route contract 收口之后，把已经**失去 route contract 的 legacy debate host/runtime 残留**从主工作树退场。

## 本轮退场对象

已退入 `_trash/20260327-p8-debate-runtime-retire/`：

### `src/debate/`
- `debate-legacy-host.mjs`
- `debate-legacy-entry-context.mjs`
- `debate-legacy-governance-host.mjs`
- `debate-legacy-receipt-runtime-host.mjs`
- `debate-runtime-receipt.mjs`
- `debate-runtime-sent.mjs`
- `debate-runtime-sent-governance.mjs`

### `scripts/debate/`
- `index-receipt-runtime-structure-check.mjs`
- `index-receipt-runtime-smoke.mjs`
- `index-sent-runtime-structure-check.mjs`
- `index-sent-runtime-smoke.mjs`

## 保留对象

本轮 **未删除**：

- `src/debate/debate-compat-runtime.mjs`
- `src/debate/debate-dualwrite.mjs`
- `src/debate/debate-helpers.mjs`
- `src/debate/debate-legacy-runtime-config.mjs`
- `src/debate/debates-store.mjs`
- `scripts/governance/debate-governance-read-model-smoke.mjs`

原因：这些对象仍服务于历史 debate 运行底座、治理读模型、dashboard façade 或治理验证，不属于“已失去 route contract 的 receiver host/runtime 残体”。

## 结构同步

- `src/debate/README.md` 已改为只描述当前仍保留的 debate 侧对象
- `scripts/debate/README.md` 已改为 retired 说明，不再宣称这些专项 smoke 仍是守门入口
- `src/README.md` 已同步为 P8 之后的真实结构
- `scripts/index-surface/index-remaining-surface-structure-check.mjs` 应继续作为主入口结构守门，并额外校验 retired debate runtime 文件不在主树

## 当前结论

**P8 完成后，legacy debate receiver 不仅失去 route contract，而且对应的 host/runtime 专项实现也已退出主工作树。**

剩余 `src/debate/` 已收缩为：
- 历史 compat runtime
- dualwrite / helper
- runtime config
- governance read model / dashboard façade

不再保留任何还能被误认为“可重新接回 legacy receiver contract”的活壳。
