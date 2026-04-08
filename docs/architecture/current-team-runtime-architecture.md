# Current Team Runtime Architecture

> 最后更新：2026-03-28 UTC。
> 当前权威口径：**TL-first、Dashboard Chat 全量先过 TL、`nativeChat` 只是 LLM 传输层，不再是路由 authority。**

## 1．顶层执行图

```text
Dashboard / HTTP / WS / compat ingress
  -> `src/routes/team-route-dispatch-v2.mjs`
  -> TL Runtime（authority / planning / delegation）
  -> runtimeAdapter + executionAdapter
  -> sessionControlPlane / sessionSubstrate
  -> Member sessions（planner / executor / critic / judge）
  -> mailbox / blackboard / artifacts / evidence
  -> Dashboard websocket / HTTP response
```

### 1.1 最终收口心智图（正式版前）

```text
主产品面
  = `src/team/` + `src/routes/team-state/*` + `dashboard/src/*`

执行底座
  = `src/team-runtime-adapters/*` + `src/agent-harness-core/*`

对外入口
  = `GETTING-STARTED.md` + `README.md` + `dashboard/README.md`

样板 / 回归面
  = `examples/oss-minimal/*` + `examples/third-party-agent-sample/*`

deleted legacy shell
  = 历史 `openclaw* / team-runtime*` 兼容壳已从主工作树移除
```

当前真正的产品心智已经不是“聊天直连 nativeChat，复杂任务再旁路建 task”，而是：

- **所有 Dashboard 消息优先进入 TL**
- **TL 决定是 `tl_direct` 还是 `tl_delegate`**
- **`nativeChat` 只负责给 TL 或 member 提供模型推理能力**

相关权威文档：

- `../../README.md`
- `../../ARCHITECTURE.md`
- `session-capability-and-followup-fallback.md`
- `independent-agent-onboarding.md`
- `standalone-harness-baseline-release.md`

---

## 2．职责边界

### 2.1 `team-route-dispatch-v2.mjs`

这是当前 Dashboard Chat 的**唯一主派发入口**。

它负责：

- 读取 `text / scope / history / metadata / onChunk`
- 调 `team-task-dispatcher` 做**分类**
- 把 `/task`、`task`、`confirm_task`、以及其他普通消息统一交给 TL
- 把 TL 结果收敛成两类：
  - `tl_direct` → 返回聊天回复
  - `tl_delegate` → 返回 task / team / memberResults

当前稳定不变量：

- **TL 可用时，所有 Dashboard 消息都走 TL**
- 不再保留“高置信闲聊直走 nativeChat”的旁路

### 2.2 `team-task-dispatcher.mjs`

它现在的定位是：**分类器 / 命令解释器**，不是执行 authority。

它负责：

- `/task` 等命令识别
- `task / confirm_task / chat / discuss / status_query` 分类
- 给 TL 提供一个初始 routing hint

它**不再**负责：

- 最终决定消息是否创建 task
- 直接绕过 TL 发用户回复

### 2.3 `team-tl-runtime.mjs`

这是当前的**唯一对话 authority + 任务编排 authority**。

它现在主要负责：

- 构建 TL system prompt
- 让 TL 判断：
  - 直接回答
  - 委派给成员
  - 部分自己答、部分委派
- 装配 runtime helper，并把委派结果落到：
  - root task
  - child task
  - mailbox / blackboard / artifacts
- 汇总 member 结果并返回最终回复

### 2.3.1 `src/team/tl-runtime/*`

`team-tl-runtime.mjs` 现在已经不是把所有细节都内联进去的单体文件，当前已拆出的 helper 包括：

- `prompt.mjs`：TL / member prompt 构建
- `completion.mjs`：completion file / completion bus 处理
- `state-writeback.mjs`：session / follow-up 状态写回
- `common.mjs`：通用 parse / ensure / risk normalize / fallback policy
- `work-item.mjs`：workItem 规范化与 timeout 策略
- `decision.mjs`：TL decision 解析
- `memory.mjs`：三层 memory / blackboard / upstream context
- `artifact.mjs`：artifact 写入收口
- `planning.mjs`：governed workItem 扩展、child task 创建、member result 摘要
- `runtime-harness.mjs`：execution harness 组装与 session/historical glue 判定
- `execution.mjs`：member spawn / session wait / result writeback
- `followup.mjs`：TL follow-up / member follow-up 路由
- `single-flight.mjs`：同 scope 活跃任务复用与 follow-up 接续
- `fail-fast.mjs`：capability / execution-surface / DAG fail-fast 收口
- `orchestration.mjs`：委派后的执行编排、review loop、dynamic replan、最终汇总
- `README.md`：本目录阅读顺序、边界约定、最小验证入口

当前真实分工是：

- **`team-tl-runtime.mjs`** 负责 authority + 装配
- **`tl-runtime/*.mjs`** 负责可拆分的具体执行层细节

### 2.3.2 `src/team-runtime-adapters/*`

当前运行时适配层已独立成 `src/team-runtime-adapters/`：

- `control-plane.mjs`：宿主无关 control plane client / multi-node transport adapter（现役主 factory=`createControlPlaneClient`）
- `index-host-config.mjs`：统一 host runtime / ops access surface；kernel / bootstrap / active acceptance 不再直接各自读取 `/root/.openclaw/*`、`systemctl orchestrator.service`、`/proc/*/environ` 细节
- `runtime-adapter.mjs`：现役平台中立 runtime adapter surface（主别名：`createSessionSubstrateRuntimeAdapter`）
- `execution-harness.mjs`：TL runtime 直接消费的 execution adapter

当前真实边界已更新为：

- **`team-core/`**：平台无关语义层
- **`team-runtime-adapters/`**：宿主 / provider 接线层
- **`packages/team-runtime/`**：当前 packaged team-runtime export surface authority
- **`src/team/`**：mixed surface（covered packaged runtime shims + remaining local team surfaces）
- **`dashboard/src/*` + `src/routes/team-state/*`**：UAT 前端 / 观察面承载层；当前主口径已切到 **control-plane-neutral / host-neutral**，现役类型与标签优先使用 `controlBaseUrl / controlHost / controlPort / controlPlaneStatus`，旧 `gateway* / openclaw*` 仅允许存在于前端兼容归一层，不再作为主字段继续外扩

### 2.3.3 `src/agent-harness-core/*` 与 `examples/oss-minimal/*`

当前 standalone broker execution substrate 的权威口径已经收敛为：

- **`packages/agent-harness/` = canonical baseline authority**
- `src/agent-harness-core/` = compatibility shim / compatibility asset surface
- `examples/oss-minimal/` = **wrapper / regression facade / runnable sample**

也就是说：

- `src/agent-harness-core/standalone-product-runtime.mjs`
- `src/agent-harness-core/oss-agent-manifest.json`
- `src/agent-harness-core/oss-agent-package.json`
- `src/agent-harness-core/agent-shell.mjs`

共同构成正式产品主链；

- `examples/oss-minimal/run-demo.mjs`
- `examples/oss-minimal/standalone-bootstrap.mjs`
- `examples/oss-minimal/agent-shell.mjs`

则继续承担 runnable demo、稳定 CLI、`.runs/` 样例运行目录、crash-resume regression 的职责。

因此当前正确理解应是：

- **standalone broker harness 的正式产品资产、workflow/policy/provider/backend/shell/session/desk/plugin/bridge 合同与证据，统一以 `src/agent-harness-core/` 为准**；
- `examples/oss-minimal/` 仍保留为易运行、易回归、易观察的 facade，但不再承载主定义；
- 阶段 C / D / P5 / P6 后，对标 OpenHanako 的独立 agent 接入方式时，应优先看产品化 `session / desk / plugin / bridge / shell` 合同；其中 `shell` 已包含 **onboarding / doctor / activation checklist** 产品接入面，而不是 sample-only 叙事。

### 2.4 `team-native-chat.mjs`

这是当前的**OpenAI-compatible LLM 传输层**。

它提供：

- `generateReply()`：阻塞式完整回复
- `generateReplyStream()`：SSE 流式回复

它的职责是：

- 直连模型端点
- 处理 system prompt + history + streaming
- 给 TL / member 提供底层推理能力

它**不是**：

- 路由 authority
- task 发布 authority
- Dashboard 业务分流层

---

## 3．当前任务发布合同

| 用户输入形态 | 当前行为 | 说明 |
|---|---|---|
| `/task 修复 XXX` | 直接进 TL | 显式建任务命令 |
| `帮我写… / 帮我实现… / 帮我分析… / 帮我设计…` | strict mode 下先判 `confirm_task`，随后交 TL | 由 TL 决定直答还是发布任务 |
| 打招呼、谢谢、短问答 | 仍然先进 TL | TL 可直接返回 `tl_direct` |
| 需要产出的分析／调研／路线图梳理 | 应判定为委派任务 | TL 应输出 `delegate / partial_delegate` |

### 3.1 中文 strict trigger 的真实规则

2026-03-28 已确认并修正一个关键坑：

- JavaScript 正则里的 `\b` **不适合中文前缀判断**
- 像 `帮我分析路线图` 这类输入，在 strict mode 下会因为 `\b` 失效而漏匹配
- 修复后，中文 task prefix 改为**不依赖 `\b`** 的显式前缀匹配

这条现在是稳定规则：

- **中文任务前缀分类不要用 `\b` 当边界判断**

### 3.2 TL 对“分析类请求”的稳定判断

2026-03-28 同步收紧了 TL system prompt 的决策规则。

当前明确要求：

- **纯闲聊 / 打招呼 / 一句话问答** → TL 直接回答
- **需要产出内容的请求**（分析、调研、路线图梳理、方案对比、写文档、写代码） → **必须委派**

也就是说：

- `帮我分析 Orchestrator 升级为 AI Team Runtime 的路线图`
  **不应再被当成普通聊天问答**
- 它应被理解成：
  - 需要产出的分析任务
  - 至少要分配给 executor
  - TL 可选 `partial_delegate`，但不能只做纯聊天直答

---

## 4．当前运行路径

### 4.1 直答路径

```text
user message
  -> dispatch-v2
  -> TL analyze
  -> TL 输出纯文本
  -> `parseTLDecision()` => direct
  -> response.action = `tl_direct`
```

### 4.2 委派路径

```text
user message
  -> dispatch-v2
  -> TL analyze
  -> TL 输出 delegate / partial_delegate JSON
  -> root task / child tasks 创建
  -> member sessions 执行
  -> artifacts / mailbox / blackboard 落库
  -> TL 汇总
  -> response.action = `tl_delegate`
```

### 4.3 流式路径

当调用方提供 `onChunk`（例如 Dashboard WebSocket）时：

- TL 走 `generateReplyStream()`
- token/chunk 可即时上屏
- 更适合慢模型与复杂 system prompt

当调用方没有 `onChunk`（例如 HTTP fallback）时：

- TL 走 `generateReply()`
- 等完整回复后一次返回
- 体验上天然比 WS 慢

---

## 5．当前稳定结论

### 已稳定

- **Dashboard Chat 是 TL-first 架构**
- **`nativeChat` 已恢复成真实 LLM 能力层**
- **中文 task prefix strict 判定已修正**
- **“分析／调研／梳理／路线图”类请求已被定义为产出型任务，不应只当聊天回复**

### 仍需记住的边界

- HTTP fallback 没有 chunk 流，复杂 TL 回复天然更慢
- TL prompt 的“direct vs delegate”质量仍依赖模型表现与 system prompt 约束
- 真正的节点首选、超时、治理跳过规则，仍以：
  - `config/team/roles.json`
  - `config/team/governance.json`
  为准

---

## 6．当前建议阅读顺序

- `src/routes/team-route-dispatch-v2.mjs`
- `src/team/team-task-dispatcher.mjs`
- `src/team/team-tl-runtime.mjs`
- `src/team/tl-runtime/README.md`
- `src/team/tl-runtime/common.mjs`
- `src/team/tl-runtime/work-item.mjs`
- `src/team/tl-runtime/decision.mjs`
- `src/team/tl-runtime/memory.mjs`
- `src/team/tl-runtime/artifact.mjs`
- `src/team/tl-runtime/planning.mjs`
- `src/team/tl-runtime/fail-fast.mjs`
- `src/team/tl-runtime/runtime-harness.mjs`
- `src/team/tl-runtime/single-flight.mjs`
- `src/team/tl-runtime/orchestration.mjs`
- `src/team/tl-runtime/execution.mjs`
- `src/team/tl-runtime/followup.mjs`
- `src/team/team-native-chat.mjs`
- `config/team/roles.json`
- `config/team/governance.json`

---

## 7．一句话

**现在的真实系统不是“nativeChat 偶尔带 task”，而是“TL 统一收口所有 Dashboard 消息，再决定直答还是分派成员执行”。**

<!-- Last updated: 2026-03-28 UTC -->
