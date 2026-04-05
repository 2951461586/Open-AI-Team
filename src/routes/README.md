# `src/routes/` 目录说明

## 目录职责

集中存放 orchestrator 入口层 route adapter：

- `index-routes-health-state.mjs`
- `index-routes-team.mjs`
- `index-routes-entry.mjs`

## 维护原则

- route 层只做 surface adapter / auth / parse / response。
- 不要把 runtime 聚合逻辑堆进 routes。
- 新增 index route，优先放进本目录，而不是回到 `src/` 根目录。
