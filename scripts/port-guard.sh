#!/usr/bin/env bash
# 端口治理 — orchestrator 启动前清理野进程
# 由 systemd ExecStartPre 调用
set -uo pipefail
PORT="${ORCH_PORT:-19090}"
for pid in $(lsof -ti :"$PORT" 2>/dev/null || true); do
  echo "[port-guard] killing rogue PID $pid on :$PORT"
  kill "$pid" 2>/dev/null || true
done
sleep 0.5
exit 0
