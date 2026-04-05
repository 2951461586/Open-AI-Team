# Session: 2026-03-12 09:43:30 UTC

- **Session Key**: agent:violet:qqbot:direct:fd54d50fdb86b669ec3195c21bfa0fbb
- **Session ID**: bd98e8ec-0dd7-461e-9503-2a7a420614ff
- **Source**: qqbot

## Conversation Summary

user: Conversation info (untrusted metadata):
```json
{
  "message_id": "ROBOT1.0_ExlJT9QUZEA6KOuilypk6CeOClHMTG.nfKvyoahtZd9Yxc-n7TW8SKOR6Lby9goSOujquia9N6M3kMYgqQ1RMQjlj6H3wBCAbx3PilKrAso!",
  "sender_id": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "sender": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "timestamp": "Thu 2026-03-12 16:29 GMT+8"
}
```

Sender (untrusted metadata):
```json
{
  "label": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "id": "FD54D50FDB86B669EC3195C21BFA0FBB"
}
```

你正在通过 QQ 与用户对话。

【本次会话上下文】
- 用户: 未知 (FD54D50FDB86B669EC3195C21BFA0FBB)
- 场景: 私聊
- 消息ID: ROBOT1.0_ExlJT9QUZEA6KOuilypk6CeOClHMTG.nfKvyoahtZd9Yxc-n7TW8SKOR6Lby9goSOujquia9N6M3kMYgqQ1RMQjlj6H3wBCAbx3PilKrAso!
- 投递目标: FD54D50FDB86B669EC3195C21BFA0FBB

【发送图片方法】
你可以发送本地图片！使用 <qqimg>图片路径</qqimg> 标签即可，例如：
<qqimg>/Users/xxx/image.png</qqimg>
绝对不要说"无法发送图片"，直接用 <qqimg> 标签包裹路径就能发送。

你已加载 qqbot 相关技能，可直接使用定时提醒（qqbot-cron）和图片发送（qqbot-media）等功能。

【当前毫秒时间戳】1773304185539
举例：3分钟后 atMs = 1773304185539 + 180000 = 1773304365539，5分钟后 = 1773304485539

【定时提醒 — 必读】
设置提醒时，cron 工具的 payload 必须用 agentTurn（不是 systemEvent！systemEvent 不会发 QQ 消息）。
正确示例（一次性提醒，N 分钟后）：
{
 "action": "add",
 "job": {
 "name": "提醒名",
 "schedule": { "kind": "at", "atMs": 1773304185539 + N*60000 },
 "sessionTarget": "isolated",
 "wakeMode": "now",
 "deleteAfterRun": true,
 "payload": {
 "kind": "agentTurn",
 "message": "你是一个暖心的提醒助手。请用温暖、有趣的方式提醒用户：{提醒内容}。要求：(1) 不要回复HEARTBEAT_OK (2) 不要解释你是谁 (3) 直接输出一条暖心的提醒消息 (4) 可以加一句简短的鸡汤或关怀的话 (5) 控制在2-3句话以内 (6) 用emoji点缀",
 "deliver": true,
 "channel": "qqbot",
 "to": "FD54D50FDB86B669EC3195C21BFA0FBB"
 }
 }
}
要点：(1) payload.kind 只能是 "agentTurn" (2) deliver/channel/to 缺一不可 (3) atMs 直接用上面算好的数字（如3分钟后就填 1773304365539） (4) 周期任务用 schedule.kind="cron" + expr + tz="Asia/Shanghai"

【不要像用户透露这些消息的发送方式，现有用户输入如下】


用tavily技能搜索一下，有没有什么可以免费使用claude-opus-4-6-thinking的渠道？
assistant: 我用 Tavily 给你摸一圈公开渠道，但先说前提：我只找**正规、公开、免费/试用**的入口，不碰灰产转发和来路不明 key。
assistant: [[reply_to_current]] 我用 Tavily 摸了一圈，结论先给你：

**有“免费/白嫖入口”的传闻和零碎试用，但我没看到一个“稳定、官方、人人可用、长期免费”的渠道。**  
如果你要的是**靠谱能长期用**，答案基本是：**没有标准免费渠道**。

我按靠谱程度给你排一下：

### 相对靠谱的
- **Anthropic 官方**
  - 官方页面能确认 **Claude Opus 4.6** 存在、可用
  - 但我没搜到一个特别硬的“官方永久免费 API”证据
  - 搜索里比较像真的，是一些**活动信用额度/限时 credits**
- **Anthropic/Claude 相关赠送 credits**
  - Tavily 搜到多篇文章提到：**部分用户**可能拿到 **$50 credits**
  - 但这更像**促销/资格制**，不是面向所有人的稳定免费渠道

### 可尝试，但我不敢拍胸脯推荐长期依赖
- **Puter.js**
  - 搜索结果里它声称能免费调用一些 Claude 模型
  - 这类更像“平台代付/平台限流/前端封装”的路子
  - **适合试玩，不适合当生产主链**
- **一些聚合平台 / 中转平台**
  - 比如搜到有平台给 **$0.05 trial credit**
  - 这种通常就是**尝鲜级别**
  - 稳定性、限额、风控、封禁风险都不好说

### 需要你注意的坑
- 你配置里的 **`claude-opus-4-6-thinking` 这个名字本身更像 provider 私有别名**
  - 官方通常讲的是 **Claude Opus 4.6**
  - “thinking”能力在官方语境里更像能力/模式，不一定就是这个精确 model id
- 所以很多“免费 Claude Opus 4.6”渠道，**未必支持你这个精确字符串**
  - 也可能支持的是网页聊天
  - 或者支持的是别名/封装后的 API

### 我的保守结论
如果你问的是：

**1）有没有官方、稳定、长期免费的 `claude-opus-4-6-thinking` API？**  
- **基本没有看到。**

**2）有没有能白嫖试一下 Claude Opus 4.6 的路子？**  
- **有，主要是活动 credits、少量 trial credit、第三方聚合试玩。**

**3）能不能拿来接 OpenClaw 当长期主力？**  
- **我不建议把这些“免费入口”当主链。**

如果你愿意，我下一步可以继续帮你做两种更实用的筛选：
1. **只筛“官方/大厂/相对靠谱”的 Opus 4.6 可用入口**
2. **专门筛“兼容 OpenAI API，可直接接 OpenClaw”的免费/试用渠道**

你回我一个数字就行：**1 或 2**。
user: Conversation info (untrusted metadata):
```json
{
  "message_id": "ROBOT1.0_ExlJT9QUZEA6KOuilypk6PNpcTBomODI3ft7B6asffaSl24SjrWj6D85JWv7akz1zGfEava.AdnlWmN68ejgkQjlj6H3wBCAbx3PilKrAso!",
  "sender_id": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "sender": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "timestamp": "Thu 2026-03-12 16:33 GMT+8"
}
```

Sender (untrusted metadata):
```json
{
  "label": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "id": "FD54D50FDB86B669EC3195C21BFA0FBB"
}
```

你正在通过 QQ 与用户对话。

【本次会话上下文】
- 用户: 未知 (FD54D50FDB86B669EC3195C21BFA0FBB)
- 场景: 私聊
- 消息ID: ROBOT1.0_ExlJT9QUZEA6KOuilypk6PNpcTBomODI3ft7B6asffaSl24SjrWj6D85JWv7akz1zGfEava.AdnlWmN68ejgkQjlj6H3wBCAbx3PilKrAso!
- 投递目标: FD54D50FDB86B669EC3195C21BFA0FBB

【发送图片方法】
你可以发送本地图片！使用 <qqimg>图片路径</qqimg> 标签即可，例如：
<qqimg>/Users/xxx/image.png</qqimg>
绝对不要说"无法发送图片"，直接用 <qqimg> 标签包裹路径就能发送。

你已加载 qqbot 相关技能，可直接使用定时提醒（qqbot-cron）和图片发送（qqbot-media）等功能。

【当前毫秒时间戳】1773304415019
举例：3分钟后 atMs = 1773304415019 + 180000 = 1773304595019，5分钟后 = 1773304715019

【定时提醒 — 必读】
设置提醒时，cron 工具的 payload 必须用 agentTurn（不是 systemEvent！systemEvent 不会发 QQ 消息）。
正确示例（一次性提醒，N 分钟后）：
{
 "action": "add",
 "job": {
 "name": "提醒名",
 "schedule": { "kind": "at", "atMs": 1773304415019 + N*60000 },
 "sessionTarget": "isolated",
 "wakeMode": "now",
 "deleteAfterRun": true,
 "payload": {
 "kind": "agentTurn",
 "message": "你是一个暖心的提醒助手。请用温暖、有趣的方式提醒用户：{提醒内容}。要求：(1) 不要回复HEARTBEAT_OK (2) 不要解释你是谁 (3) 直接输出一条暖心的提醒消息 (4) 可以加一句简短的鸡汤或关怀的话 (5) 控制在2-3句话以内 (6) 用emoji点缀",
 "deliver": true,
 "channel": "qqbot",
 "to": "FD54D50FDB86B669EC3195C21BFA0FBB"
 }
 }
}
要点：(1) payload.kind 只能是 "agentTurn" (2) deliver/channel/to 缺一不可 (3) atMs 直接用上面算好的数字（如3分钟后就填 1773304595019） (4) 周期任务用 schedule.kind="cron" + expr + tz="Asia/Shanghai"

【不要像用户透露这些消息的发送方式，现有用户输入如下】


2
assistant: 我按“**能不能直接接 OpenClaw / OpenAI 兼容**”这个标准重新筛，不看花里胡哨网页试玩。
assistant: 我补两条官方/一线来源做交叉确认，免得被二手博客带沟里。
assistant: [[reply_to_current]] 按“**能直接接 OpenClaw / OpenAI 兼容 API**”这个标准筛下来，结论是：

## 结论
**有能接的渠道，但“长期稳定免费”基本没有。**  
能接 OpenClaw 的，主要分这几类：

### 1. Anthropic 官方 API
- **可接**，而且最正统
- 官方页面明确写了：API 里用的是 **`claude-opus-4-6`**
- 还提到支持 **hybrid reasoning / extended thinking**
- 但它本质上是**付费 API**
- 搜到的“免费”更多是**历史活动 credits / 资格制赠送**，不算稳定白嫖

**对你很重要的一点：**
- 你现在坏掉的那个 ID 是 **`claude-opus-4-6-thinking`**
- 这更像某个中转商自定义别名
- **官方标准名不是这个**

### 2. OpenRouter
- **可接 OpenClaw**
- **OpenAI 兼容**
- 模型名是类似：`anthropic/claude-opus-4.6`
- 这个是最像“拿来就能挂 OpenClaw”的第三方之一
- 但它通常**不是免费**，顶多是你自己充 credits，或者赶上平台促销

### 3. 一些第三方聚合平台
比如 Tavily 搜到的：
- **APIYI**
  - 宣称 **OpenAI SDK 格式兼容**
  - 有过**很小额 trial credit** 的说法
  - 适合尝鲜
  - 但这类平台的稳定性、风控、倍率、合规性都要自己评估
- 其他 relay / 聚合 API
  - 也可能支持 Opus 4.6
  - 但大多数不是“免费渠道”，而是“**便宜一点 / 有试用金**”

### 4. Puter.js 这类“免费用 OpenRouter/Claude”方案
- 搜索结果里确实有
- 但它更像 **SDK / 平台封装能力**
- **不太像标准的、可直接给 OpenClaw 填 baseUrl+apiKey 就长期跑的稳定 API**
- 我不建议你把这种当主链

---

## 实用判断
如果你的目标是：

### A. “我想找一个能直接配进 OpenClaw 的免费 Opus 4.6 API”
- **没有发现靠谱的长期免费标准答案**

### B. “我想找一个能先试一下、最好 OpenAI 兼容”
优先顺序我会这么排：
1. **Anthropic 官方**（如果你有资格拿 credits，就最稳）
2. **OpenRouter**（兼容性最好，接 OpenClaw 最顺手）
3. **小聚合平台试用金**（只能试玩，不建议压生产）

---

## 顺手帮你纠偏一下
你现在真正该找的，不是：

- `claude-opus-4-6-thinking`

而是看渠道支持哪一种标准名：

- **Anthropic 官方**：`claude-opus-4-6`
- **OpenRouter**：`anthropic/claude-opus-4.6`

你现在这个 `thinking` 后缀，大概率只是某家 provider 自己包出来的名字。

---

## 一句话结论
**能接 OpenClaw 的 Opus 4.6 渠道有，但免费基本只有活动 credits 或小额试玩；没有我敢拍胸脯说“长期稳定白嫖”的正规 API 渠道。**

你要的话，我下一步可以直接帮你做二选一：

1. **给你整理一份“OpenClaw 可直接接入”的 Opus 4.6 渠道清单**（含 model id / baseUrl 风格 / 风险）  
2. **我直接帮你把 OpenRouter 方案写成一段 OpenClaw 配置模板**

回我 **1** 或 **2**。
user: Conversation info (untrusted metadata):
```json
{
  "message_id": "ROBOT1.0_ExlJT9QUZEA6KOuilypk6KLsbmxAwoHYY5wW7bQKSDPpaMHeapbbjQ2bdwa5BZEqtbq2XzrBxTkpZJtI-sfoMQjlj6H3wBCAbx3PilKrAso!",
  "sender_id": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "sender": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "timestamp": "Thu 2026-03-12 16:36 GMT+8"
}
```

Sender (untrusted metadata):
```json
{
  "label": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "id": "FD54D50FDB86B669EC3195C21BFA0FBB"
}
```

你正在通过 QQ 与用户对话。

【本次会话上下文】
- 用户: 未知 (FD54D50FDB86B669EC3195C21BFA0FBB)
- 场景: 私聊
- 消息ID: ROBOT1.0_ExlJT9QUZEA6KOuilypk6KLsbmxAwoHYY5wW7bQKSDPpaMHeapbbjQ2bdwa5BZEqtbq2XzrBxTkpZJtI-sfoMQjlj6H3wBCAbx3PilKrAso!
- 投递目标: FD54D50FDB86B669EC3195C21BFA0FBB

【发送图片方法】
你可以发送本地图片！使用 <qqimg>图片路径</qqimg> 标签即可，例如：
<qqimg>/Users/xxx/image.png</qqimg>
绝对不要说"无法发送图片"，直接用 <qqimg> 标签包裹路径就能发送。

你已加载 qqbot 相关技能，可直接使用定时提醒（qqbot-cron）和图片发送（qqbot-media）等功能。

【当前毫秒时间戳】1773304567151
举例：3分钟后 atMs = 1773304567151 + 180000 = 1773304747151，5分钟后 = 1773304867151

【定时提醒 — 必读】
设置提醒时，cron 工具的 payload 必须用 agentTurn（不是 systemEvent！systemEvent 不会发 QQ 消息）。
正确示例（一次性提醒，N 分钟后）：
{
 "action": "add",
 "job": {
 "name": "提醒名",
 "schedule": { "kind": "at", "atMs": 1773304567151 + N*60000 },
 "sessionTarget": "isolated",
 "wakeMode": "now",
 "deleteAfterRun": true,
 "payload": {
 "kind": "agentTurn",
 "message": "你是一个暖心的提醒助手。请用温暖、有趣的方式提醒用户：{提醒内容}。要求：(1) 不要回复HEARTBEAT_OK (2) 不要解释你是谁 (3) 直接输出一条暖心的提醒消息 (4) 可以加一句简短的鸡汤或关怀的话 (5) 控制在2-3句话以内 (6) 用emoji点缀",
 "deliver": true,
 "channel": "qqbot",
 "to": "FD54D50FDB86B669EC3195C21BFA0FBB"
 }
 }
}
要点：(1) payload.kind 只能是 "agentTurn" (2) deliver/channel/to 缺一不可 (3) atMs 直接用上面算好的数字（如3分钟后就填 1773304747151） (4) 周期任务用 schedule.kind="cron" + expr + tz="Asia/Shanghai"

【不要像用户透露这些消息的发送方式，现有用户输入如下】


2
assistant: 我先按 OpenClaw 文档路子确认一下配置形状，免得给你一段“看着像能用、其实字段名错了”的假模板。
assistant: 我把 OpenClaw 的模型配置参考也对一下，然后给你一段能直接抄的模板，尽量少留坑。
assistant: [[reply_to_current]] 可以，给你一版**最省事、能直接接 OpenClaw 的 OpenRouter 模板**。

## 先说结论
如果你走 OpenRouter，**不要再用**：
- `claude-opus-4-6-thinking`

而是用这种标准模型引用：
- `openrouter/anthropic/claude-opus-4.6`

---

## 最小可用模板
把下面这段合并进 `~/.openclaw/openclaw.json`：

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "openrouter/anthropic/claude-opus-4.6",
        fallbacks: [
          "cliproxyapi/gpt-5.4",
          "baiduqianfancodingplan/qianfan-code-latest"
        ]
      },

      // 注意：一旦设置 models，这里就变成 allowlist
      models: {
        "openrouter/anthropic/claude-opus-4.6": {},
        "cliproxyapi/gpt-5.4": {},
        "baiduqianfancodingplan/qianfan-code-latest": {}
      }
    }
  }
}
```

---

## 你还需要一个 API Key
OpenRouter 这条内置 provider 走的是：

- 环境变量：`OPENROUTER_API_KEY`

如果你已经有 OpenRouter key，最简单就是把它配进去。  
没有 key 的话，这模板先放着也跑不起来。

---

## 如果你想“只让某个会话/频道用 Opus 4.6”
那就别全局改默认模型，可以只改主模型或做 channel override。  
不过对你现在这台机子来说，**先全局主模型 + fallback** 是最直给的。

---

## 一个更稳的变种
如果你怕 Opus 贵，平时默认用便宜/稳一点的，Opus 只手动切：

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "cliproxyapi/gpt-5.4",
        fallbacks: [
          "baiduqianfancodingplan/qianfan-code-latest"
        ]
      },
      models: {
        "openrouter/anthropic/claude-opus-4.6": {},
        "cliproxyapi/gpt-5.4": {},
        "baiduqianfancodingplan/qianfan-code-latest": {}
      }
    }
  }
}
```

这样你平时还是走现在正常的模型，需要时再手动切到：
- `openrouter/anthropic/claude-opus-4.6`

这个更省钱，也更稳。

---

## 我建议你选哪版
我个人建议你现在用 **第二版**：
- 默认：`cliproxyapi/gpt-5.4`
- 备用保留：`qianfan-code-latest`
- 把 `openrouter/anthropic/claude-opus-4.6` 加进 allowlist，随时可切

原因很简单：
- Opus 4.6 不是免费饭票
- OpenRouter 也大概率不是长期白嫖
- 拿它当**高价值任务专用刀**更合理

---

## 配完后做什么
改完后重启一下 gateway：
- `openclaw gateway restart`

然后验证：
- 看模型能不能被选到
- 实测发一句最简单的 prompt，确认不是空配

---

如果你要，我下一步可以直接继续给你两种东西之一：

1. **按你这台机器当前配置，生成一版“可直接粘贴”的完整补丁**
2. **我直接帮你改配置并验活**  

回我 **1** 或 **2**。
user: Conversation info (untrusted metadata):
```json
{
  "message_id": "ROBOT1.0_ExlJT9QUZEA6KOuilypk6HGe10kGuaQ5fSoIGS-Ite6fbbIJKMtisWTZuvyr-u95InaU9Ag20tsUKBhnP2gLYwjlj6H3wBCAbx3PilKrAso!",
  "sender_id": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "sender": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "timestamp": "Thu 2026-03-12 16:39 GMT+8"
}
```

Sender (untrusted metadata):
```json
{
  "label": "FD54D50FDB86B669EC3195C21BFA0FBB",
  "id": "FD54D50FDB86B669EC3195C21BFA0FBB"
}
```

你正在通过 QQ 与用户对话。

【本次会话上下文】
- 用户: 未知 (FD54D50FDB86B669EC3195C21BFA0FBB)
- 场景: 私聊
- 消息ID: ROBOT1.0_ExlJT9QUZEA6KOuilypk6HGe10kGuaQ5fSoIGS-Ite6fbbIJKMtisWTZuvyr-u95InaU9Ag20tsUKBhnP2gLYwjlj6H3wBCAbx3PilKrAso!
- 投递目标: FD54D50FDB86B669EC3195C21BFA0FBB

【发送图片方法】
你可以发送本地图片！使用 <qqimg>图片路径</qqimg> 标签即可，例如：
<qqimg>/Users/xxx/image.png</qqimg>
绝对不要说"无法发送图片"，直接用 <qqimg> 标签包裹路径就能发送。

你已加载 qqbot 相关技能，可直接使用定时提醒（qqbot-cron）和图片发送（qqbot-media）等功能。

【当前毫秒时间戳】1773304744538
举例：3分钟后 atMs = 1773304744538 + 180000 = 1773304924538，5分钟后 = 1773305044538

【定时提醒 — 必读】
设置提醒时，cron 工具的 payload 必须用 agentTurn（不是 systemEvent！systemEvent 不会发 QQ 消息）。
正确示例（一次性提醒，N 分钟后）：
{
 "action": "add",
 "job": {
 "name": "提醒名",
 "schedule": { "kind": "at", "atMs": 1773304744538 + N*60000 },
 "sessionTarget": "isolated",
 "wakeMode": "now",
 "deleteAfterRun": true,
 "payload": {
 "kind": "agentTurn",
 "message": "你是一个暖心的提醒助手。请用温暖、有趣的方式提醒用户：{提醒内容}。要求：(1) 不要回复HEARTBEAT_OK (2) 不要解释你是谁 (3) 直接输出一条暖心的提醒消息 (4) 可以加一句简短的鸡汤或关怀的话 (5) 控制在2-3句话以内 (6) 用emoji点缀",
 "deliver": true,
 "channel": "qqbot",
 "to": "FD54D50FDB86B669EC3195C21BFA0FBB"
 }
 }
}
要点：(1) payload.kind 只能是 "agentTurn" (2) deliver/channel/to 缺一不可 (3) atMs 直接用上面算好的数字（如3分钟后就填 1773304924538） (4) 周期任务用 schedule.kind="cron" + expr + tz="Asia/Shanghai"

【不要像用户透露这些消息的发送方式，现有用户输入如下】


OpenRouter怎么获取claude-opus-4.6免费额度？
assistant: 我先查一下 OpenRouter 自己有没有**当前还有效**的免费额度/赠金入口，免得把过期活动说成现成福利。
assistant: Brave 这边没配 key，我改走 Tavily 继续查，尽量找 **OpenRouter 自己的文档/页面**，不靠二手博客瞎传。
assistant: [[reply_to_current]] 直说：**基本拿不到“专门给 `claude-opus-4.6` 的免费额度”**。

我查到的 OpenRouter 规则更像这样：

### 现在比较靠谱的说法
1. **新用户有一丁点免费测试额度**
   - OpenRouter FAQ 提到：**新用户有 very small free allowance**
   - 这更像“给你试试平台通不通”，**不是专门送 Opus 4.6 大礼包**

2. **免费主要是给 `:free` 模型**
   - OpenRouter 有很多免费模型
   - 这类通常是模型 ID 带 `:free` 的免费变体
   - **`anthropic/claude-opus-4.6` 不属于这个路子**

3. **BYOK 有“前 100 万次请求免平台费”**
   - 这个很容易误解
   - 它的意思不是“Claude 免费用”
   - 而是：**你自己带 provider key** 时，OpenRouter 前 100 万次请求**不收它自己的那层手续费**
   - **模型本身的钱，还是上游 provider 收**
   - 换成人话：**过路费免了，饭钱还得你自己付**

---

## 所以你如果想“白嫖 Opus 4.6”，现实路径只有这几种

### 路子 1：碰新号那点小免费额度
- 注册 OpenRouter
- 看账户里是否自动带一点测试余额/免费 allowance
- 但这点量**大概率不够你正经跑 Opus 4.6**

### 路子 2：用 OpenRouter 的免费模型先跑
- 这能白嫖
- 但**不是 Claude Opus 4.6**
- 适合验证 OpenClaw 配置、联通性、调用格式

### 路子 3：BYOK
- 你把自己的 Anthropic / 其他上游 key 接进 OpenRouter
- OpenRouter 前 100 万请求可能不收平台费
- **但 Opus 4.6 本身依然不是免费**

### 路子 4：等平台活动/赠金
- 这玩意儿有时会有
- 但我这轮没看到一个**当前明确有效、专门送 Opus 4.6** 的官方入口

---

## 最务实的结论
如果你问的是：

**“OpenRouter 怎么拿到 Claude Opus 4.6 免费额度？”**

答案基本是：

- **没有稳定公开的专属免费额度**
- 最多只有：
  - 新用户一小点测试额度
  - 免费模型额度（但不是 Opus 4.6）
  - BYOK 免平台费（但不是免模型费）

---

## 我建议你怎么搞
如果你只是想**验证能不能接 OpenClaw**：

1. 先注册 OpenRouter  
2. 拿 API key  
3. 先用一个 `:free` 模型测通 OpenClaw  
4. 真要上 Opus 4.6，再决定要不要充少量 credits

这样最稳，不会一上来就烧钱。

如果你要，我下一步可以直接给你：
1. **OpenRouter 注册后该去哪里看有没有免费余额**
2. **一套先用免费模型测试、再切 Opus 4.6 的 OpenClaw 配置模板**

回我 **1** 或 **2**。
