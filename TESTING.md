# TESTING.md

本项目测试基础设施保持纯 Node.js、零额外 npm 依赖。

## 目录结构

- `tests/unit/` — 单元测试
- `tests/integration/` — 集成测试
- `tests/fixtures/` — 测试数据
- `tests/helpers/` — 测试辅助工具
- `scripts/test-runner.mjs` — 轻量测试 runner

## 设计原则

- 使用 Node.js 内置 `assert/strict`
- 不引入 Jest / Vitest / Mocha
- 所有测试可独立运行
- 不依赖外部服务
- 涉及网络/外部调用时必须 mock
- 测试文件应通过 `node --check`

## 命令

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:watch
```

## Runner 特性

`scripts/test-runner.mjs` 支持：

- 自动发现 `tests/` 下所有 `.test.mjs`
- `--pattern <text>` 过滤路径
- 简洁 TAP 风格输出
- `--watch` 监听模式

示例：

```bash
node scripts/test-runner.mjs --pattern unit
node scripts/test-runner.mjs --pattern integration
node scripts/test-runner.mjs --watch
```

## 新增测试建议

1. 优先测试纯函数、状态机、契约转换逻辑
2. 集成测试聚焦模块协作，不碰真实外部系统
3. 固定输入放在 `tests/fixtures/`
4. 通用临时目录、stub、in-memory store 放在 `tests/helpers/`
5. 测试应避免依赖执行顺序

## 当前覆盖的核心模块

### Unit
- Event Bus
- Sandbox / PathGuard
- Tool Runtime
- Personality System
- Agent Desk

### Integration
- TL Workflow（direct-reply 路径）
- Task Lifecycle / Agent Lifecycle

## 语法校验

可用如下命令校验测试与 runner 文件语法：

```bash
find tests scripts/test-runner.mjs -name '*.mjs' -print0 | xargs -0 -n1 node --check
```

## 注意

当前自定义 runner 提供最小测试 API：

- `test(name, fn)` / `it(name, fn)`
- `describe(name, fn)`
- `beforeEach(fn)`
- `afterEach(fn)`

它刻意保持轻量，目标是为仓库建立稳定、低维护成本的测试底座，而不是复制完整测试框架。
