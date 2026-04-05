# AI Team OSS Minimal Wrapper / Regression Facade

## 目标

`examples/oss-minimal/` 当前不再承载 standalone broker substrate 的主定义。

它现在的职责是：

- 作为 **wrapper / regression facade / runnable sample**
- 为 `src/agent-harness-core/` 的产品化 standalone runtime 提供稳定、易运行的样例入口
- 保留 `.runs/`、`run-demo.mjs`、targeted smoke、crash-resume 验收这类低摩擦回归面

## 当前 authority 关系

| 层 | 当前定位 | 权威性 |
|---|---|---|
| `src/agent-harness-core/` | standalone broker substrate canonical baseline | **主 authority** |
| `examples/oss-minimal/` | wrapper / regression facade / runnable sample | **从 authority** |

## facade 暴露面

| 文件 | 当前角色 |
|---|---|
| `run-demo.mjs` | 稳定演示入口，继续用于 targeted smoke / crash-resume 回归 |
| `standalone-bootstrap.mjs` | 薄 wrapper，转调 `src/agent-harness-core/standalone-product-runtime.mjs` |
| `agent-shell.mjs` | 薄 wrapper，转调产品 shell，并注入 facade package path |
| `agent-manifest.json` | facade manifest，保留样例身份与 `.shared/.runs` 本地路径 |
| `agent-package.json` | facade package，保留样例 persona/CLI 视图 |

## 运行目录

| 项 | 路径 |
|---|---|
| Runs Root | `examples/oss-minimal/.runs/` |
| Shared Authority | `examples/oss-minimal/.shared/` |
| Workspace | `examples/oss-minimal/.runs/<run-id>/workspace` |

## 如何理解这一层

- **看产品定义、合同、正式 substrate 能力**：优先看 `src/agent-harness-core/`
- **跑 demo、做 targeted smoke、看 crash-resume 样例运行面**：用 `examples/oss-minimal/`
- 这层继续有价值，但价值在 **易运行 / 易观察 / 易回归**，不在“主定义”

## 常用命令

### 产品入口（P2）

```bash
npm run demo:oss-minimal
npm run status:oss-minimal
npm run doctor:oss-minimal
npm run validate:agent-package
```

### 细粒度命令

```bash
node examples/oss-minimal/run-demo.mjs
node examples/oss-minimal/run-demo.mjs --start-only
node examples/oss-minimal/run-demo.mjs --resume <runDir> --steps 2 --stream
node examples/oss-minimal/run-demo.mjs --resume <runDir> --drain --stream

node examples/oss-minimal/agent-shell.mjs package
node examples/oss-minimal/agent-shell.mjs status latest
node examples/oss-minimal/agent-shell.mjs doctor latest
node examples/oss-minimal/agent-shell.mjs status <runDir>
node examples/oss-minimal/agent-shell.mjs doctor <runDir>

node scripts/team/team-oss-minimal-smoke.mjs
node scripts/team/team-oss-minimal-crash-resume-smoke.mjs
```

## 当前结论

- `examples/oss-minimal/` 已收回为 **wrapper / regression facade**
- `src/agent-harness-core/` 才是 **standalone broker execution substrate 的 canonical baseline authority**
- 这层仍然保留完整样例操作体验，用于 DeerFlow / OpenHanako 向对标时的低摩擦回归与演示
- 若你是新外部贡献者，先看 `../README.md` 与 `../GETTING-STARTED.md`
