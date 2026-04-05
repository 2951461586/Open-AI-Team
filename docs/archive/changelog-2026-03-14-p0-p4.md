# Changelog — 2026-03-14 P0-P4 Implementation

> **强覆盖提醒（2026-03-26）**：本文是 2026-03-14 当时的变更记录，允许保留当时的环境变量、端口、与输出链路口径。若你当前要判断 visible output 主链，请不要直接从本文里的 `TEAM_OUTPUT_BRIDGE_RPC_URL` 或 `19100 /internal/team/output` 推出现网结论；当前权威口径请优先看：`docs/ops/visible-output-canonical-migration-2026-03-26.md`。

## P0：配置统一与运行时标识更新

### 变更文件
- `src/index-env.mjs`：新增 `LEBANG_GATEWAY_BASE_URL` 环境变量导出
- `src/index-bootstrap.mjs`：`createGatewaySpawnSession` 基地址改为从 `config.LEBANG_GATEWAY_BASE_URL` 读取
- `src/index.mjs`：启动日志 `mode=single+debate-v1-optimal` → `mode=team-runtime-v1`
- `src/routes/index-routes-health-state.mjs`：`/health` 端点 `mode` 字段同步更新为 `team-runtime-v1`
- `~/.config/systemd/user/orchestrator.service.d/30-lebang.conf`：端口从 `18790` 统一为 `18789`

### 验证命令
```bash
curl -sS http://127.0.0.1:19090/health | jq '.mode, .team.judge'
# 预期输出: "team-runtime-v1" 和 judge 配置
```

---

## P1：补齐缺失的 Helper 函数

### 变更文件
- `src/team/team-agent-common.mjs`：新增四个方法
  - `appendGovernanceMailbox`：追加治理消息到 mailbox
  - `advanceTaskPhase`：更新任务阶段到 blackboard
  - `patchTaskMetadata`：合并更新任务 metadata
  - `deriveMemberKey`：从 role + node 生成稳定 memberKey

### 调用方
- `src/team/team-agent-executor-session-runner.mjs`：使用 `helpers.appendGovernanceMailbox` 和 `helpers.advanceTaskPhase`

---

## P2：memberKey 写入与持久化

### 变更文件
- `src/team/team-store.mjs`：
  - 新增 `updateTaskMetadata` prepared statement
  - 新增 `updateTaskMetadata` 函数实现（merge mode）
  - 导出 `updateTaskMetadata`
- `src/team/team-agent-bridge.mjs`：
  - `insertPlan` 时计算并写入 `memberKey`、`contractVersion`、`outputType`
  - 提交后调用 `teamStore.updateTaskMetadata` 更新 `currentMemberKey` 和 `actualNode`

### 数据库字段（已存在，本次启用）
- `team_plans.member_key`
- `team_plans.contract_version`
- `team_plans.output_type`
- `team_reviews.member_key`
- `team_reviews.contract_version`
- `team_reviews.output_type`
- `team_decisions.member_key`
- `team_decisions.contract_version`
- `team_decisions.output_type`

---

## P3：看板/仪表盘增强

### 已有功能（确认无需改动）
- `/state/team/summary?taskId=...` 已包含：
  - `currentMemberKey`
  - `protocol: { plan, review, decision }`
  - `deliverableReady`
  - `humanInterventionReady`
  - `counters`
- `/state/team/board` 和 `/state/team/dashboard` 已包含完整卡片信息

---

## P4：文档与配置漂移收口

### 新增文档
- `docs/changelog/2026-03-14-p0-p4-implementation.md`（本文件）

### 配置项说明
| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `LEBANG_GATEWAY_BASE_URL` | `http://127.0.0.1:18789` | critic/executor 远程 Gateway 地址 |
| `TEAM_JUDGE_TRUE_EXECUTION` | `0` | 启用 judge 真正执行（`1`=启用） |
| `TEAM_OUTPUT_BRIDGE_RPC_URL` | `http://127.0.0.1:19100/internal/team/output` | 输出桥接 RPC 地址 |

---

## 验证清单

- [x] 服务启动成功，日志显示 `mode=team-runtime-v1`
- [x] `/health` 端点返回 `mode: "team-runtime-v1"`
- [x] `/state/team/config` 端点正常返回配置
- [ ] 端到端测试：创建任务 → planner 提交 plan → 验证 memberKey 写入
- [ ] 端到端测试：critic review → 验证 memberKey 写入
- [ ] 端到端测试：judge decision → 验证 memberKey 写入

---

## 后续 TODO

1. **critic adapter**：补充 memberKey 传递（当前未实现）
2. **judge adapter**：补充 memberKey 传递（当前未实现）
3. **executor session runner**：确认 memberKey 写入逻辑
4. **smoke test**：添加 memberKey 写入验证用例
5. **API 文档**：更新 Team Governance Query API 文档

---

_Generated: 2026-03-14T05:44 UTC_
