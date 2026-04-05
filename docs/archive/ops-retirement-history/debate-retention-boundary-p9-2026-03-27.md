# Debate Retention Boundary（P9，2026-03-27）

> 目标：把 P8 之后 `src/debate/` 剩余对象的**长期保留边界**钉死，避免后续一会儿误删、一会儿又把 retired host/runtime 拉回主树。

## source-first 结论

当前 `src/debate/` 主工作树只剩：

- `debate-compat-runtime.mjs`
- `debate-dualwrite.mjs`
- `debate-helpers.mjs`
- `debate-legacy-runtime-config.mjs`
- `debates-store.mjs`

真实 live 依赖如下：

### `src/index.mjs`
- `debate-compat-runtime.mjs`
- `debate-dualwrite.mjs`
- `debate-helpers.mjs`（`parseUrlParam`）
- `debate-legacy-runtime-config.mjs`

### `src/index-bootstrap.mjs`
- `debates-store.mjs`

### `scripts/governance/debate-governance-read-model-smoke.mjs`
- `debates-store.mjs`

### 反证
- `src/team/**`：无 debate import
- `scripts/team/**`：无 debate import
- `scripts/debate/`：只剩 `README.md`
- P8 retired 的 7 个 host/runtime 文件已不在 `src/` 主树

## 保留分层

### 1．长期保留层（只要治理读模型 / dashboard façade 仍存在）

- `debates-store.mjs`
- `debate-helpers.mjs`

### 2．阶段保留层（只要 live debate compat runtime 仍启用）

- `debate-compat-runtime.mjs`
- `debate-dualwrite.mjs`
- `debate-legacy-runtime-config.mjs`

## 删除前提

只有在 **live debate compat runtime 本身退役** 时，才可继续讨论：

- 删除 `debate-compat-runtime.mjs`
- 删除 `debate-dualwrite.mjs`
- 删除 `debate-legacy-runtime-config.mjs`

而在此之前，它们不属于 delete-ready。

## 禁止回流

以下对象已在 P8 退场，后续不得重新回流到 `src/` 主工作树：

- `debate-legacy-host.mjs`
- `debate-legacy-entry-context.mjs`
- `debate-legacy-governance-host.mjs`
- `debate-legacy-receipt-runtime-host.mjs`
- `debate-runtime-receipt.mjs`
- `debate-runtime-sent.mjs`
- `debate-runtime-sent-governance.mjs`

## 结构守门

P9 已把边界落入 `scripts/index-surface/index-remaining-surface-structure-check.mjs`，新增校验：

- `debateRemainingFilesExact`
- `scriptsDebateOnlyReadmeRemains`
- `indexImportsCompatRuntime`
- `indexImportsDualWriter`
- `indexImportsDebateHelperOnly`
- `indexImportsLegacyRuntimeConfig`
- `indexBootstrapImportsDebatesStore`
- `indexBootstrapNoOtherDebateImports`
- `governanceSmokeUsesDebateStore`
- `noOtherSrcImportsDebate`
- `teamTreeNoDebateImports`

## 一句话结论

**P9 之后，`src/debate/` 的长期保留边界已从“口头判断”升级成“文件 allowlist + import allowlist + team 禁止回流”的硬规则。**
