# agent-harness-core

## 状态

`src/agent-harness-core/` 现在是 **兼容入口层**，不再是 standalone harness substrate 的实现 authority。

当前真实 authority 已迁到：

- `packages/agent-harness/`

## 这里保留什么

- 兼容 import 路径
- 兼容脚本入口路径
- 兼容资产路径（如 manifest / package / seccomp）

## 不要再做什么

- 不要在这里继续新增独立实现逻辑
- 新的 harness substrate 变更应进入 `packages/agent-harness/`

## 当前主线判断

- **`packages/agent-harness/` 是 standalone broker substrate 的 canonical baseline authority。**
- `src/agent-harness-core/` 仅保留为 compatibility shim / compatibility asset surface。
- `examples/oss-minimal/` 继续保留为 **wrapper / regression facade / runnable sample**。
- 产品 bootstrap 仍可通过兼容 surface 接入 standalone broker substrate。
- OpenHanako 风格的独立 agent 接入面（`session / desk / plugin / bridge / shell`）继续属于正式产品主口径，但实现 authority 已迁到 package 面。
