# team-runtime-adapters

## 目标

`team-runtime-adapters/` 承载 **AI Team 的运行时适配层**。

它负责把平台无关的 `team-core/` 与具体宿主 / provider / session substrate 接起来。

当前设计原则：

- `team-core/`：纯平台无关语义层
- `team-runtime-adapters/`：平台接线层
- `src/team/`：现役产品 runtime 与兼容入口

---

## 当前模块

| 文件 | 职责 |
|---|---|
| `control-plane.mjs` | 宿主无关 control plane client + multi-node routing；现役主别名为 `createControlPlaneClient` / `createSessionControlPlane` |
| `runtime-adapter.mjs` | 宿主无关 runtime adapter（probe / spawn / send / list / history）；主别名为 `createSessionSubstrateRuntimeAdapter` / `createControlPlaneRuntimeAdapter` |
| `remote-session-control-plane.mjs` | control plane client 具体实现；默认 provider=`control-plane-client`、kind=`control_plane_client` |
| `remote-session.mjs` | remote session runtime adapter 具体实现 |
| `execution-harness.mjs` | 通用 execution adapter 封装，给 TL runtime 直接消费 |

> OpenClaw / maintainer-host 相关 control-plane 工具名映射与 host bootstrap wiring 已下沉到 `src/integrations/openclaw/`，adapter core 仅保留可配置 contract 面。

---

## 边界

### 可以依赖
- control plane / session / provider-specific transport
- node routing / remote control token / session substrate
- adapter-specific fallback 语义

### 不应该依赖
- TL 决策协议
- workItem 规范化
- query contract
- capability / execution-surface 核心合同
- dashboard 业务语义

---

## 当前稳态

- 当前主线已切到 **control plane client + platform runtime adapter**；TL runtime 只通过 `runtimeAdapter + executionAdapter` 这组 kernel contract 与宿主通信，**不再接受 gateway / spawnSessionAdapter 直回退**。
- `control-plane.mjs` 现役主 factory 已切到 `createControlPlaneClient`；同时补充 `createSessionControlPlane` 作为更贴近 session-substrate 口径的中性别名。`remote-session-control-plane.mjs` 负责多节点 control plane 封装，默认合同为 `provider='control-plane-client'` + `kind='control_plane_client'`。
- `remote-session.mjs` 负责把多节点 control plane 封装成 `session_runtime_adapter`；现役主别名已切到 `createSessionSubstrateRuntimeAdapter`，并补充 `createControlPlaneRuntimeAdapter` 中性别名，具体宿主只体现在 control plane URL / token，不再侵入 TL runtime。
- `index-bootstrap.mjs` 现役 context surface 已切到 `sessionControlPlane`，并保留 `createControlPlaneHostBootstrap()` 作为中性 bootstrap 别名；OpenClaw/maintainer-host 具体 wiring 已下沉到 `src/integrations/openclaw/host-bootstrap.mjs`，不再向外暴露 `gateway / multiNodeGateway` 作为主合同面。
- 旧宿主命名的 compat re-export shell 已从工作树物理删除；当前 kernel 命名面只保留 control-plane / session-substrate 口径。
