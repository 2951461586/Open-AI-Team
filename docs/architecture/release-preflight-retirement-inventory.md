# Release Preflight／体量与退役清单（2026-04-02）

> 用于正式版前最后一轮收口：统一回答 **项目到底多大**、**哪些仍是现役主链**、**哪些是僵尸／compat／待退役面**、以及 **还有哪些 OpenClaw 深耦合残留**。

---

## 1．现役源码体量（排除运行产物口径）

> 已排除：`.runs/`、`.shared/`、运行报告、构建产物、缓存目录、`node_modules/`。

| 区域 | 文件数 | 行数 | 说明 |
|---|---:|---:|---|
| `orchestrator/src` | 107 | 21,349 | 现役运行时与 control plane 主链 |
| `orchestrator/scripts` | 86 | 9,642 | smoke / acceptance / ops / guardrail |
| `orchestrator/docs` | 45 | 5,658 | 当前主文档面 |
| `orchestrator/examples` | 26 | 5,560 | 仅 facade / regression sample |
| `dashboard/src` | 35 | 9,998 | 前端主产品面 |
| **active-code（`src + scripts + dashboard/src`）** | **212** | **39,913** | **最接近“真实活跃代码规模”** |
| **readable-surface（`src + scripts + docs + examples + dashboard/src`）** | **299** | **52,207** | 对外阅读 / 审查口径 |

## 2．为什么之前会看到“两百多万行”

因为 `orchestrator/examples/` 下包含了大量历史 run 产物／样例输出／报告快照。

这类数据在“目录总行数”里会把仓库放大到 **2,310,835 行**，但那不是现役源码体量。

**正式版前对外口径应固定为：**

- **活跃代码规模**：约 **3.99 万行**
- **可读工作树规模**（含 docs / examples facade）：约 **5.22 万行**
- **不要**再用含 `.runs/` / report 的两百万级数字描述项目大小

---

## 3．现役 authority

| 层 | 当前 authority | 说明 |
|---|---|---|
| Team Runtime | `src/team/team-tl-runtime.mjs` | 唯一对话／编排 authority |
| Team core contracts | `src/team-core/` | 平台无关语义与合同 |
| Runtime adapters | `src/team-runtime-adapters/` | control-plane / runtime adapter 接线层 |
| Standalone harness baseline | `src/agent-harness-core/` | standalone broker substrate canonical baseline |
| Sample facade | `examples/oss-minimal/` | wrapper / regression facade / runnable sample |
| Query / state surface | `src/routes/team-state/*` | dashboard / ops / read model 主查询面 |
| Frontend/UAT | `dashboard/src/*` | 现役产品前端 |

---

## 4．可直接判定为“非主链”的残留面

| 类别 | 路径 / 对象 | 当前结论 | 处理建议 |
|---|---|---|---|
| Deleted compat surface | `src/team-runtime-adapters/openclaw.mjs` | **已物理删除** | 不再保留 OpenClaw re-export shell |
| Deleted compat surface | `src/team-runtime-adapters/openclaw-gateway.mjs` | **已物理删除** | 不再保留 OpenClaw gateway shell |
| Deleted legacy shell | `src/team/team-agent-harness.mjs` | **已物理删除** | 不再保留 compat harness 壳 |
| Deleted legacy shell | `src/team/team-multi-node-gateway.mjs` | **已物理删除** | 不再保留 compat gateway 壳 |
| Deleted runtime shim | `src/team/team-runtime.mjs` | **已物理删除** | 主链已完全切到 TL runtime |
| Legacy ingress semantic | `/webhook/qq`、`qq:*`、`napcat_http` | **兼容残留** | 不再作为任何新能力主入口 |
| Historical plan doc | `docs/architecture/tl-refactor-v1.md` | **历史快照** | 不再作为主入口阅读文档 |

---

## 5．仍未完全退役的 OpenClaw 深耦合

### 5.1 已执行物理删除

| 对象 | 当前状态 | 结果 |
|---|---|---|
| `src/team-runtime-adapters/openclaw.mjs` | compat re-export shell | **已删除** |
| `src/team-runtime-adapters/openclaw-gateway.mjs` | compat re-export shell | **已删除** |
| `src/team/team-agent-harness.mjs` | compat harness shell | **已删除** |
| `src/team/team-multi-node-gateway.mjs` | compat gateway shell | **已删除** |
| `src/team/team-runtime.mjs` | retired pipeline shim | **已删除** |
| `scripts/smoke/team-output-boundary-revise.mjs` | 旧 pipeline 守门 | **已删除** |
| `scripts/smoke/team-critic-openai-compatible.mjs` | 旧 pipeline smoke | **已删除** |
| `scripts/smoke/team-judge-openai-compatible.mjs` | 旧 pipeline smoke | **已删除** |
| `scripts/smoke/team-executor-openai-compatible.mjs` | 旧 pipeline smoke | **已删除** |
| `scripts/team/team-output-authoritative-live-acceptance.mjs` | 旧 output authority acceptance | **已删除** |

### 5.2 真正还值得继续追的残留点

| 对象 | 残留原因 | 下一刀建议 |
|---|---|---|
| `execution-harness.mjs` 的 `send / list / history` 会话能力面 | 仍然默认围绕 session substrate contract 展开 | 继续抽象成更清晰的 host/session capability contract，而不是围绕历史 OpenClaw 心智描述 |
| `scopeKey = qq:*`、`qq_group_id / group_id` | 历史 ingress / delivery 夹具残留 | 下一轮统一切到 platform-neutral fixture / recipient contract |
| `channel = qqbot` 默认值 | 历史生产环境心智残留 | 下一轮改成更中立默认枚举或显式 required |
| acceptance / smoke 中的 QQ 样例 envelope | 夹具未彻底平台化 | 下一轮整体替换为 neutral ingress fixtures |

---

## 6．这轮可以直接退役什么

### 已建议立即从“主入口文档面”退役

- `docs/architecture/tl-refactor-v1.md` → **历史快照，不再作为现役入口**
- 旧 `OpenClaw-first`、`gateway-first` 叙事 → **不再写进 README / docs index / baseline docs**
- 用含 `.runs/` 的 200 万级数字描述项目体量 → **退役**

### 本轮已完成物理清退

- `src/team-runtime-adapters/openclaw.mjs`
- `src/team-runtime-adapters/openclaw-gateway.mjs`
- `src/team/team-agent-harness.mjs`
- `src/team/team-multi-node-gateway.mjs`
- `src/team/team-runtime.mjs`
- `scripts/smoke/team-output-boundary-revise.mjs`
- `scripts/smoke/team-critic-openai-compatible.mjs`
- `scripts/smoke/team-judge-openai-compatible.mjs`
- `scripts/smoke/team-executor-openai-compatible.mjs`
- `scripts/team/team-output-authoritative-live-acceptance.mjs`

当前边界验证已改写为 **删除后边界守门**，不再依赖保壳。

---

## 7．正式版前建议固定口径

```text
主产品 = AI Team Runtime + Dashboard + Team Query API
独立 baseline = src/agent-harness-core/
样板 facade = examples/oss-minimal/
compat 残留 = 历史文档叙事与少量 archive 记录；主工作树 compat 壳已物理清退
```

一句话：

**这轮之后，仓库已经足够明确地区分“正式主链”“facade 样板”“compat 壳”“历史快照”，可以进入正式版前最后一轮对外收口。**
