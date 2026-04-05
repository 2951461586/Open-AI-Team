# AI Team Runtime 架构设计与部署配置图（2026-03-13）

> **历史快照说明**：本文保留旧阶段拓扑 / SSH alias 设计作为演进记录，**不是当前生产口径**。当前请以 `docs/architecture/current-team-runtime-architecture.md`、`config/team/roles.json`、`config/team/network-ports.json`、`config/team/network-ports.compat.json` 为准。
>
> **强覆盖提醒（2026-03-26）**：本文内凡是把 `19100 /internal/team/output`、`19102/19104 SSH alias`、或“remote tunnel authoritative receipt”写成正式入口 / 权威口径的段落，都应整体按**历史阶段结论**理解，**不要局部摘录复用**。现网 visible output canonical lane 已收口到 **dashboard websocket canonical lane**；如需当前口径，请直接看 `docs/ops/visible-output-canonical-migration-2026-03-26.md`。


## 结论摘要

- **AI Team Runtime 已是 orchestrator 仓库正式主链**，Debate Runtime 仅保留为 legacy／兼容层。
- **权威节点是 node-a**：统一承担 orchestrator authority、judge、output authority。
- **planner / executor 首选 node-b**：历史阶段曾通过 node-a 本地 SSH alias 口转到 node-b bridge 执行。
- **critic 首选 node-c**：通过 OpenClaw gateway / `sessions_spawn` 真 Agent 路径执行。
- **历史阶段里，用户可见输出曾以**：`/internal/team/output` **作为正式入口**；该结论已不适用于当前现网 canonical 口径。
- **三节点异步群消息 ingress 已并入主入口**：统一通过 `/webhook/qq` 接受 `team.async_ingress.v1 / team.visible_ingress.v1` envelope，落入 Team Runtime 主链。
- **治理面已经收口到 Team Runtime**：mailbox、blackboard、artifacts、evidence、batch snapshot、single-flight、`/state/team*` 查询面统一稳定化。

---

## 代码架构分层图

```text
┌────────────────────────────────────────────────────────────────────┐
│                         AI Team Orchestrator                      │
│                    Primary Product = Team Runtime                 │
├────────────────────────────────────────────────────────────────────┤
│ 1. Ingress / Bootstrap / Routes                                  │
│    - src/index.mjs                                                │
│    - src/index-bootstrap.mjs                                      │
│    - src/routes/*                                                 │
│    - src/webhook-event-router.mjs                                 │
├────────────────────────────────────────────────────────────────────┤
│ 2. Team Runtime Core                                              │
│    - src/team/team-runtime.mjs                                    │
│    - src/team/team-store.mjs                                      │
│    - src/team/team-policy.mjs                                     │
│    - src/team/team-role-deployment.mjs                            │
│    - src/team/team-roles-config.mjs                               │
│    - src/team/team-single-flight-guard.mjs                        │
├────────────────────────────────────────────────────────────────────┤
│ 3. Role Execution Layer                                           │
│    - planner  : bridge / session-runner / callback                │
│    - critic   : critic-adapter / critic-session-runner            │
│    - judge    : judge-adapter / judge runtime                     │
│    - executor : executor session runner / callback                │
│    - output   : output-gate / output-command-bridge / sender      │
├────────────────────────────────────────────────────────────────────┤
│ 4. Governance / Read Model                                        │
│    - mailbox / blackboard / artifacts / evidence                  │
│    - batch snapshot / visibility policy / delivery mode           │
│    - single-flight / reuse / governance timeline                  │
│    - /state/team* stable query API                                │
├────────────────────────────────────────────────────────────────────┤
│ 5. Config / Docs / Validation                                     │
│    - config/team/roles.json                                       │
│    - config/team/governance.json                                  │
│    - config/team/network-ports.json                               │
│    - docs/architecture/*                                          │
│    - scripts/smoke / scripts/acceptance / scripts/ops             │
└────────────────────────────────────────────────────────────────────┘
```

---

## 主链执行图

```text
QQ / webhook ingress
  -> src/index.mjs route decision
  -> Team Runtime create task / batch snapshot
  -> planner
  -> critic
  -> judge
  -> executor（approve 后触发）
  -> output gate
  -> /internal/team/output
  -> visible output / authoritative receipt
  -> mailbox / blackboard / artifacts / evidence
  -> /state/team* 查询面
```

---

## 三节点部署关系图

```text
                              ┌──────────────────────────────┐
                              │           node-a             │
                              │ <authority-host> / 127.0.0.1 │
                              │                              │
                              │ OpenClaw Gateway : 18789     │
                              │ Orchestrator     : 19090     │
                              │ Bridge RPC/Kick  : 19100     │
                              │ Async ingress    : /webhook/qq │
                              │                              │
                              │ Roles: authority / judge /   │
                              │        output authority      │
                              └──────────────┬───────────────┘
                                             │
                        SSH local forward    │
              19102 -> node-b:19100          │
              19104 -> node-c:19100          │
                                             │
                    ┌────────────────────────┴────────────────────────┐
                    │                                                 │
                    ▼                                                 ▼
      ┌──────────────────────────────┐                 ┌──────────────────────────────┐
      │            node-b            │                 │            node-c            │
      │ <worker-b-host>              │                 │ <review-c-host>              │
      │                              │                 │                              │
      │ legacyCompat19100 : 19100    │                 │ gateway         : 18789      │
      │ role      : planner/executor │                 │ bridge output   : 19100      │
      │ extra     : observer/standby │                 │ role            : critic     │
      │                              │                 │ mode            : true agent │
      └──────────────────────────────┘                 └──────────────────────────────┘
```

---

## 角色到节点映射

| 角色 | 首选节点 | 回退节点 | 执行模式 | 正式入口 |
|---|---|---|---|---|
| planner | node-a | node-a | `local_authority` | `node-a:19090` |
| executor | node-a | node-a | `local_authority` | `node-a:19090` |
| critic | node-c | node-a | `sessions_spawn` | `node-c:18789` |
| judge | node-a | node-a | `local_authority` | `node-a:19090` |
| output | node-a（默认）/ node-b / node-c | node-a | `dashboard_ws_canonical` | dashboard websocket canonical lane（历史 compat 细节请看 `docs/ops/visible-output-canonical-migration-2026-03-26.md`） |

来源：`config/team/roles.json`、`config/team/network-ports.json`、`src/team/team-runtime.mjs`。

---

## 关键端口配置图

| 节点 | 服务 | 绑定 | 端口 | 路径 / 说明 | 状态 |
|---|---|---:|---:|---|---|
| node-a | orchestrator | `0.0.0.0` | `19090` | authority 主入口 | active |
| node-a | legacyCompat19100 | `127.0.0.1` | `19100` | historical compat reference；runtime 不再挂载 `/internal/debate/kick` | legacy compat |
| node-a | teamOutputRpc | `127.0.0.1` | `19100` | `/internal/team/output` | **历史阶段正式输出入口（现已 legacy compat）** |
| node-a | nodeBBridgeAlias | `127.0.0.1` | `19102` | SSH forward -> `node-b:19100` | active |
| node-a | nodeCBridgeAlias | `127.0.0.1` | `19104` | SSH forward -> `node-c:19100` | active |
| node-b | legacyCompat19100 | `127.0.0.1` | `19100` | historical compat reference（非当前生产执行入口） | legacy compat |
| node-c | gateway | `127.0.0.1` | `18789` | critic formal exec | active |
| node-c | legacyCompat19100 | `127.0.0.1` | `19100` | historical compat reference（critic 主链已切到 gateway / dashboard ws） | legacy compat |

---

## 输出治理链路图

```text
role result / decision
  -> team-runtime finalize
  -> output-gate classifyOutputMode
      -> aggregated
      -> user_visible
      -> suppressed
  -> output-command-bridge
  -> team-output-sender
      -> dashboard websocket canonical lane
      -> legacy compat investigation surfaces（non-mainline）
  -> authoritative receipt 回写
  -> governance mailbox / batch snapshot / recent events
```

### 当前输出边界

- **正式 Team visible output 只认**：dashboard websocket canonical lane
- **`/internal/debate/kick` 已从当前 runtime 移除；仅保留为历史兼容语义，不再是活入口**
- `createTeamOutputSender()` 当前支持按节点路由：默认 node-a，也可显式指定 node-b / node-c 的 bridge RPC
- 三节点异步 ingress 规范入口为 `POST /internal/team/ingress`；`/webhook/qq` 仅保留兼容表面

---

## 运行时默认任务元数据

从 `src/team/team-runtime.mjs` 当前默认值可见，普通生产任务创建时会自动写入：

- `authoritativeNode = node-a`
- `outputAuthority = node-a`
- `plannerNode = node-b`
- `criticNode = node-c`
- `executorNode = node-b`
- `judgeNode = node-a`
- `dispatchPolicy.singleFlight = true`
- `visibilityPolicy.userVisible = isQqGroupTask`

这意味着：

- **治理与最终权威永远收口到 node-a**
- **执行位与审查位默认外放到子节点**
- **单飞（single-flight）默认开启**，避免同 scope 重复起跑

---

## 稳定查询面图

```text
/state/team
/state/team/summary
/state/team/workbench
/state/team/governance
/state/team/pipeline
/state/team/board
/state/team/dashboard
/state/team/queue
/state/team/archive
/state/team/contracts
```

统一 contract：`team.governance.query.v1`

统一 envelope 结构：

- `api`
- `resource`
- `query`
- `links`

---

## 仓库边界

### 正式入口

- `README.md`
- `ARCHITECTURE.md`
- `config/system.manifest.json`

### 正式核心代码

- `src/team/`
- `src/routes/`
- `src/index.mjs`
- `src/index-bootstrap.mjs`

### 正式稳定脚本入口

- `scripts/smoke/`
- `scripts/acceptance/`
- `scripts/ops/`

### 历史／兼容区域

- `_trash/20260327-p11-debate-runtime-full-retire/`
- `scripts/debate/`
- `scripts/governance/`
- `docs/archive/team-runtime/`
- `_ops/orchestrator/team-runtime/`

---

## 当前架构判断

### 已稳定的部分

- Team Runtime 主叙事已收口。
- 角色配置与节点映射已配置化。
- 输出治理已经和 Team Runtime 主链对齐。
- `/internal/team/output` 在本文历史阶段中曾被视为正式输出通道。
- 查询面 contract 已稳定化。

### 仍带历史兼容味道的部分

- `BRIDGE_KICK_URL_LAODA / VIOLET / LEBANG` 属于历史 legacy compat 记录；当前运行时已不再默认注入 debate kick 发送侧。
- `NAPCAT_HTTP` 仍可在 legacy / debate compat 侧看到，但**已不再是 Team mainline 的正式输出依赖**。
- lebang `19103/19104` 仍作为 compat-only 保留。
- 仓库中仍有部分 archive / helper / old acceptance 脚本引用旧语义。

### 推荐后续收口方向

- 明确把 `19103 / 19104` 标成“仅兼容，非主链”。
- 继续把可见输出调查与审计统一到 `/internal/team/output`。
- executor live acceptance 补齐后，再评估是否进一步清理旧 kick 兼容链。

---

## 本文依据的关键文件

- `README.md`
- `docs/architecture/current-team-runtime-architecture.md`
- `config/team/roles.json`
- `config/team/network-ports.json`
- `docs/ops/napcat-bridge-boundaries.md`
- `src/index-bootstrap.mjs`
- `src/team/team-runtime.mjs`
- `src/team/team-agent-output-sender.mjs`

---

## 一句话结论

- **现在的 AI Team 项目已经不是“多 Bot 辩论器”，而是“以 node-a 为 authority、node-b 为 planner/executor、node-c 为 critic、并以 canonical visible-output lane 为主”的 Team Runtime 三节点编排系统。**
��统。**
Team Runtime 三节点编排系统。**
�**
Team Runtime 三节点编排系统。**
