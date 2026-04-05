# agent-harness-core

## 目标

`agent-harness-core/` 承载 **宿主无关的 Harness SDK 面**，并从本轮开始承载 **正式产品化的 standalone broker harness runtime**。

它不关心具体宿主平台（如 Electron、Bridge UI、聊天平台容器）的细节；只关心：


- Harness API
- Contract Set
- Workflow Pack / Policy Pack 抽象
- Agent Package / Session / Desk / Plugin / Bridge / Shell 的最小协议层
- Broker-first execution substrate 的正式产品资产

## 当前模块

| 文件 | 职责 |
|---|---|
| `index.mjs` | `createHarness`、contract builders、workflow/policy pack 抽象 |
| `workflow-pack.mjs` | 产品化 workflow pack，不再依赖 sample 路径 |
| `policy-pack.mjs` | 产品化 policy pack，不再依赖 sample 路径 |
| `provider-registry.mjs` | 产品化 provider registry，承载 host / plugin / bridge / shell 运行面 |
| `backend-provider.mjs` | 产品化 durable backend provider |
| `remote-broker-runtime-adapter.mjs` | 产品化 broker runtime adapter |
| `remote-broker-server.mjs` | 产品化 broker server |
| `role-worker.mjs` | 产品化 worker entry |
| `agent-shell.mjs` | 产品化 shell / onboarding / doctor / activation capability 接入入口 |
| `oss-agent-manifest.json` | 正式 standalone broker harness manifest |
| `oss-agent-package.json` | 正式 standalone broker harness agent package |
| `standalone-product-runtime.mjs` | 已产品化的 broker-first harness runtime |

## 边界

### 应该放这里
- Harness SDK 稳定接口
- Provider / Worker / Broker / Memory / Sandbox contract
- Agent package / session / desk / plugin / bridge / shell 最小协议
- Workflow / Policy 抽象
- standalone broker runtime 的正式产品资产

### 不应该放这里
- 具体宿主私有 control-plane / session substrate adapter 细节
- Telegram / Feishu / QQ / WeChat bridge provider 实现
- 仅宿主相关的 node-health / control-plane wiring
- Electron / desktop UI
- cron / heartbeat 后台宿主实现

## 当前主线判断

- **`src/agent-harness-core/` 是 standalone broker substrate 的 canonical baseline authority。**
- `standalone-product-runtime.mjs`、`oss-agent-manifest.json`、`oss-agent-package.json`、`agent-shell.mjs` 共同构成正式产品主链。
- `examples/oss-minimal/` 现在保留为 **wrapper / regression facade / runnable sample**：继续提供稳定 CLI、样例运行目录与 targeted smoke 入口，但不再承载主定义。
- 产品 bootstrap 已支持 `sessionSubstrate=standalone-broker`，可把 broker substrate 接进 Team Runtime 主链。
> 阶段 C / P5 / P6 结论：OpenHanako 风格的独立 agent 接入面（`session / desk / plugin / bridge / shell`）已进入产品主口径与主线 smoke；其中 `shell` 已从静态 onboarding 声明升级为 **productized onboarding / doctor / activation checklist** 接入面，而不是继续只留在 sample 侧。
