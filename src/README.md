# `src/` 目录说明

## 目录职责

`src/` 现在只保留 Orchestrator 的**现役入口骨架**、**AI Team runtime 主域**，以及已升格的 **agent-harness-core / session substrate 抽象层**。

### 根目录保留

- `index.mjs`：Orchestrator 主入口
- `index-bootstrap.mjs`：启动期装配 / surface 注册 / runtime 接线（现已拆成 host bootstrap + session substrate composition，并支持 `standalone-broker` 主线接入）
- `index-env.mjs`：基础环境配置读取
- `index-host-config.mjs`：宿主无关 host runtime config surface（repo config + env + service env）
- `routes/`：现役 HTTP route registrar 与 surface adapter
- `webhook-event-router.mjs`：Webhook 事件入口
- `README.md`：本说明文件

> `supervisor.mjs` 已退出现役源码面，不再作为当前主入口骨架的一部分。

### 分域目录

- `team/`：AI Team runtime 主域，包含 TL runtime、resident runtime、team store、native chat、task dispatcher、delivery target、role contracts、team governance runtime 等现役实现
- `team-core/`：平台无关语义层与共享 contract
- `team-runtime-adapters/`：宿主无关 runtime adapter / control plane / session substrate adapter
- `agent-harness-core/`：宿主无关 Harness SDK / contract set / session / desk / plugin / bridge / shell 协议层，以及已产品化的 standalone broker runtime

## Authority statement

- **`src/` is the current canonical implementation authority for the open-source Team Harness line.**
- `packages/` and `apps/` currently act mainly as export surfaces / migration facades unless a specific package/app has completed migration.
- Any duplicated runtime logic must resolve in favor of `src/` until migration is finished and the authority docs are updated.

## 当前整理原则

- 根目录只放“入口骨架”和“跨域注册层”。
- Team 相关实现优先收进 `team/`，避免再回到根目录散落。
- Host bootstrap / session substrate 相关装配统一收口在 `index-bootstrap.mjs` + `team-runtime-adapters/`。
- broker-first standalone harness 不再只停留在 `examples/`，正式资产已进入 `agent-harness-core/`。
- 阶段 C 后，OpenHanako 风格的 **session / desk / plugin / bridge / shell** 产品合同与运行证据，也已纳入 standalone broker 主线口径，而不是继续挂在 sample-only 叙事下。
- 已退役的 debate era / pipeline shim / 旧 compat bridge 不再恢复到 `src/` 主口径。
- `.bak`、临时影子、任务工作区、旧 CloudBase 发布产物、executor report 都不属于源码树主版本面。

## 回归要求

涉及 `src/` 入口、host bootstrap、session substrate、standalone broker mainline 或 team route/runtime 调整后，至少优先跑当前仍然现役的检查：

- `scripts/index-surface/index-remaining-surface-structure-check.mjs`
- `scripts/index-surface/index-remaining-surface-split-smoke.mjs`
- `scripts/team/team-harness-authority-smoke.mjs`
- `scripts/team/team-standalone-broker-mainline-smoke.mjs`
- `scripts/team/team-standalone-product-capability-smoke.mjs`
- `scripts/smoke/team-mainline.mjs`
- `scripts/smoke/team-batch.mjs`

若改动触达 Team 主流程或 TL runtime，再补：

- `scripts/acceptance/canonical/team-three-node-live.mjs`
- `scripts/acceptance/canonical/team-dashboard-rightpanel-deeplink-smoke.mjs`
