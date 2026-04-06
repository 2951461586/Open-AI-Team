# Personality Examples

这个目录展示如何给角色追加人格模板，而不破坏现有 `config/team/roles.json` 兼容性。

- 人格注册表：`config/team/personalities.json`
- 角色引用方式：在 role 配置里追加 `personality` 字段
- 运行时热更新：人格文件按 mtime 自动重载，无需重启进程

## 推荐接入方式

```json
{
  "planner": {
    "displayName": "规划师",
    "description": "接收任务，拆解为结构化执行计划",
    "personality": {
      "default": "planner",
      "active": "planner",
      "activeScenario": "default",
      "templates": ["planner"]
    }
  }
}
```

## 多人格场景切换

```json
{
  "executor": {
    "personality": {
      "default": "executor",
      "active": "executor",
      "activeScenario": "incident",
      "templates": ["executor"]
    }
  }
}
```

## 自定义扩展

参见：
- `custom-role-with-personality.json`
- `multi-personality-agent.json`
