# Errors

Append structured entries:
- ERR-YYYYMMDD-XXX for command/tool/integration failures
- Include symptom, context, probable cause, and prevention


## [ERR-20260408-001]

**Logged**: 2026-04-08T15:30:00Z
**Priority**: medium
**Status**: pending
**Area**: docs

### Summary
每日记忆复盘 cron 调用了不存在的脚本

### Details
本次 daily-memory-review 任务要求执行 `/root/.openclaw/workspace/scripts/daily-memory-review.sh`，但仓库内不存在该脚本；shell 返回 `No such file or directory`。仓库中实际存在的是 `scripts/promote_learnings_to_lessons.py` 等零散复盘辅助脚本，因此本次只能改为手动执行提炼与提交流程。

### Suggested Action
补齐 `scripts/daily-memory-review.sh`，或把 cron 任务改为调用仓库中真实存在的复盘入口；同时为 cron 命令增加脚本存在性检查。

### Metadata
- Source: daily-memory-review cron run
---


## [ERR-20260407-001]

**Logged**: 2026-04-07T01:01:01.753Z
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
github-trending 定时任务引用了不存在的脚本路径

### Details
Cron 指向 /root/.openclaw/workspace/scripts/github-trending.py，但该文件不存在；在 workspace 内搜索 *trending* 也未找到对应脚本。已改用网页抓取作为补救路径。

### Suggested Action
为此类定时任务增加脚本存在性校验；将实际脚本路径写入任务配置或在仓库内补齐该脚本。

### Metadata
- Source: memory-lancedb-pro/self_improvement_log
---


## [ERR-20260407-002]

**Logged**: 2026-04-07T02:32:17.473Z
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
mulerun-pool-watch command not found during cron巡检

### Details
Cron task requested running `mulerun-pool-watch check` in /root/.openclaw/workspace. Shell returned `/usr/bin/bash: line 1: mulerun-pool-watch: command not found`.

### Suggested Action
Before relying on workspace/local CLIs in cron jobs, verify the binary exists in PATH or invoke it with an absolute path / wrapper script. If this is expected to be installed in a virtualenv/npm bin, update the cron command to source the environment first.

### Metadata
- Source: memory-lancedb-pro/self_improvement_log
---


## [ERR-20260407-003]

**Logged**: 2026-04-07T04:01:00.037Z
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
mulerun-pool-watch cron failed because command was not found

### Details
Cron task requested running `mulerun-pool-watch check` in /root/.openclaw/workspace. Shell returned `/usr/bin/bash: line 1: mulerun-pool-watch: command not found`. A follow-up `command -v mulerun-pool-watch` and filesystem search found no installed binary in the environment.

### Suggested Action
Before relying on this cron, ensure `mulerun-pool-watch` is installed and available on PATH for the OpenClaw runtime user, or update the cron to invoke the correct absolute path / wrapper script.

### Metadata
- Source: memory-lancedb-pro/self_improvement_log
---
