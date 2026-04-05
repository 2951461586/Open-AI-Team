# Debate Legacy Prunable Surfaces — 2026-03-24

> ⚠️ 历史分析文档：本文件记录的是 P7 / P8 之前关于 legacy debate surface 的 staged-pruning 判断。
> 当前真实状态应以后续文档为准：`debate-receiver-retired-contract-p7-2026-03-27.md`、`debate-runtime-retired-p8-2026-03-27.md`。

> 目的：在 `compat inventory + freeze` 与 `runtime legacy boundary` 之后，继续识别 debate legacy 子系统里哪些面已经可以准备删除，哪些仍需保留一轮以上作为桥接／审计面。

---

## 1．当前判断

`src/debate/` 当前已经明确是 **legacy / historical / not-for-mainline**。

但它还不是“现在立刻全删”的状态，因为其中仍有两类残留价值：

- **A．桥接型残留**：仍承接 `/internal/commands/receipt` 与 `/internal/debate/*` 历史入口
- **B．审计型残留**：仍承接 debate governance / projection / fallback 取证与历史诊断

因此，当前更适合的动作不是一把删，而是：

1. 先把入口装配进一步缩到 `src/debate/` 边界里
2. 再按“桥接 / 审计 / 已死面”分批删

---

## 2．可删面判断

## 2.1 现在不宜直接删

| 路径 | 原因 |
|---|---|
| `_trash/20260327-p6-debate-receipt-bridge-retire/src/debate/debate-receipt-bridge.mjs` | P6 已退入回收区；`/internal/commands/receipt` 的 team 分流在 route 层，legacy debate receipt host 已直连 `debate-runtime-receipt.mjs` |
| `src/debate/debate-sent-bridge.mjs` | 仍承接 `/internal/debate/sent` 历史 sent fallback 入口 |
| `src/debate/debates-store.mjs` | 仍被 `/state/debate`、`/internal/debate/governance*`、health/state 观测使用 |
| `src/debate/debate-runtime-receipt.mjs` | receipt authoritative 路径仍可作为 legacy governance 事实来源 |
| `src/debate/debate-runtime-sent.mjs` | sent fallback 虽已退役，但仍被 legacy route 入口引用 |

## 2.2 已可视为“下一刀优先候选”

| 路径 / 面 | 当前判断 | 建议 |
|---|---|---|
| `src/index.mjs` 中对 debate legacy 的直接 helper/bridge 导入 | 不应再留在主入口 | 继续下沉到 `src/debate/` host / context |
| `tryHandleEntryRoute(...)` 对 debate legacy 字段的平铺依赖 | 已影响 route contract 清晰度 | 改成 `debateLegacy` 子对象注入 |
| `scripts/index-surface/index-remaining-surface-structure-check.mjs` 对主入口直引 debate bridge 的断言 | 反映的是旧形态，不该固化 | 下一刀改成断言“主入口通过 legacy host/context 注入” |
| `docs/ops/p3-lite-security-audit-2026-03-24.md` 中 `/internal/debate/*` 描述 | 仍只有控制面描述，缺少退役态标签 | 后续补 `legacy-only / reference-only` 标注 |

## 2.3 更后面再删

| 路径 / 面 | 原因 |
|---|---|
| `/internal/debate/governance*` | 仍有历史治理取证价值，删前需确认无人依赖 |
| `scripts/debate/*` | 仍提供 legacy runtime 结构校验与回归 smoke |
| `docs/architecture/*` 中对 debate legacy 的历史描述 | 当前仍有审计／回滚参考价值 |

---

## 3．本轮结论

当前最合适的第三刀动作不是“删 debate”，而是：

- **继续缩主入口对 debate legacy 的直接感知面**
- **把 debate legacy route/runtime 依赖再压回 `src/debate/` 自己的 host/context**
- **把可删候选单独列出来，避免下一刀还要重新盘一遍**

---

## 4．P5 之后的即时更新

- 已新增 `src/debate/debate-legacy-host.mjs`，把 `/internal/commands/receipt`、`/internal/debate/sent`、`/internal/debate/governance*` 的 legacy 业务面收进 host 边界。
- `index-routes-entry.mjs` 现在只保留：**鉴权、JSON 解析、URL 分发、调用 `debateLegacyHost`**，不再自己承载 governance 默认对象或 receipt/sent 业务拼装。
- 这意味着下一刀若要删 legacy 面，优先可以围绕 `debate-legacy-host.mjs` 内部实现与其下游 bridge/runtime/store 逐层收缩，而不需要再碰主入口 route contract。

## 5．P6 之后的即时更新

- `src/debate/debate-legacy-host.mjs` 已继续瘦身为总装配层；当前内部 receipt / sent / governance 职责已拆为：
  - `debate-legacy-receipt-runtime-host.mjs`
  - sent 内联入口（旧 `debate-legacy-sent-host.mjs` 已先前退场）
  - `debate-legacy-governance-host.mjs`
- `src/debate/debate-receipt-bridge.mjs` 与已死的 `src/debate/debate-legacy-receipt-host.mjs` 已于 P6 退入 `_trash/20260327-p6-debate-receipt-bridge-retire/`。
- 这意味着下一轮 staged deletion 时，可以按 **receipt / sent / governance** 三条线分别判断依赖与删改顺序，而不必再从一个混合 host 里反拆责任。

## 6．P7 之后的即时更新

- `src/debate/debate-sent-bridge.mjs` 这层零逻辑 wrapper 已从 `src/` 真实退役，并移到 `_trash/20260324-p7-debate-sent-bridge-retire/` 留作可回看点。
- `debate-legacy-entry-context.mjs` 已改为 **直接导入 `consumeSent()`**。
- 这说明 sent 线现在已经进入“**先剥零逻辑壳，再继续判断 runtime 本体是否还能缩**”的阶段；相比 receipt / governance，sent 线更适合作为第一条 staged deletion 试刀线。

## 7．P7 第二刀之后的即时更新

- `src/debate/debate-legacy-sent-host.mjs` 这层 sent 纯转发 host 壳也已从 `src/` 退场，并移到 `_trash/20260324-p7-debate-legacy-sent-host-retire/`。
- `buildDebateLegacyHost(...)` 现在直接内联 `handleSent(...)`，从而把 sent 线再收掉一层显式文件边界。
- 这意味着 sent 线在 `src/` 内已经只剩：`debate-legacy-entry-context.mjs`、`debate-runtime-sent.mjs` 与总装配 `debate-legacy-host.mjs` 的内联入口；下一步若继续删，就该开始审视 runtime 本体里哪些统计／取证分支还能再拆。

## 8．P8 第一刀之后的即时更新

- `src/debate/debate-runtime-sent.mjs` 已进一步减脂：把 `runtime.authority.checked / runtime.fallback.rejected / runtime.progression.owned` 的治理遥测与 projection 写回，抽到新文件 `src/debate/debate-runtime-sent-governance.mjs`。
- P8 第二刀继续把 `sourcePath / authorityPath / telemetryVersion / stepKey` 这类 authority/fallback 上下文构造，也收进 governance helper；`debate-runtime-sent.mjs` 不再自己内联这些治理语义常量。
- P8 第三刀开始收缩 **event payload 本身**：authority/fallback/owned 三类 debate governance event 现在只写入 read-model / dashboard 真正在消费的最小字段集，不再把 `projectionState / currentCommandId / lastDeliveredCommandId / traceId / debateId / scopeKey / msgId` 这类对治理视图无增益的冗余上下文继续塞进 payloadJson。
- 现在 `debate-runtime-sent.mjs` 更接近纯推进状态机；而治理审计逻辑单独落在 helper，后续若继续 staged deletion，可以更清楚地区分“推进本体”与“审计残留”。
- 这三刀都没有改变 legacy route contract，也没有删掉现有治理事实；只是把 sent runtime 本体里的职责边界继续切开，并开始压缩 legacy 审计 payload 的噪音密度。

## 9．一句话结论

**Debate legacy 现在更适合“继续收窄主入口耦合＋列清可删面”，还不适合无差别整包删除。**
