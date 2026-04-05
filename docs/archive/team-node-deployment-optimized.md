# Team Node Deployment（Optimized Baseline）

> **历史快照说明**：本文保留旧阶段拓扑 / SSH alias 设计作为演进记录，**不是当前生产口径**。当前请以 `docs/architecture/current-team-runtime-architecture.md`、`config/team/roles.json`、`config/team/network-ports.json`、`config/team/network-ports.compat.json` 为准。


## 三节点角色与通信图

```text
                           ┌─────────────────────────────────────┐
                           │ node-a                             │
                           │ authority / orchestrator / output  │
                           │ public: <authority-host>           │
                           │ orchestrator :19090                │
                           │ bridge+output :19100               │
                           └───────────────┬─────────────────────┘
                                           │
                     planner/executor kick │ 127.0.0.1:19102
                                           │ (ssh alias -> node-b:19100)
                                           ▼
                           ┌─────────────────────────────────────┐
                           │ node-b                             │
                           │ formal planner / executor node     │
                           │ public: <worker-b-host>            │
                           │ bridge kick :19100                 │
                           └─────────────────────────────────────┘

                                           ▲
          critic sessions_spawn            │ webhook / receipt tunnel
          direct gateway                   │ 127.0.0.1:19092 -> node-a:19090
          127.0.0.1:18789                  │
                                           │
                           ┌─────────────────────────────────────┐
                           │ node-c                             │
                           │ formal critic true-agent node      │
                           │ public: <review-c-host>            │
                           │ gateway :18789                     │
                           │ legacy critic bridge :19103        │
                           └─────────────────────────────────────┘

Legacy compat on node-a:
- 127.0.0.1:19104 -> node-c:19103   （compat_only / retire_candidate）
```

## 角色分配

| 角色 | 首选节点 | 执行方式 | 当前状态 |
|---|---|---|---|
| planner | node-a | local_authority | 正式 |
| executor | node-a | local_authority | 正式 |
| critic | node-c | sessions_spawn | 正式 |
| judge | node-a | local authority | 正式 |
| output | node-a | bridge rpc / local delivery | 正式 |

## 优化后的配置原则

- `config/team/network-ports.json` 作为三节点端口真源。
- `config/team/roles.json` 负责角色到节点的正式部署关系。
- `.env` 只保留本机实际运行所需 URL / token / bind，不再承担全局端口文档职责。
- `19103 / 19104` 明确视为 legacy compat，不再作为 critic 主链说明口径。
- visible delivery 验收与 authoritative receipt 验收分离，避免“验收通过但群里没看到消息”的歧义。
