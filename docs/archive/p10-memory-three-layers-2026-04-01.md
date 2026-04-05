# P10：Memory 三层分层（2026-04-01）

## 目标

把 AI Team 的 memory 从“混在 prompt / blackboard / artifacts 里的隐式上下文”，收口成**三层明确结构**：

- **L1 即时工作记忆**：当前任务 + 上游依赖结果
- **L2 任务共享记忆**：Blackboard / findings / signals
- **L3 持久证据记忆**：plans / reviews / decisions / artifacts / evidence

要求：

- member prompt 显式看到三层 memory
- runtime 主链继续真实使用，不是只改文案
- state / pipeline / workbench / summary 可见三层 memory
- dashboard Workbench 可视化三层 memory

## 落地结果

### 1. Runtime：三层 memory 已进入 member prompt

`src/team/team-tl-runtime.mjs`

新增能力：

- `buildWorkingMemorySnapshot()` → L1
- `buildDurableMemorySnapshot()` → L3
- `buildThreeLayerMemorySnapshot()` → 统一拼出三层视图
- `buildUpstreamContext()` 现收敛为 **L1 working memory** 入口
- `buildMemberPrompt()` 现直接注入 `## 🧠 三层 Memory 视图`
- `runMemberWithSession()` / `spawnAgentSession()` 已显式接入 `resultsByAssignment`

当前 prompt 语义：

- **L1**：当前任务文本、workItem.context、上游依赖结果摘要 / 问题 / 交付物
- **L2**：任务级 Blackboard 共享条目
- **L3**：plan / review / decision / artifact / evidence 的持久证据面

### 2. Query / State：三层 memory 可查询

`src/routes/index-routes-health-state.mjs`

新增：

- `summarizeTaskMemoryLayers()`

并已把 `memoryLayers` 接到：

- `/state/team/pipeline`
- `/state/team/workbench`
- `/state/team/summary`

统一结构：

```json
{
  "memoryLayers": {
    "layerCount": 3,
    "working": { ... },
    "shared": { ... },
    "durable": { ... }
  }
}
```

字段含义：

- `working.dependencyBoundCount`：有多少 child task 绑定了上游依赖结果
- `shared.entryCount / sectionCount / latest[]`：黑板共享记忆规模与最近条目
- `durable.planPresent / reviewCount / decisionCount / artifactCount / evidenceCount`：持久证据层规模

### 3. Dashboard：Workbench 可视化三层 memory

`dashboard/src/components/panels/WorkbenchPanel.tsx`

新增 **三层 Memory** 面板，直接展示：

- **L1**：子任务数 / 依赖绑定数 / 当前即时记忆预览
- **L2**：黑板条目数 / section 数 / section tags
- **L3**：plan / review / decision / artifacts / evidence 计数

## 验收

新增 smoke：

`scripts/team/team-memory-three-layer-smoke.mjs`

覆盖：

1. member prompt 注入三层 memory 视图
2. pipeline 暴露 `memoryLayers`
3. workbench 暴露 `memoryLayers`
4. summary 暴露 `memoryLayers`
5. L1 dependency binding / L2 blackboard / L3 durable counters 均可见

结果：**22 / 22 通过**

## 回归

通过：

- `team-execution-surface-contract-smoke.mjs`
- `team-followup-fallback-mainline-smoke.mjs`
- `team-session-completion-event-smoke.mjs`
- `team-dag-fail-fast-smoke.mjs`
- dashboard `tsc --noEmit`

## 当前口径

从 P10 起，AI Team 的 memory 不再是“一坨上下文”，而是：

| 层 | 含义 | 典型来源 |
|---|---|---|
| L1 | 即时工作记忆 | 当前任务、上游依赖结果 |
| L2 | 任务共享记忆 | Blackboard、findings、signals |
| L3 | 持久证据记忆 | plans、reviews、decisions、artifacts、evidence |

一句话：**memory 现在已经分成 3 层，并且进入了 runtime / state / dashboard 的真实主链。**
