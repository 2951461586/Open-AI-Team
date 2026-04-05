# Standalone Harness Baseline Release（P11 定版）

> 目标：把当前 baseline 从“能跑”升级到“**对外可交付、可复用、可审查**”。

---

## 1．黄金基线结论

当前对外默认入口已经固定为：

| 入口层 | 当前定位 | 是否默认对外入口 |
|---|---|---|
| `src/agent-harness-core/` | standalone harness canonical baseline authority | **是** |
| `examples/oss-minimal/` | wrapper / regression facade / runnable sample | **是，但仅作为 facade** |
| OpenClaw host / gateway / session substrate | 宿主实现 / compat / 接线背景 | **否** |

因此，外部视角默认入口必须是：

- `src/agent-harness-core/README.md`
- `docs/architecture/independent-agent-onboarding.md`
- `docs/architecture/standalone-harness-baseline-release.md`
- `examples/oss-minimal/README.md`

而不是：

- OpenClaw gateway 路径
- OpenClaw session 历史模型
- `openclaw*.mjs` compat 壳
- `/root/.openclaw/*` 私有宿主配置

---

## 2．对外可交付面

### 2.1 代码 authority

| 路径 | 定位 |
|---|---|
| `src/agent-harness-core/index.mjs` | Harness SDK / contract builders authority |
| `src/agent-harness-core/standalone-product-runtime.mjs` | 正式 product runtime authority |
| `src/agent-harness-core/oss-agent-manifest.json` | 正式 runtime / provider / role authority |
| `src/agent-harness-core/oss-agent-package.json` | 正式 package / shell / plugin / bridge authority |
| `src/agent-harness-core/agent-shell.mjs` | 正式 shell / onboarding / doctor authority |
| `examples/oss-minimal/*` | facade / sample / regression authority |

### 2.2 对外交付能力面

当前黄金基线已覆盖：

- run / resume / drain / stream
- crash-resume / durable recovery / source-first recovery
- broker / queue / lease / retry / multi-broker / failover
- external durable state / shared authority / scheduler
- session / desk / host-layer
- plugin / bridge / lifecycle / shell
- capability gate / route contracts
- doctor / onboarding / activation checklist

---

## 3．文档矩阵

| 维度 | 权威文档 |
|---|---|
| 基线总览 | `src/agent-harness-core/README.md` |
| 独立接入 | `docs/architecture/independent-agent-onboarding.md` |
| 黄金基线发布面 | `docs/architecture/standalone-harness-baseline-release.md` |
| 样板 / facade 使用 | `examples/oss-minimal/README.md` |
| Team runtime 总架构 | `docs/architecture/current-team-runtime-architecture.md` |
| 仓库入口 | `README.md` |

---

## 4．验证矩阵

### 4.1 baseline 结构守门

| 脚本 | 作用 |
|---|---|
| `scripts/team/team-harness-authority-smoke.mjs` | baseline authority / productized substrate 守门 |
| `scripts/team/team-compat-boundary-smoke.mjs` | compat boundary 守门 |
| `scripts/team/team-independent-agent-onboarding-smoke.mjs` | P10 独立 Agent 接入守门 |
| `scripts/team/team-oss-release-baseline-smoke.mjs` | P11 黄金基线发布面守门 |

### 4.2 产品能力守门

| 脚本 | 作用 |
|---|---|
| `scripts/team/team-standalone-broker-mainline-smoke.mjs` | broker substrate 主链守门 |
| `scripts/team/team-standalone-product-capability-smoke.mjs` | session / desk / bridge / shell / authority 产品面守门 |
| `scripts/team/team-oss-minimal-smoke.mjs` | facade runnable smoke |
| `scripts/team/team-oss-minimal-crash-resume-smoke.mjs` | crash-resume / recovery 守门 |

### 4.3 canonical 总入口

| 命令 | 作用 |
|---|---|
| `npm run smoke:team` | canonical mainline baseline |
| `npm run smoke:team:batch` | batch baseline |

---

## 5．run / resume / recovery / failover / capabilities 统一口径

### 5.1 run / resume

| 场景 | 命令 |
|---|---|
| create + run | `node examples/oss-minimal/run-demo.mjs` |
| start-only | `node examples/oss-minimal/run-demo.mjs --start-only` |
| partial resume | `node examples/oss-minimal/run-demo.mjs --resume <runDir> --steps 2 --stream` |
| final drain | `node examples/oss-minimal/run-demo.mjs --resume <runDir> --drain --stream` |

### 5.2 recovery / failover

| 能力 | 当前基线信号 |
|---|---|
| source-first recovery | `recoverySourceFirstReady=true` |
| crash recovery | `crashRecoveryReady=true` |
| orphan lease reaping | `reapingReady=true` |
| failover | `failoverReady=true` |
| multi-broker | `multiBrokerReady=true` |

### 5.3 capability observability

| 查询面 | 命令 |
|---|---|
| package | `node examples/oss-minimal/agent-shell.mjs package` |
| plugins | `node examples/oss-minimal/agent-shell.mjs plugins` |
| onboarding | `node examples/oss-minimal/agent-shell.mjs onboarding` |
| routes | `node examples/oss-minimal/agent-shell.mjs routes <runDir>` |
| capabilities | `node examples/oss-minimal/agent-shell.mjs capabilities <runDir>` |
| doctor | `node examples/oss-minimal/agent-shell.mjs doctor <runDir>` |

---

## 6．对外审查标准

若外部 reviewer 只从 standalone baseline 视角审查仓库，应该能直接看清：

- baseline authority 在哪里
- facade sample 在哪里
- 合同有哪些
- shell / doctor / activation 怎么用
- run / resume / recovery / failover 如何验证
- canonical smoke / batch smoke 如何跑

若 reviewer 还需要先理解 OpenClaw 宿主内部会话模型，说明 P11 仍未完成。

当前定版判断：

**默认外部视角已经可以直接从 standalone harness baseline 理解并验证系统，不必再从 OpenClaw-host 路径入手。**

---

## 7．发布完成标志

满足以下条件，即视为 P11 完成：

- README / 架构文档 / baseline 文档口径统一
- standalone harness 成为默认对外入口
- run / resume / recovery / failover / capabilities 文档统一
- 验证矩阵显式化
- facade/sample 与 canonical baseline 边界清楚
- mainline smoke 把 P10/P11 守门纳入 canonical baseline
