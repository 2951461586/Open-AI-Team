# Independent Agent Onboarding（P10 定版）

> 目标：让**第三方 Agent** 在**不理解 OpenClaw 内部会话模型**的前提下，也能按文档接入当前 standalone harness baseline。

---

## 1．定版结论

当前独立 Agent 接入的**正式 authority** 已固定为：

| 层 | 角色 | 权威性 |
|---|---|---|
| `src/agent-harness-core/` | 正式产品资产、合同、runtime、shell、provider registry | **主 authority** |
| `examples/oss-minimal/` | wrapper / regression facade / runnable sample | **从 authority** |

因此，外部接入方默认应：

- **先看** `src/agent-harness-core/`
- **再用** `examples/oss-minimal/` 跑 demo / run / resume / doctor / crash-resume
- **不要**从 OpenClaw 宿主路径、OpenClaw session 语义、或 gateway 私有接线倒推 baseline

---

## 2．接入目标口径

对外接入的目标不是“把第三方 Agent 塞进 OpenClaw 内部会话模型”，而是让它理解以下**中立合同**：

- `agent manifest`
- `agent package`
- `provider registry`
- `worker contract`
- `session contract`
- `desk contract`
- `bridge contract`
- `shell contract`
- `capability gate`
- `doctor / activation checklist`

只要满足这些合同，第三方 Agent 就可以接入 standalone harness，而**不必知道**：

- OpenClaw main session 如何持久化
- OpenClaw gateway token 如何分发
- OpenClaw 内部 session history 如何读取
- OpenClaw memory plugin 如何实现

---

## 3．对外最小接入面

### 3.1 `oss-agent-manifest.json`

职责：声明 **runtime / provider / role / host contract**。

必须关注：

| 字段 | 含义 | 当前定版要求 |
|---|---|---|
| `runtime.kind` | runtime 类型 | 必须是 `standalone-harness` |
| `runtime.bootstrap` | bootstrap 入口 | 指向 `standalone-product-runtime.mjs` |
| `runtime.workerEntry` | worker 入口 | 指向 `role-worker.mjs` |
| `runtime.brokerEntry` | broker 入口 | 指向 `remote-broker-server.mjs` |
| `hostContract.hostAgnostic` | 是否宿主无关 | 必须为 `true` |
| `hostContract.requires.*` | 是否要求宿主能力 | 当前定版要求全部 `false` |
| `providers.*` | provider registry 主声明 | 必须显式声明 |
| `roles[]` | 角色集合 | 必须显式声明 role / displayName / contract |

### 3.2 `oss-agent-package.json`

职责：声明 **agent package / product shell / bridge / lifecycle / plugin / session / desk**。

必须关注：

| 字段 | 含义 | 当前定版要求 |
|---|---|---|
| `contractVersion` | package 版本 | `agent-package.v2` |
| `pluginRefs` | plugin 注入面 | 必须显式声明 |
| `sessionContract` | 独立 session 接入面 | 必须存在 |
| `deskContract` | desk 接入面 | 必须存在 |
| `hostLayerContract` | host-layer 接入面 | 必须存在 |
| `bridgePolicy` | bridge / route contract | 必须存在 |
| `runtimeCapabilityPolicy` | injected capability gate | 必须存在 |
| `lifecyclePolicy` | lifecycle / heartbeat / cron | 必须存在 |
| `productShell` | onboarding / doctor / activation checklist | 必须存在 |

### 3.3 `provider-registry.mjs`

职责：把 manifest/package 声明接到**实际 runtime provider**：

- model
- tool
- tool runtime
- sandbox
- memory
- events
- artifacts
- backend
- host
- bridge
- authority
- shell
- capability gate

### 3.4 `index.mjs`（contract builders）

当前 contract builder 已定版覆盖：

- provider contract
- worker contract
- broker contract
- memory contract
- sandbox contract
- backend contract
- session contract
- desk contract
- host-layer contract
- bridge contract
- lifecycle contract
- authority contract
- shell contract
- capability gate contract
- plugin contract
- agent package contract

这意味着第三方接入方可以直接围绕**显式 contract set**做实现，不需要猜 OpenClaw 内部对象结构。

---

## 4．默认接入流程

### 4.1 阅读顺序

1. `src/agent-harness-core/README.md`
2. `docs/architecture/independent-agent-onboarding.md`（本文）
3. `docs/architecture/standalone-harness-baseline-release.md`
4. `src/agent-harness-core/oss-agent-manifest.json`
5. `src/agent-harness-core/oss-agent-package.json`
6. `examples/oss-minimal/README.md`

### 4.2 激活顺序

| 步骤 | 命令 / 文件 | 通过标准 |
|---|---|---|
| 1 | `node src/agent-harness-core/agent-shell.mjs package` | package 可读 |
| 2 | `node src/agent-harness-core/agent-shell.mjs onboarding` | onboardingReady / commands / checklist 正常 |
| 3 | `npm run validate:third-party-agent` | third-party package 可通过产品 validator |
| 4 | `npm run smoke:third-party-agent` | third-party template smoke 通过 |
| 5 | `node examples/oss-minimal/run-demo.mjs --start-only` | 可创建 run |
| 6 | `node examples/oss-minimal/run-demo.mjs --resume <runDir> --steps 2 --stream` | continuation / chunk 正常 |
| 7 | `node examples/oss-minimal/agent-shell.mjs routes <runDir>` | bridge route 可观察 |
| 8 | `node examples/oss-minimal/agent-shell.mjs capabilities <runDir>` | capability gate / injected capabilities 可观察 |
| 9 | `node examples/oss-minimal/agent-shell.mjs doctor <runDir>` | doctor 检查通过 |

---

## 5．与 OpenHanako 对齐的口径

当前对齐 OpenHanako 的不是“宿主实现细节”，而是**独立 Agent 产品面**：

| OpenHanako 风格诉求 | 当前对应面 |
|---|---|
| 独立 agent package | `oss-agent-package.json` |
| 独立 session 接入 | `sessionContract` |
| desk / inbox / outbox | `deskContract` + host-layer |
| plugin 扩展 | `pluginRefs` + plugin system |
| bridge / route | `bridgePolicy` + bridge host |
| shell / onboarding / doctor | `productShell` + `agent-shell.mjs` |
| activation checklist | `productShell.activationChecklist` |

因此当前真正的结论是：

**第三方 Agent 不需要理解 OpenClaw 内部 session 模型，也能通过 package / manifest / shell / contract set 接入。**

---

## 6．接入完成标志

满足以下条件，即视为 P10 完成：

- `manifest / package / provider registry / worker contract` 全部有文档与现役实现
- `bridge / shell / desk / session / host-layer / capability gate` 全部进入正式 contract set
- `doctor / onboarding / activation checklist` 为真实 product surface，而非 sample-only 文案
- `examples/oss-minimal/` 仅作为 facade / sample，不再承担主定义
- 第三方接入方可只看 standalone harness 文档与样板完成接入

---

## 7．守门脚本

- `scripts/team/team-independent-agent-onboarding-smoke.mjs`
- `scripts/team/team-standalone-product-capability-smoke.mjs`
- `scripts/team/team-oss-minimal-smoke.mjs`

这些脚本共同确保：

- 合同存在
- 产品接入面存在
- facade 可运行
- shell / doctor / activation 可观察
- baseline 不会重新退回 OpenClaw-first 叙事
