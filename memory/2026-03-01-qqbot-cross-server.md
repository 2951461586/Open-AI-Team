# QQ Bot 跨服消息投递踩坑记录（2026-03-01）

## openid 按 bot 隔离
同一用户在不同 bot 下 openid 完全不同：
- 牢大 bot (102853382): `B0327EA1F0D8E074CC336F80BF4E7C05`
- Violet bot (102864124): `FD54D50FDB86B669EC3195C21BFA0FBB`

跨服通信时必须使用**目标 bot** 下的 openid。

## message 工具 bug
通过 `gateway call agent` 调用时，`message` 工具无论用 `target` 还是 `to` 参数都报 "to required"。
`deliver: true` 模式也未能成功投递到 QQ。

## 可行方案：直接调 QQ Bot REST API
```bash
ACCESS_TOKEN=$(curl -s -X POST https://bots.qq.com/app/getAppAccessToken \
  -H 'Content-Type: application/json' \
  -d '{"appId":"见配置","clientSecret":"见配置"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

curl -s -X POST "https://api.sgroup.qq.com/v2/users/<openid>/messages" \
  -H "Authorization: QQBot ${ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"content":"消息内容","msg_type":0}'
```

## QQ Bot 消息限制
- 私聊主动消息：每月 4 条/用户
- 被动回复窗口：60 分钟，每条最多回 5 次
- 群聊主动消息：每月 4 条/群
- 群聊被动回复窗口：5 分钟

## 已知用户记录
`/root/.openclaw/qqbot/data/known-users.json`
