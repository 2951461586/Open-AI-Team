# Legacy Delete Candidates（2026-03-26）

> 目的：在 **不直接删除** 的前提下，给出一版可执行的 delete-ready 候选清单，用于后续 staged retirement。
>
> 本文只覆盖 **仓库内现状**。不覆盖：外部 CI、shell history、tmux buffer、运维笔记、聊天记录里的历史命令片段。

---

## 1．当前总判断

当前仓库里的 legacy 清理对象，已经分成两类现实：

1. **旧 acceptance 根目录 shim**：实际上已经不在工作树里了，只剩 dry-run 记录文档。
2. **仍留在工作树里的 legacy 文件**：主要是三类：
   - `retired_*` / `renamed_*` fail-fast 壳文件
   - `*.bak.*` 迁移快照 / 清理快照
   - 少量历史说明文档

因此，下一阶段“真实删除”最合适的目标，已经不是上一轮文档里写的那 13 个根目录 shim 本体，而是：

- **A 类：备份快照文件**
- **B 类：已退役的 fail-fast 壳文件**
- **C 类：保留的历史说明文档（暂不删）**

---

## 2．已确认：13 个 acceptance root shim 现已不在工作树

### 实际扫描结果

`scripts/acceptance/` 根目录当前仅有：

- `scripts/acceptance/README.md`
- `scripts/acceptance/SHIM-RETIRE-DRYRUN.md`

这意味着此前 dry-run 文档里的 13 个旧平级 shim：

- 在**当前工作树中已经不存在**；
- 当前不能把它们再作为“待删文件本体”重复计入；
- 它们现在只剩下**历史记录意义**，体现在 `SHIM-RETIRE-DRYRUN.md` 中。

### 结论

> **第一个 delete-ready 结论不是“删 13 个 shim”，而是“这 13 个 shim 已经删掉了，当前只需决定是否保留它们的 dry-run 记录文档”。**

---

## 3．A 类：几乎可直接删除（仓内低风险）

以下文件主要是本轮收口过程中留下的 `*.bak.*` 快照，功能上不参与当前主链。

### A1．配置 / 文档 / 脚本快照

- `config/team/network-ports.json.bak.20260326-151245`
- `config/team/network-ports.json.bak.cleanup-20260326-171020`
- `config/team/roles.json.bak.20260326-151245`
- `config/team/roles.json.bak.cleanup-20260326-171020`
- `config/team-roles.json.bak.cleanup-20260326-171020`
- `docs/architecture/ai-team-runtime-architecture-deployment-map-2026-03-13.md.bak.cleanup-20260326-171020`
- `docs/architecture/current-team-runtime-architecture.md.bak.cleanup-20260326-171020`
- `docs/architecture/team-node-deployment-optimized.md.bak.cleanup-20260326-171020`
- `docs/ops/napcat-bridge-boundaries.md.bak.cleanup-20260326-171020`
- `scripts/ops/team-port-config-audit.mjs.bak.cleanup-20260326-171020`
- `scripts/ops/show-lebang-rerouted-audit.sh.bak.remote-cleanup-20260326-171812`
- `scripts/ops/team-output-investigate.py.bak.remote-cleanup-20260326-171812`
- `scripts/acceptance/canonical/team-critic-lebang-live.mjs.bak.remote-cleanup-20260326-171812`
- `scripts/acceptance/canonical/team-output-lebang-tunnel-live.mjs.bak.remote-cleanup-20260326-171812`
- `scripts/acceptance/canonical/team-output-violet-tunnel-live.mjs.bak.remote-cleanup-20260326-171812`
- `scripts/acceptance/canonical/team-planner-violet-live.mjs.bak.remote-cleanup-20260326-171812`
- `scripts/acceptance/canonical/team-three-node-live.mjs.bak.remote-cleanup-20260326-171812`
- `scripts/team/team-output-violet-tunnel-authoritative-acceptance.mjs.bak.remote-cleanup-20260326-171812`

### 风险判断

- **仓内风险：低**
- **当前主链影响：无**
- **主要价值：人工回看 diff / 事故现场对照**

### 建议

如果目标是让工作树更干净，这一组是最适合第一批删除的对象。

---

## 4．B 类：可删，但建议分两刀做

这类文件已经不承载主链能力，只承担：

- fail-fast 提示
- 迁移说明
- 防误跑护栏

### B1．retired tunnel 壳文件

- `scripts/acceptance/canonical/team-output-violet-tunnel-live.mjs`
- `scripts/acceptance/canonical/team-output-lebang-tunnel-live.mjs`
- `scripts/team/team-output-violet-tunnel-authoritative-acceptance.mjs`

### 当前实际形态

这些文件当前都是：

- 顶部直接 `throw new Error(...)`
- 报错类型分别为：
  - `retired_acceptance`
  - `retired_smoke`

但文件后面仍保留了旧正文，意味着它们在运行时已 fail-fast，**在维护层面仍带历史正文噪音**。

### 删除判断

- **仓内功能风险：低**
- **误用防护收益：中**
- **删除后的代价：失去“误跑即提示替代入口”的即时引导**

### 建议

先保留一小段时间作为护栏；若下一轮决定“从护栏阶段进入真实删除阶段”，这组可以整批删除。

---

### B2．renamed visible-output shim 壳文件

- `scripts/team/team-visible-output-bridge-rpc-smoke.mjs`
- `scripts/team/team-visible-output-bridge-rpc-acceptance-smoke.mjs`
- `scripts/team/team-visible-output-explicit-delivery-smoke.mjs`

### 当前实际形态

这些文件当前都是单行 fail-fast：

- `renamed_script: ... has been renamed to ...`

它们已经不包含主逻辑，只做迁移提示。

### 删除判断

- **仓内功能风险：低**
- **仓外命令兼容风险：中**
- **当前保留价值：给历史命令一个明确重定向提示**

### 建议

这组三个文件适合作为 **B 组第二刀**：

1. 先删 `*.bak.*`
2. 观察一小段时间
3. 再删 renamed / retired 壳

---

## 5．C 类：当前不建议删

### C1．历史说明文档

- `scripts/acceptance/SHIM-RETIRE-DRYRUN.md`
- `docs/ops/visible-output-canonical-migration-2026-03-26.md`
- `docs/ops/compat-retirement-inventory-2026-03-24.md`
- `docs/architecture/ai-team-runtime-architecture-deployment-map-2026-03-13.md`

### 原因

这些文件虽然包含历史路径、退役对象、或旧结论，但它们当前已经被：

- 强覆盖提醒
- 历史快照说明
- canonical migration 文档

重新框住语义。

它们现在的价值主要是：

- 防止以后忘记为什么退役
- 给后续真实删除提供依据
- 保留迁移轨迹与排障上下文

### 结论

> **这组现在更像“治理记录”，不是“垃圾文件”。**

---

## 6．delete-ready 执行顺序建议

### 第 1 刀：只删 `*.bak.*`

目标：

- 降噪
- 不动护栏
- 不动迁移说明

### 第 2 刀：删 fail-fast retired / renamed 壳

前提：

- 团队已接受“旧命令不再给迁移提示，直接文件不存在也可以”
- 或已有统一迁移文档 / README 指南足够承接

### 第 2.5 刀：主工作路径收口到 `retired/`

对于暂不想直接物理删除、但又不希望继续挂在主工作路径里的 legacy 脚本，可先移入仓内 `retired/` 目录，达到：

- 默认入口不再可见
- 仍保留可回退路径
- 文档可明确说明其已退出主工作路径

### 第 3 刀：再评估是否保留 dry-run 记录文档

只在以下情况才考虑：

- 迁移背景已经充分沉淀到其他文档
- 团队不再需要 staged retirement 现场记录

---

## 7．当前最实用的 delete-ready 清单

### 第一批（推荐现在就可删）

即所有 `*.bak.*` 快照文件，见 **A 类**。

### 第二批（原计划，现已执行完成）

以下 6 个壳文件已于 2026-03-26 晚执行真实删除（历史删除记录，非当前工作路径入口）：

- `scripts/acceptance/canonical/team-output-violet-tunnel-live.mjs`
- `scripts/acceptance/canonical/team-output-lebang-tunnel-live.mjs`
- `scripts/team/team-output-violet-tunnel-authoritative-acceptance.mjs`
- `scripts/team/team-visible-output-bridge-rpc-smoke.mjs`
- `scripts/team/team-visible-output-bridge-rpc-acceptance-smoke.mjs`
- `scripts/team/team-visible-output-explicit-delivery-smoke.mjs`

### 暂不删

- `scripts/acceptance/SHIM-RETIRE-DRYRUN.md`
- 各类历史迁移 / 口径文档

---

## 8．一句话结论

**下一步真正适合动刀的，不是“再删一遍已经不存在的 acceptance root shim”，而是：先删 `*.bak.*` 快照，再视需要删 retired / renamed 壳文件。**
**
ke.mjs`
- `scripts/team/team-visible-output-explicit-delivery-smoke.mjs`

### 暂不删

- `scripts/acceptance/SHIM-RETIRE-DRYRUN.md`
- 各类历史迁移 / 口径文档

---

## 8．一句话结论

**下一步真正适合动刀的，不是“再删一遍已经不存在的 acceptance root shim”，而是：先删 `*.bak.*` 快照，再视需要删 retired / renamed 壳文件。**
**
