# team-core

## 目标

`team-core/` 承载 **平台无关、宿主无关** 的 AI Team 核心语义层。

这里应该只放：

- 纯数据合同
- 纯规范化逻辑
- 纯决策解析逻辑
- 纯查询契约
- 纯执行安全合同
- 不依赖具体宿主平台的 session / control-plane / workspace / systemd helper

不应该放：

- spawn / send / history / completion bus
- node / control-plane reachability
- dashboard token / service env fallback
- task store 持久化实现
- channel / delivery 宿主能力

---

## 当前模块

| 文件 | 职责 |
|---|---|
| `common.mjs` | parse / ensure / risk normalize / fallback policy |
| `role-capability-contracts.mjs` | 角色能力合同、execution surface 合同、校验逻辑 |
| `work-item.mjs` | workItem 规范化与 timeout 策略 |
| `decision.mjs` | TL decision 解析 |
| `query-contract.mjs` | Team query API 稳定信封与路由契约 |
| `execution-safety-contracts.mjs` | 搜索留证安全护栏等通用执行安全合同 |

---

## 边界约束

### 可以依赖

- 标准库
- 纯参数注入
- 纯函数
- roleConfig / governanceConfig 这类数据对象

### 不可以依赖

- 宿主私有 sessions / control-plane
- systemd / proc / service env
- 本机固定路径（除非只是字符串模板，不触发宿主 IO）
- teamStore 持久化读写
- dashboard / route runtime

---

## 当前迁移策略

- `src/team/*` 的旧入口先保留 **兼容壳**
- 现役 runtime / routes / tests 逐步改为直接 import `team-core/*`
- 等现网与 smoke 全部稳定后，再决定是否继续把旧壳退成 archive/compat
