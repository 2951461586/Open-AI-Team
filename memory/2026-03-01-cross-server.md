# 跨服务器 Agent 通信配置记录（2026-03-01）

## 方案
- SSH 密钥 + `openclaw gateway call agent`
- 两台 Gateway 都保持 loopback 绑定，不暴露端口
- Auth token 存储于 `/root/.openclaw/credentials/` 目录（权限 600）

## 两台服务器
- **牢大🏀** Laoda：119.91.63.250，Agent ID: laoda，QQ Bot AppID: 102853382
- **Violet🪻** 薇尔莉特：116.140.211.73，Agent ID: violet，QQ Bot AppID: 102864124

## 配置安全架构同步状态（2026-03-02）
- 两节点均已部署完整的安全修改架构（immutable 锁 + 5 分钟回滚保险丝）
- 详细文档：`memory/topics/openclaw-config.md`

## 测试结果（2026-03-01）
- ✅ 牢大→Violet：成功
- ✅ Violet→牢大：成功

## SSH 认证
- 双向 ed25519 密钥认证（无密码，无 sshpass）
- Host key 已固化到 known_hosts（严格校验，不用 StrictHostKeyChecking=no）

## Violet 给牢大发消息
```bash
IDEM_KEY="violet-to-laoda-$(date +%s)"
LAODA_TOKEN=$(cat /root/.openclaw/credentials/laoda-gateway-token)
ssh root@119.91.63.250 \
  "export PATH=/root/.nvm/versions/node/v22.22.0/bin:\$PATH && \
   openclaw gateway call agent \
   --token ${LAODA_TOKEN} \
   --params '{\"message\":\"你的消息\",\"idempotencyKey\":\"'${IDEM_KEY}'\",\"agentId\":\"laoda\"}' \
   --json --timeout 60000"
```

## 牢大给 Violet 发消息
```bash
IDEM_KEY="laoda-to-violet-$(date +%s)"
VIOLET_TOKEN=$(cat /root/.openclaw/credentials/violet-gateway-token)
ssh root@116.140.211.73 \
  "export PATH='/root/.nvm/versions/node/v22.22.0/bin:\$PATH' && \
   openclaw gateway call agent \
   --token ${VIOLET_TOKEN} \
   --params '{\"message\":\"你的消息\",\"idempotencyKey\":\"'${IDEM_KEY}'\",\"agentId\":\"violet\"}' \
   --json --timeout 60000"
```

## 注意事项
- 不加 --expect-final 为 fire-and-forget 模式（推荐）
- 加 --expect-final 等待回复，目标忙时可能超时
- idempotencyKey 必须唯一
- Token 从文件读取，不硬编码
