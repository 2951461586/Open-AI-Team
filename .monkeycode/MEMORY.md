# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [代码结构|代码模式|代码生成|构建方法|测试方法|依赖关系|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[项目深度分析]
- Date: 2026-04-16
- Context: 深度扫描 AI Team Runtime 项目
- Category: 代码结构
- Instructions:
  - monorepo 结构：packages/* + apps/*
  - 后端 API Server: apps/api-server (Node.js 原生 HTTP，端口 19090)
  - 前端 Dashboard: dashboard/ (Next.js 14，输出静态文件)
  - API 路径前缀混乱：/api/、/state/team/、/internal/team/
  - 命名不统一：snake_case 与 camelCase 混用

[OpenHanako 参考架构]
- Date: 2026-04-16
- Context: 用户提供 OpenHanako 作为重构参考
- Category: 代码结构
- Instructions:
  - Electron 桌面应用打包 exe
  - Hono + @hono/node-server 替代原生 HTTP
  - React 19 + Zustand
  - better-sqlite3 (WAL mode)
  - 插件系统架构
  - 多平台桥接（Telegram、飞书、QQ、微信）

[重构需求]
- Date: 2026-04-16
- Context: 用户要求统一 API 接口并进行重构优化
- Category: 代码模式
- Instructions:
  - 统一 API 路径前缀（建议 /api/v1/）
  - 统一命名规范（全部使用 camelCase）
  - 参考 OpenHanako 使用 Hono 框架
  - 支持 exe 安装部署方式
  - 前后端分离但统一管理
