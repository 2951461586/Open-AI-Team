# QQ Multi-Agent Orchestrator

> 面向 QQ 多 Bot（历史节点别名，现建议统一理解为 canonical node IDs）辩论协作场景的状态机编排器。
>
> 当前稳定口径：**Orchestrator 负责会话事实、命令账本、turn 推进、finalize/stop 收敛与 kick 路由；Bridge / Relay 负责执行、投递、输出清洗、command receipt 回报与竞态止血。**

---

## 1．职责边界

### Orchestrator 负责

- 接收入站事件（`POST /webhook/qq`）
- 基于 bot 身份、@ 提及、会话状态做**确定性路由决策**
- 管理辩论会话状态机：`RUNNING / FINALIZE_PENDING / FINALIZED / STOPPED`
- 维护 SQLite 审计账本：
  - `debates`
  - `debate_events`
  - `debate_commands`
  - `debate_projection`
  - `debate_turn_outputs`
- 根据 `command receipt(delivered)` 推进下一轮或进入 finalize
- 暴露健康检查与状态查询：`/health`、`/state/recent`、`/state/debate`

### Orchestrator 不负责

- 不直接执行 Agent 推理
- 不负责 QQ API 投递
- 不负责输出清洗、硬闸门、stale 输出止血
- 不负责跨节点消息队列

> 例外：在 kick RPC 不可达等故障场景下，Orchestrator 可通过 `NAPCAT_HTTP` 发送极简兜底提示，属于**降级补救**，不是主链职责。

### Bridge / Relay 负责

- 接收 Orchestrator kick / command
- 调用本机 OpenClaw Gateway → Agent
- 执行 QQ 投递
- 输出清洗 / 元信息剥离 / 硬闸门
- 竞态止血：stop latch / inflight cancel / stale 丢弃 / superseded
- 回报命令生命周期：`started / completed / delivered / failed / retry / superseded`

---

## 2．运行主链

### 2.1 单聊 / 普通路由

```text
QQ / NapCat / Bridge 入站
  → POST /webhook/qq
  → Orchestrator 做 deterministic routing decision
  → Bridge 执行
```

### 2.2 辩论模式主链

```text
QQ 群消息
  → NapCat / Bridge 入站
  → POST /webhook/qq
  → Orchestrator 决策：本轮该谁说
  → Orchestrator 发 kick / command 给目标 Bridge
  → Bridge 执行 Agent 并投递 QQ
  → Bridge 回报 /internal/commands/receipt
  → Orchestrator 按 commandId 更新 projection
  → delivered 后推进 turn 或 finalize
```

### 2.3 Finalize 主链

```text
最后一轮 delivered
  → Orchestrator 写入 finalize.requested
  → projection = FINALIZE_PENDING
  → sendFinalizeKick()
  → Bridge 执行最终总结
  → receipt(delivered)
  → projection = FINALIZED
```

---

## 3．状态机摘要

### Debate projection（高层口径）

- `RUNNING`：正常回合推进中
- `FINALIZE_PENDING`：已达到总结条件，等待总结命令被 Bridge 消费并投递
- `FINALIZED`：总结已送达，辩论闭环完成
- `STOPPED`：人工停止或异常止血后的终止状态

### 关键推进原则

- **权威推进链**：优先认 `command receipt(delivered)`
- **ACK 降权**：旧 `/internal/debate/sent` 仅作 fallback compatibility
- **投影收敛**：任何推进都应最终落到 `debate_projection`
- **幂等推进**：同一轮不能因多源观察重复推进

---

## 4．当前已钉死的三个关键闭环

### 4.1 Finalize 闭环

目标：避免达到 `maxTurns` 后只写入 `FINALIZE_PENDING`，但总结永远不派发。

当前口径：

- `applyCommandReceipt()` 在最后一轮 delivered 后：
  - 先写 `finalize.requested`
  - 再 `sendFinalizeKick()`
  - 最后清理 in-memory active session

结果：总结命令不再挂死在 pending。

### 4.2 Next-turn 收口闭环

目标：避免 debate 在 RUNNING 期出现双推进链，导致缺轮、乱序、尾刺或 finalize 悬空。

当前口径：

- RUNNING 期间 bot-origin observe **只做 telemetry**
- 不再允许通过 observe 触发 self-reply fallback
- 下一轮推进只认：`kick → receipt(started/completed/delivered) → projection`

结果：owner 侧不再因 bot-observe 抢跑，避免与 kick 主链形成竞态。

### 4.3 SQLite WAL 收敛闭环

目标：避免 `debates.db-wal` 持续膨胀。

当前口径：

- `debates-store.mjs` 提供 `checkpoint(mode)`
- `index.mjs` 周期触发 `maybeCheckpointDebateDb()`
- `/health` 暴露 checkpoint 配置与最近执行时间

默认策略：

- `DEBATE_DB_CHECKPOINT_MODE=PASSIVE`
- `DEBATE_DB_CHECKPOINT_MS=300000`

---

## 5．目录分层（收口后的理解）

### 运行资产

- `src/index.mjs`：主入口 / 路由 / 状态机 / health
- `src/debates-store.mjs`：SQLite 持久化与 projection 审计
- `src/supervisor.mjs`：监督策略装载与偏题判定
- `policy/debate-policy.json`：监督策略配置
- `.env` / `.env.example`：运行配置
- `state/`：运行态数据库与 recent 输出

### 非运行资产

- `_trash/`：历史备份 / 归档补丁 / 已隔离排障残留
- `README.md`：架构与运维口径，不参与运行
- `package.json`：最小启动包装

> 排障原则：**先看 `src/` + `.env` + `state/`，不要先被 `_trash/` 干扰。**

---

## 6．配置项（当前关键项）

- `PORT`：监听端口，默认 `19090`
- `COOLDOWN_MS`：消息去重冷却窗口
- `MAX_RECENT`：recent 保留上限
- `DEBATE_MAX_TURNS`：最大回合数
- `DEBATE_IDLE_TIMEOUT_MS`：回合等待超时
- `DEBATE_MAX_TIMEOUTS`：允许连续超时次数
- `DEBATE_OFFTOPIC_BLOCK_STREAK`：偏题累计阈值
- `DEBATE_DB_PATH`：SQLite 路径
- `DEBATE_DB_CHECKPOINT_MS`：WAL checkpoint 间隔
- `DEBATE_DB_CHECKPOINT_MODE`：默认 `PASSIVE`
- `NAPCAT_HTTP`：kick 失败时兜底发群提示的 HTTP 入口
- `BRIDGE_KICK_URL_LAODA / BRIDGE_KICK_URL_VIOLET`：双侧 Bridge kick RPC 地址
- `ORCH_KICK_TOKEN`：Bridge kick 鉴权 token

---

## 7．接口

### `GET /health`

返回：

- 服务状态
- debate 配置摘要
- DB 路径与 persistedCount
- 审计统计信息
- checkpoint 配置与最近执行时间

### `POST /webhook/qq`

用途：

- 接收 Bridge / NapCat 转来的 QQ 事件
- 产出 deterministic routing decision

### `GET /state/recent`

用途：

- 查看最近决策记录
- 支持按 `mode=debate` 过滤

### `GET /state/debate`

用途：

- 查看当前内存态辩论会话与 DB 统计

---

## 8．运行与验证

### 启动

```bash
cd /root/.openclaw/workspace/orchestrator
node src/index.mjs
```

### 推荐运维口径（现网）

```bash
systemctl --user status orchestrator.service
systemctl --user restart orchestrator.service
journalctl --user -u orchestrator.service -n 50 --no-pager
curl -sS http://127.0.0.1:19090/health
```

---

## 9．当前最重要的排障视角

排查辩论异常时，优先按这条链看：

```text
webhook 入站
  → decision
  → kick / command 发出
  → Bridge 执行
  → receipt 回来没有
  → projection 是否推进
  → finalize 是否收敛
```

若出现“第三轮卡住、总结不出、总结后尾刺、WAL 膨胀”，分别优先检查：

- nextBot / fallback 是否命中
- `FINALIZE_PENDING` 后是否真的 `sendFinalizeKick()`
- Bridge 是否正确回报 `superseded / delivered`
- `/health` 里的 checkpoint 状态是否正常

---

## 10．state 目录保留策略

`orchestrator/state/` 是**运行态目录**，不是普通缓存目录。默认只做“轻瘦身”，不要做破坏性清理。

### 应长期保留

- `debates.db`：主数据库
- `debates.db-wal`：SQLite WAL 文件（运行态文件，不要手工删除）
- `debates.db-shm`：SQLite SHM 文件（运行态文件，不要手工删除）
- `recent.json`：最近决策快照
- `orchestrator.out`：极小输出占位文件，可保留

### 可归档但不要直接删

- `recent.json.bak.*`：历史 recent 备份
- 其他带时间戳的 `*.bak.*` / 手工导出快照

推荐做法：统一移动到 `_trash/<timestamp>/orchestrator-state/`，而不是直接删除。

### 不建议直接做的动作

- 运行中手工删除 `debates.db-wal` 或 `debates.db-shm`
- 因为看到 WAL 变大就直接 `VACUUM`
- 清空整个 `state/` 目录

### 正确处理原则

- **历史备份归档**：直接移到 `_trash/`
- **WAL 膨胀先观测**：优先看 `/health` 中 checkpoint 状态
- **需要收敛 WAL 时**：优先使用受控 checkpoint，而不是删文件
- **排障优先级**：先看 command / projection / receipt 是否收敛，再看 DB 体积

## 11．架构图入口

- 正式图源码：`_ops/orchestrator-architecture-v1.md`
- 画图底稿：`_ops/orchestrator-architecture-draft-2026-03-06.md`
- 最终收口清单：`_ops/orchestrator-final-closure-checklist-2026-03-06.md`

建议使用顺序：

- 先看 **图 A：运行时组件图**
- 再看 **图 B：辩论推进时序图**
- 若要补状态流，再加 **图 C：Projection 状态流转**
- 若要判断还能不能继续瘦，再看 **最终收口清单**

## 11．一句话总结

**Orchestrator 现在已经不是“谁该回复一下”的简易路由器，而是辩论模式下的状态机内核。**

它的核心价值不是“会发消息”，而是：

- 把命令和事实记清楚；
- 把 turn 推进收敛起来；
- 把 finalize/stop 做成不会挂死的闭环；
- 把 Bridge 执行结果纳入可审计账本。
