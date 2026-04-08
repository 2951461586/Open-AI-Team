# `src/team/` 目录说明

`src/team/` 现在不是单一 authority 目录，而是一个 **mixed compatibility surface**。

## 现在该怎么理解

### 已完成 package flip 的覆盖面
对已经进入 `packages/team-runtime/` 的运行时/编排导出面：
- `src/team/*.mjs`
- `src/team/tl-runtime/*.mjs`
中的覆盖文件应视为 **compatibility shims**。

这些区域的新实现应进入：
- `packages/team-runtime/`

### 仍留在本地的非 package 面
目前仍主要包括：
- `query-api/*`
- repo-local docs/index/readme
- 指向 app/server-owned surface 的 compatibility seams
- 其它尚未正式进入 package 合同面的 team 子域

## 阅读建议

如果你想看当前主 runtime：
- 先读 `../../packages/team-runtime/README.md`
- 再读 `../../docs/architecture/current-team-runtime-architecture.md`

如果你想看当前 source inventory：
- 读 `./INDEX.md`

如果你想看 host/runtime adapter：
- 读 `../team-runtime-adapters/`

## 维护规则

- 不要把 package-owned surface 的新逻辑写回这里
- 这里的 README 只负责解释 mixed/compat 状态，不再承担主 runtime 文档角色
