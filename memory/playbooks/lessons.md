# Lessons

## Auto-promoted notes

### Workspace package export drift can break runtime after pnpm relink
- Action: When touching workspace package consumers, verify package barrel exports match all runtime imports before restart. After any pnpm relink, run a targeted node import smoke test on the affected app entrypoints.
- Source: LRN-20260408-001

### 每日记忆复盘 cron 调用了不存在的脚本
- Action: 补齐 `scripts/daily-memory-review.sh`，或把 cron 任务改为调用仓库中真实存在的复盘入口；同时为 cron 命令增加脚本存在性检查。
- Source: ERR-20260408-001

### github-trending 定时任务引用了不存在的脚本路径
- Action: 为此类定时任务增加脚本存在性校验；将实际脚本路径写入任务配置或在仓库内补齐该脚本。
- Source: ERR-20260407-001

### mulerun-pool-watch command not found during cron巡检
- Action: Before relying on workspace/local CLIs in cron jobs, verify the binary exists in PATH or invoke it with an absolute path / wrapper script. If this is expected to be installed in a virtualenv/npm bin, update the cron command to source the environment first.
- Source: ERR-20260407-002

### mulerun-pool-watch cron failed because command was not found
- Action: Before relying on this cron, ensure `mulerun-pool-watch` is installed and available on PATH for the OpenClaw runtime user, or update the cron to invoke the correct absolute path / wrapper script.
- Source: ERR-20260407-003

### mulerun-pool-watch command unavailable during cron巡检
- Action: Verify mulerun-pool-watch is installed and on PATH for cron/agent environment, or invoke it via absolute path.
- Source: ERR-20260409-001
