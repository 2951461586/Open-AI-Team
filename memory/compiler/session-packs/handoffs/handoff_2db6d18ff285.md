# Session Handoff — handoff_2db6d18ff285

## Focus
- 继续完善 source-first 的 recall 升级策略

## Primary Thread
- OpenHanako vs OpenClaw 记忆架构比较

## Decisions
- 精确问答先回源再答
- 不走 MVP，直接按完整优化方案推进
- 不展开 UI 设计，优先实现编译器与运行时注入层
- Precise scene remains source-first.

## Unresolved Risks
- 若只有摘要层而没有 source-first escalation，后续容易漂移
- 如果 thread 不做 aging，会越积越脏

## Next Actions
- 补足 precise scene selector
- 实现 digest compiler
- 实现 runtime selector
- 后续再接 LCM / memory-lancedb
- Verify runtime selector source mix diagnostics.
- 继续接 LCM / memory-lancedb 适配

## Summary
Focus: 继续完善 source-first 的 recall 升级策略
Primary thread: OpenHanako vs OpenClaw 记忆架构比较
Decisions: 精确问答先回源再答 | 不走 MVP，直接按完整优化方案推进 | 不展开 UI 设计，优先实现编译器与运行时注入层 | Precise scene remains source-first.
Open risks: 若只有摘要层而没有 source-first escalation，后续容易漂移 | 如果 thread 不做 aging，会越积越脏
Next actions: 补足 precise scene selector | 实现 digest compiler | 实现 runtime selector | 后续再接 LCM / memory-lancedb | Verify runtime selector source mix diagnostics. | 继续接 LCM / memory-lancedb 适配
Escalation: lcm-on-demand+source-leaning

## Source Refs
- sum:sum_0fe296000a893a83
- file:/root/.openclaw/workspace/SESSION-STATE.md
- file:/root/.openclaw/workspace/memory/2026-03-20.md
- sum:sum_4e6742ae47a210c5
- artifact:test:blocked-promotion
- artifact:test:blocked-promotion-review
- file:/root/.openclaw/workspace/reports/openclaw-memory-compiler/MASTERPLAN.md
- file:/root/.openclaw/workspace/reports/openclaw-memory-compiler/OPERATOR-REVIEW-FLOW.md
- file:/root/.openclaw/workspace/memory/2026-03-21.md
- file:/root/.openclaw/workspace/memory/working-buffer.md
- session:accept-burnin-session
