# 配置权威关系与兼容边界

## 目标

这份文档用于明确 orchestrator 仓库当前的**配置权威入口**、**兼容回退入口**与**历史归档入口**，避免再次出现“文档、manifest、runtime 默认读取路径不一致”的配置漂移。

---

## 单一权威结论

当前 Team Runtime 配置采用以下单一权威口径：

- **顶层权威入口**：`config/system.manifest.json`
- **Team 角色权威配置**：`config/team/roles.json`
- **Team 治理权威配置**：`config/team/governance.json`
- **运行时主入口**：`src/index.mjs`

其中：

- `config/system.manifest.json` 负责声明当前 primary product、主配置入口与脚本入口。
- `config/team/roles.json` 是 Team Runtime 的**唯一正式角色/节点部署配置入口**。
- 运行时代码默认应优先读取 `config/team/roles.json`。

---

## 兼容回退入口

以下入口仍允许保留，但必须视为**兼容回退**，不是新的修改入口：

- `config/team-roles.json`

当前约束：

- 本文件仅用于旧逻辑/旧环境兼容。
- 任何新的角色、节点、部署关系修改，应只改 `config/team/roles.json`。
- 若 runtime 仍保留对 `config/team-roles.json` 的 fallback，只能作为容灾兼容，不得反向成为权威来源。

---

## 历史归档入口

以下内容属于历史阶段资料，不能作为当前运行口径：

- `docs/archive/`
- `_ops/orchestrator/`
- `memory/` 中历史记录

使用原则：

- **可参考演进背景**
- **不可覆盖当前权威口径**
- 若与 `config/system.manifest.json` / `config/team/roles.json` 冲突，以当前权威入口为准

---

## 修改入口规则

### 改角色部署时

只改：

- `config/team/roles.json`

不要改：

- `config/team-roles.json`（legacy compat only）
- 历史 archive 文档里的示例片段

### 判断“现在到底以什么为准”时

按以下顺序判断：

1. `config/system.manifest.json`
2. `ARCHITECTURE.md`
3. `docs/index.md`
4. `config/team/roles.json`
5. `src/team/*.mjs` 的当前运行实现

---

## 当前稳态目标

仓库应长期保持以下稳态：

- **一个权威配置入口**：`config/team/roles.json`
- **一个 manifest 总入口**：`config/system.manifest.json`
- **旧配置文件仅作 compat fallback**
- **archive / memory 仅保留历史，不参与现行权威判断**

---

## 维护建议

- 若将来彻底移除 legacy fallback，应同步更新：
  - `src/team/team-roles-config.mjs`
  - `README.md`
  - `ARCHITECTURE.md`
  - `docs/index.md`
  - 本文档
- 若新增 Team 配置文件，应先在 `config/system.manifest.json` 中挂接，再补文档入口，避免再次出现双权威。
