# Session Handoff — handoff_8496f5b3f88a

## Focus
- 继续完善 source-first 的 recall 升级策略

## Primary Thread
- 记忆编译层适配层建设

## Decisions
- 精确问答先回源再答
- 不另起野路子，沿现有 contracts/backlinks/control-plane 演进

## Unresolved Risks
- source coverage 长期过窄会让 derived layer 失真

## Next Actions
- 补足 precise scene selector
- 补齐 workspace/session-state adapter
- 刷新 control-plane 验证多源 coverage
- Check source backlinks and runtime source mix after import.
- 继续接 LCM / memory-lancedb 适配
- 验证 source backlinks 已覆盖 file / memory-item / session

## Summary
Focus: 继续完善 source-first 的 recall 升级策略
Primary thread: 记忆编译层适配层建设
Decisions: 精确问答先回源再答 | 不另起野路子，沿现有 contracts/backlinks/control-plane 演进
Open risks: source coverage 长期过窄会让 derived layer 失真
Next actions: 补足 precise scene selector | 补齐 workspace/session-state adapter | 刷新 control-plane 验证多源 coverage | Check source backlinks and runtime source mix after import. | 继续接 LCM / memory-lancedb 适配 | 验证 source backlinks 已覆盖 file / memory-item / session
Escalation: lcm-on-demand+source-leaning+artifact-first

## Source Refs
- sum:sum_0fe296000a893a83
- file:/root/.openclaw/workspace/SESSION-STATE.md
- file:/root/.openclaw/workspace/memory/2026-03-20.md
- sum:sum_4e6742ae47a210c5
- artifact:test:blocked-promotion
- artifact:test:blocked-promotion-review
- file:/root/.openclaw/workspace/plugins/memory-compiler/docs/MASTERPLAN.md
- file:/root/.openclaw/workspace/reports/openclaw-memory-compiler/MASTERPLAN.md
- file:/root/.openclaw/workspace/plugins/memory-compiler/docs/OPERATOR-REVIEW-FLOW.md
- file:/root/.openclaw/workspace/reports/openclaw-memory-compiler/OPERATOR-REVIEW-FLOW.md
- file:/root/.openclaw/workspace/memory/2026-03-21.md
- file:/root/.openclaw/workspace/memory/working-buffer.md
- session:accept-burnin-session
