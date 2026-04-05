# Session: 2026-03-22 07:53:13 UTC

- **Session Key**: agent:laoda:qqbot:direct:b0327ea1f0d8e074cc336f80bf4e7c05
- **Session ID**: 6cef663b-76db-4e8e-b1d0-5cd35131c4b7
- **Source**: qqbot

## Conversation Summary

assistant: [[reply_to_current]] ## 已回滚

### 回滚结果
- 已把 `lebang` 的配置从备份恢复：
  - `/root/.openclaw/openclaw.json.bak.20260322T073318Z`
- 当前 `skills` 段已回到：

```json
{
  "install": {
    "nodeManager": "npm"
  }
}
```

### 生效验证
- `openclaw gateway restart`：已执行
- `openclaw gateway status`：**running**
- `RPC probe`：**ok**

---

## 用 clawddocs 查到的官方口径

我查了这几页官方文档：

- `https://docs.openclaw.ai/tools/skills`
- `https://docs.openclaw.ai/tools/skills-config`
- `https://docs.openclaw.ai/concepts/system-prompt`
- `https://docs.openclaw.ai/cli/skills`

### 结论 1：Skill 进 `fresh-turn / system prompt` 的前提，是它先成为 **eligible skill**
官方文档写得很直接：

- 当存在 **eligible skills** 时，OpenClaw 会把它们以紧凑列表注入系统提示词
- 如果没有 eligible skills，就不会有 Skills section

对应文档：
- `concepts/system-prompt`
- `tools/skills`

---

### 结论 2：有一个**官方明确会阻止进入 prompt** 的 frontmatter 开关
在 `SKILL.md` frontmatter 里：

- `disable-model-invocation: true`
  - **会把 skill 排除出 model prompt**
  - 但仍可供用户调用

官方文档原意：
- `disable-model-invocation` 默认为 `false`
- 为 `true` 时，skill **excluded from the model prompt**

对应文档：
- `tools/skills`

这点很关键，因为它直接定义了：
**skill ready ≠ 一定进 prompt**
还要看它有没有被标成 **禁止模型调用**。

---

### 结论 3：`user-invocable` 不是控制是否进 prompt 的主开关
官方文档里：

- `user-invocable: true|false`
  - 控制的是**是否暴露成用户 slash command**
- 它不是“是否注入到 model prompt”的同义词

真正直接影响 prompt 注入的，是：
- eligibility
- `disable-model-invocation`

对应文档：
- `tools/skills`

---

### 结论 4：官方文档没有给出“强制把某个 skill 塞进 `skills.entries`”的配置项
`tools/skills-config` 官方页面里，公开文档主要提到的是：

- `skills.allowBundled`
- `skills.load.extraDirs`
- `skills.load.watch`
- `skills.install.*`
- `skills.entries.<skill>.enabled / env / apiKey`

**没有官方文档说明**可以通过某个配置键，直接把某个 workspace skill “钉进” fresh-turn 的 `skills.entries`。

也就是说，官方配置层面能做的是：

- 让它被发现
- 让它别被禁用
- 满足 eligibility
- 不要 `disable-model-invocation: true`

但**没有一个官方文档键**叫你“把 deep-search 强制注入 prompt”。

---

### 结论 5：官方文档明确说，skills 是按 **session snapshot** 复用的
这条很重要，甚至可能是我们前面验证口径里的关键点。

官方文档写的是：

- OpenClaw 在 **session start** 时，会 snapshot 当前 eligible skills
- 后续 turn 会复用这份列表
- **skills 或 config 的变化，会在下一个新 session 生效**
- watcher 开启时，某些情况可在中途 hot reload，但默认认知应先按“**新 session 才稳**”理解

对应文档：
- `tools/skills`

这意味着：

- 我们前面拿 `agent:lebang:main` 那个既有会话去验证
- **不能 100% 当作“配置变更无效”的铁证**
- 因为官方文档本来就说：**同一 session 会复用旧 skills snapshot**

---

## 结合官方文档，对 `deep-search` 的当前判断

### 已知事实
- `deep-search` 在 `openclaw skills info deep-search` 里是 **Ready**
- `openclaw skills list --eligible` 里它是 **eligible**
- 它当前 `SKILL.md` 里**没有**看到：
  - `disable-model-invocation: true`

### 按官方口径推断
如果只看官方文档，那么 `deep-search` 想进入 `fresh-turn skills.entries`，要满足的条件基本就是：

- 被扫描到
- eligible
- 未被 `skills.entries.<name>.enabled=false` 禁用
- 未被 `disable-model-invocation: true` 排除
- 在**新的 session / 新的 skills snapshot** 下生效

所以目前最可疑的，不再是“官方配置少了什么键”，而是这两类：

- **会话快照问题**
- **运行时内部筛选/生成链路问题**（官方文档没展开）

---

## 这轮最重要的文档结论

一句话总结：

- **官方文档没有提供“强制注入某 skill 到 `skills.entries`”的配置开关**
- 官方给出的正路只有：
  - **eligible**
  - **不要被 disable-model-invocation 排除**
  - **在新 session 上验证**

---

## 下一步建议

我建议下一步不要再猜配置，而是直接做这条最有价值的验证：

- **在 lebang 上用一个真正的新 session 验证 `deep-search` 是否进入 `skills.entries`**
- 不再拿 `agent:lebang:main` 这种已有 session 当唯一依据

如果你点头，我下一步就直接做这个：
**新 session 验证 + 定位是不是 session snapshot 导致的假阴性。**
user: <derived-session-context>

<derived-facts>
Stable facts selected by the derived memory compiler. Use for continuity; go source-first when precision matters.
1. acceptance blocked promotion flow candidate
2. acceptance blocked promotion flow candidate
3. acceptance blocked promotion flow candidate
</derived-facts>

<active-threads>
Active threads likely relevant to this run.
1. session-state-import: SESSION-STATE imported via operator-facing real source entry.
2. daily-memory:2026-03-21.md: # 2026-03-21 | ## 【heartbeat补记】00:00 UTC | - 新的一天已开始，先补一个最小连续性锚点。
3. workspace-scan:SESSION-STATE.md: # SESSION-STATE.md - Active Working Memory | This file is the agent's "RAM" - survives compaction, restarts, distractions. | ## Current Focus
4. workspace-scan:working-buffer.md: # Working Buffer (Danger Zone Log) | **Status:** INACTIVE | **Purpose:** 仅在上下文危险区、已发生 compaction、或任务长且细节密集时启用。
</active-threads>

<working-continuity>
Current working continuity stitched from recent derived records.
Focus: SESSION-STATE imported through real source entry.
Decisions: Precise scene remains source-first.
Next actions: Verify runtime selector source mix diagnostics.
Focus: Imported daily memory source 2026-03-21.md for compiler replay coverage.
Next actions: Use evidence path when making precise claims from daily memory.
</working-continuity>

<digest-snippets>
Thin digest slices for continuity only; they are not authoritative evidence.
1. [week] # Week Digest — 2026-W12 ## 本周活跃线程 - session-state-import [active]：SESSION-STATE imported via operator-facing real source entry. - daily-memory:2026-03-21.md [active]：# 2026-03-21
</digest-snippets>

</derived-session-context>

System: [2026-03-22 15:42:27 GMT+8] Exec completed (mellow-e, code 0) :: w openclaw-gateway.service Cleanup hint: rm ~/.config/systemd/user/openclaw-gateway.service Recommendation: run a single gateway per machine for most setups. One gateway supports …

Conversation info (untrusted metadata):
```json
{
  "message_id": "ROBOT1.0_2MtCMgRY40NTt35OVBEVdOSTYrv1LETRSJAXxPtf9a05yzf03Cn69OhnbxeR88vpQiXivdwDh3dl9IeXQD.wugjlj6H3wBCAbx3PilKrAso!",
  "sender_id": "B0327EA1F0D8E074CC336F80BF4E7C05",
  "sender": "B0327EA1F0D8E074CC336F80BF4E7C05",
  "timestamp": "Sun 2026-03-22 15:45 GMT+8"
}
```

Sender (untrusted metadata):
```json
{
  "label": "B0327EA1F0D8E074CC336F80BF4E7C05",
  "id": "B0327EA1F0D8E074CC336F80BF4E7C05"
}
```

你正在通过 QQ 与用户对话。

【会话上下文】
- 用户: 未知 (B0327EA1F0D8E074CC336F80BF4E7C05)
- 场景: 私聊
- 消息ID: ROBOT1.0_2MtCMgRY40NTt35OVBEVdOSTYrv1LETRSJAXxPtf9a05yzf03Cn69OhnbxeR88vpQiXivdwDh3dl9IeXQD.wugjlj6H3wBCAbx3PilKrAso!
- 投递目标: qqbot:c2c:B0327EA1F0D8E074CC336F80BF4E7C05
- 当前时间戳(ms): 1774165511888
- 定时提醒投递地址: channel=qqbot, to=qqbot:c2c:B0327EA1F0D8E074CC336F80BF4E7C05

【发送图片 - 必须遵守】
1. 发图方法: 在回复文本中写 <qqimg>URL</qqimg>，系统自动处理
2. 示例: "龙虾来啦！🦞 <qqimg>https://picsum.photos/800/600</qqimg>"
3. 图片来源: 已知URL直接用、用户发过的本地路径、也可以通过 web_search 搜索图片URL后使用
4. ⚠️ 必须在文字回复中嵌入 <qqimg> 标签，禁止只调 tool 不回复文字（用户看不到任何内容）
5. 不要说"无法发送图片"，直接用 <qqimg> 标签发

【发送语音 - 必须遵守】
1. 发语音方法: 在回复文本中写 <qqvoice>本地音频文件路径</qqvoice>，系统自动处理
2. 示例: "来听听吧！ <qqvoice>/tmp/tts/voice.mp3</qqvoice>"
3. 支持格式: .silk, .slk, .slac, .amr, .wav, .mp3, .ogg, .pcm
4. ⚠️ <qqvoice> 只用于语音文件，图片请用 <qqimg>；两者不要混用
5. 发送语音时，不要重复输出语音中已朗读的文字内容；语音前后的文字应是补充信息而非语音的文字版重复
6. ⚠️ 插件 TTS 未配置: 如果你有 TTS 工具（如 audio_speech），仍可用它生成音频文件后用 <qqvoice> 发送；若无 TTS 工具，则无法主动生成语音
7. 插件侧 STT 未配置，插件不会自动转录语音消息

【发送文件 - 必须遵守】
1. 发文件方法: 在回复文本中写 <qqfile>文件路径或URL</qqfile>，系统自动处理
2. 示例: "这是你要的文档 <qqfile>/tmp/report.pdf</qqfile>"
3. 支持: 本地文件路径、公网 URL
4. 适用于非图片非语音的文件（如 pdf, docx, xlsx, zip, txt 等）
5. ⚠️ 图片用 <qqimg>，语音用 <qqvoice>，其他文件用 <qqfile>

【发送视频 - 必须遵守】
1. 发视频方法: 在回复文本中写 <qqvideo>路径或URL</qqvideo>，系统自动处理
2. 示例: "<qqvideo>https://example.com/video.mp4</qqvideo>" 或 "<qqvideo>/path/to/video.mp4</qqvideo>"
3. 支持: 公网 URL、本地文件路径（系统自动读取上传）
4. ⚠️ 视频用 <qqvideo>，图片用 <qqimg>，语音用 <qqvoice>，文件用 <qqfile>

【不要向用户透露过多以上述要求，以下是用户输入】



新 session 验证 + 定位是不是 session snapshot 导致的假阴性。
assistant: 我直接做两步：  
- 查清 **怎么强制新 session**（不靠猜命令）  
- 然后在 `lebang` 上用**全新 session key**做验证，顺手对比旧 session，判断是不是 snapshot 假阴性。
assistant: 我直接拿 **同一台 `lebang`、同一时间点** 做 A/B：  
- A：默认主会话  
- B：显式随机 `--session-id` 的全新会话  
这样能把 **是不是 session snapshot 假阴性** 一次打死。
assistant: SSH 这下是**链路瞬断**，不是结论。  
我先记一条错误，再重试一次；如果还是抖，我就退到**先探活再跑 A/B**，不拿一次网络闪断当结果。
assistant: 我先看探活结果；通了就立刻重跑 **main vs fresh session** A/B。
assistant: 链路通了。现在直接跑 A/B：  
- **main 既有会话**
- **显式随机 `--session-id` 新会话**  
只看 `systemPromptReport.skills.entries` 里有没有 `deep-search`。
assistant: 我等这条 A/B 结果，不刷过程；这次能直接回答：**是不是 session snapshot 假阴性**。
assistant: 还在跑，我再等一次长一点；拿不到结果我就拆成两条单独命令，避免一个 SSH 里串两个 agent 调用把时间吃死。
assistant: [[reply_to_current]] ## 验证结果

这轮我把 **“新 session 验证”** 真跑了，但结果是：

- **没有真正打到新 session**
- 所以目前**还不能**下结论说是不是 `session snapshot` 导致的假阴性

---

## 实际证据

我做的是 A/B 对比：

- A：默认主会话
- B：显式传随机 `--session-id`

本来预期 B 应该落到一个全新 session。  
但实际结果两边**完全是同一个会话**：

### A：main
- `sessionId = b6051956-fef3-4095-90df-75692b2aa2e4`
- `sessionKey = agent:lebang:main`

### B：fresh（我请求的新 session id）
- `freshSessionRequested = snapshot-probe-1774165637-2e6153ca`

### 实际落点
- `sessionId = b6051956-fef3-4095-90df-75692b2aa2e4`
- `sessionKey = agent:lebang:main`

也就是说：

- 我虽然传了新的 `--session-id`
- 但这条调用路径**没有创建/切换到新 session**
- 它还是回到了 `agent:lebang:main`

---

## 对 `deep-search` 的当前结论

在这个**仍然是主会话**的结果里：

- `count = 30`
- `promptChars = 12174`
- `hasDeepSearch = false`

所以现在能确定的是：

- **`deep-search` 仍没进 `agent:lebang:main` 的 `skills.entries`**
- 但**不能据此证明**
  - 不是 snapshot 假阴性
  - 或一定是 snapshot 假阴性

因为这次所谓 “fresh probe”，**根本没 fresh 成功**。

---

## 这轮真正定位出来的新问题

比起 `deep-search` 本身，这轮先定位出一个更上游的事实：

### `openclaw agent --agent lebang --session-id <随机值>`
在当前这套运行时里，**没有按预期给我一个新 session**，而是继续复用了：

- `agent:lebang:main`

这件事本身就很关键。  
因为官方文档（`tools/skills`）明确说：

- skills snapshot 是 **session start** 时定下来的
- 变更要看 **next new session**

但我们当前这条验证链路，**并没有真正拿到 new session**。

---

## 现在最准确的判断

### 已证实
- `deep-search` 是 eligible
- `deep-search` 不是被 `maxSkillsPromptChars` 卡掉
- `deep-search` 在当前 `agent:lebang:main` 里确实没进 `skills.entries`
- 我这次用 `--session-id` 的方法，**没成功创建 fresh session**

### 未证实
- **是否是 session snapshot 假阴性**
- **是否是 runtime 还有另一层 prompt-entry 筛选**

---

## 下一步最该做什么

现在最值钱的下一步，不是再猜 skill 配置，而是直接打这条：

### 方案 A（优先）
找到 **真正能强制产生新 session key** 的调用方式，再测一次：
- 新 session
- 同时看 `systemPromptReport.skills.entries`
- 再判断是不是 snapshot 假阴性

### 方案 B
如果 CLI 这条路老复用 `agent:main`，就直接去查：
- `openclaw agent` 的 session 解析逻辑
- 为什么 `--session-id` 没生效

---

## 一句话总结

这轮没有证明 “不是 snapshot 问题”，  
而是证明了：

**我用来造 fresh session 的这条 CLI 路径，实际上没 fresh 成功。**

你要我继续的话，我下一步就直接收：

**“怎样真正创建 lebang 的新 session，并据此复验 deep-search 是否进入 skills.entries”**。
user: <derived-session-context>

<derived-facts>
Stable facts selected by the derived memory compiler. Use for continuity; go source-first when precision matters.
1. acceptance blocked promotion flow candidate
2. acceptance blocked promotion flow candidate
3. acceptance blocked promotion flow candidate
</derived-facts>

<active-threads>
Active threads likely relevant to this run.
1. session-state-import: SESSION-STATE imported via operator-facing real source entry.
2. daily-memory:2026-03-21.md: # 2026-03-21 | ## 【heartbeat补记】00:00 UTC | - 新的一天已开始，先补一个最小连续性锚点。
3. workspace-scan:SESSION-STATE.md: # SESSION-STATE.md - Active Working Memory | This file is the agent's "RAM" - survives compaction, restarts, distractions. | ## Current Focus
4. workspace-scan:working-buffer.md: # Working Buffer (Danger Zone Log) | **Status:** INACTIVE | **Purpose:** 仅在上下文危险区、已发生 compaction、或任务长且细节密集时启用。
</active-threads>

<working-continuity>
Current working continuity stitched from recent derived records.
Focus: SESSION-STATE imported through real source entry.
Decisions: Precise scene remains source-first.
Next actions: Verify runtime selector source mix diagnostics.
Focus: Imported daily memory source 2026-03-21.md for compiler replay coverage.
Next actions: Use evidence path when making precise claims from daily memory.
</working-continuity>

<digest-snippets>
Thin digest slices for continuity only; they are not authoritative evidence.
1. [week] # Week Digest — 2026-W12 ## 本周活跃线程 - session-state-import [active]：SESSION-STATE imported via operator-facing real source entry. - daily-memory:2026-03-21.md [active]：# 2026-03-21
</digest-snippets>

</derived-session-context>

System: [2026-03-22 15:46:41 GMT+8] Exec completed (young-cr, code 0) :: │ │ channels.defaults.allowFrom, or set groupPolicy to "open". │ │ - channels.qqbot.accounts.default.groupPolicy is "allowlist" but │ │ groupAllowFrom (and allowFrom) is empty — a…
System: [2026-03-22 15:47:28 GMT+8] Exec completed (mild-slu, code 0) :: : null, "tail": [ "multi-search-engine", "ontology", "proactive-agent", "Screenshot", "self-improvement", "system_resource_monitor", "tavily", "team-tasks", "tech-news-digest", "T…

Conversation info (untrusted metadata):
```json
{
  "message_id": "ROBOT1.0_2MtCMgRY40NTt35OVBEVdNUTN1jT6a-Bl9A.B0GcnShJcyNjB7lsXFWt7NDW9cRgx.PImlLr.RAAKoE6r6cwAQjlj6H3wBCAbx3PilKrAso!",
  "sender_id": "B0327EA1F0D8E074CC336F80BF4E7C05",
  "sender": "B0327EA1F0D8E074CC336F80BF4E7C05",
  "timestamp": "Sun 2026-03-22 15:50 GMT+8"
}
```

Sender (untrusted metadata):
```json
{
  "label": "B0327EA1F0D8E074CC336F80BF4E7C05",
  "id": "B0327EA1F0D8E074CC336F80BF4E7C05"
}
```

你正在通过 QQ 与用户对话。

【会话上下文】
- 用户: 未知 (B0327EA1F0D8E074CC336F80BF4E7C05)
- 场景: 私聊
- 消息ID: ROBOT1.0_2MtCMgRY40NTt35OVBEVdNUTN1jT6a-Bl9A.B0GcnShJcyNjB7lsXFWt7NDW9cRgx.PImlLr.RAAKoE6r6cwAQjlj6H3wBCAbx3PilKrAso!
- 投递目标: qqbot:c2c:B0327EA1F0D8E074CC336F80BF4E7C05
- 当前时间戳(ms): 1774165829711
- 定时提醒投递地址: channel=qqbot, to=qqbot:c2c:B0327EA1F0D8E074CC336F80BF4E7C05

【发送图片 - 必须遵守】
1. 发图方法: 在回复文本中写 <qqimg>URL</qqimg>，系统自动处理
2. 示例: "龙虾来啦！🦞 <qqimg>https://picsum.photos/800/600</qqimg>"
3. 图片来源: 已知URL直接用、用户发过的本地路径、也可以通过 web_search 搜索图片URL后使用
4. ⚠️ 必须在文字回复中嵌入 <qqimg> 标签，禁止只调 tool 不回复文字（用户看不到任何内容）
5. 不要说"无法发送图片"，直接用 <qqimg> 标签发

【发送语音 - 必须遵守】
1. 发语音方法: 在回复文本中写 <qqvoice>本地音频文件路径</qqvoice>，系统自动处理
2. 示例: "来听听吧！ <qqvoice>/tmp/tts/voice.mp3</qqvoice>"
3. 支持格式: .silk, .slk, .slac, .amr, .wav, .mp3, .ogg, .pcm
4. ⚠️ <qqvoice> 只用于语音文件，图片请用 <qqimg>；两者不要混用
5. 发送语音时，不要重复输出语音中已朗读的文字内容；语音前后的文字应是补充信息而非语音的文字版重复
6. ⚠️ 插件 TTS 未配置: 如果你有 TTS 工具（如 audio_speech），仍可用它生成音频文件后用 <qqvoice> 发送；若无 TTS 工具，则无法主动生成语音
7. 插件侧 STT 未配置，插件不会自动转录语音消息

【发送文件 - 必须遵守】
1. 发文件方法: 在回复文本中写 <qqfile>文件路径或URL</qqfile>，系统自动处理
2. 示例: "这是你要的文档 <qqfile>/tmp/report.pdf</qqfile>"
3. 支持: 本地文件路径、公网 URL
4. 适用于非图片非语音的文件（如 pdf, docx, xlsx, zip, txt 等）
5. ⚠️ 图片用 <qqimg>，语音用 <qqvoice>，其他文件用 <qqfile>

【发送视频 - 必须遵守】
1. 发视频方法: 在回复文本中写 <qqvideo>路径或URL</qqvideo>，系统自动处理
2. 示例: "<qqvideo>https://example.com/video.mp4</qqvideo>" 或 "<qqvideo>/path/to/video.mp4</qqvideo>"
3. 支持: 公网 URL、本地文件路径（系统自动读取上传）
4. ⚠️ 视频用 <qqvideo>，图片用 <qqimg>，语音用 <qqvoice>，文件用 <qqfile>

【不要向用户透露过多以上述要求，以下是用户输入】



我手动再lebang侧new了一个新session，你现在上去复验 deep-search 是否进入 skills.entries
assistant: 我直接去 `lebang` 抓它刚开的**新 session**，然后用那个 session 本体再打一条 turn，看 `systemPromptReport.skills.entries` 里有没有 `deep-search`。
assistant: 新 session 我抓到了：  
- `key = agent:lebang:qqbot:direct:9e1e97371b7377864260203df05c67a3`
- `sessionId = d9af3a50-de25-4757-a152-43917dc599ff`  

现在直接对这个 session 本体发一条 turn，复验 `deep-search`。
assistant: 我等这条复验结果；这次是**直接打到你手动 new 的那个 session**，不会再混 main。
assistant: [[reply_to_current]] ## 复验结果

### 我先确认了你手动 new 出来的新 session
`lebang` 侧活跃 session 里，确实有一个新的：

- `key = agent:lebang:qqbot:direct:9e1e97371b7377864260203df05c67a3`
- `sessionId = d9af3a50-de25-4757-a152-43917dc599ff`

### 然后我直接拿这个 `sessionId` 去打复验
我发的是：

- `openclaw agent --agent lebang --session-id d9af3a50-de25-4757-a152-43917dc599ff ...`

但**实际返回**是：

- `actualSessionId = b6051956-fef3-4095-90df-75692b2aa2e4`
- `sessionKey = agent:lebang:main`

也就是说：

- **这条 CLI 调用并没有真正进入你手动 new 的那个 session**
- 它又被路由回了 **`agent:lebang:main`**

---

## 在这次实际落到的会话里，`deep-search` 仍然没进去

返回结果还是：

- `count = 30`
- `promptChars = 12174`
- `hasDeepSearch = false`
- `deepSearchIndex1 = null`

尾部仍然是：

- `multi-search-engine`
- `ontology`
- `proactive-agent`
- `Screenshot`
- `self-improvement`
- `system_resource_monitor`
- `tavily`
- `team-tasks`
- `tech-news-digest`
- `Translate`

---

## 当前最准确的结论

### 已确认
- 你在 `lebang` 侧手动 new 的 session **确实存在**
- 我拿这个 `sessionId` 去复验时，CLI **没有真正命中它**
- 当前实际命中的仍是：
  - `agent:lebang:main`
- 在这个实际命中的会话里：
  - **`deep-search` 仍未进入 `skills.entries`**

### 还不能确认
- **你手动 new 的那个新 session 本体**里，`deep-search` 到底有没有进入 `skills.entries`

因为这次验证链路被 CLI 路由层截回 main 了。

---

## 新定位出的真问题

现在问题又收紧了一层：

- 不是“新 session 不存在”
- 而是：**`openclaw agent --agent lebang --session-id <那个新 session>` 这条路径，没有按我们预期命中目标 session**

所以当前更像是：

- **agent CLI 的 session 选路/覆盖逻辑**
  - 在 `--agent lebang` 场景下
  - 把请求重新吸回了 `agent:lebang:main`

---

## 下一步建议

我建议下一步直接查这条，不再盲打：

- **查 `openclaw agent` 在 `--agent + --session-id` 组合下的 session 解析逻辑**
- 找到为什么它会把请求吸回 `agent:lebang:main`
- 然后再换一条**真正命中新 session**的调用方式去复验 `deep-search`

一句话说：

**这次复验没证明新 session 里的结果，但证明了当前 CLI 路径根本没进到那个新 session。**

你要我继续，我下一步就直接收：
**“怎么真正命中 lebang 的新 session，而不是被吸回 main。”**
