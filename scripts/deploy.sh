#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env"
SERVICE_NAME="ai-team"
DEFAULT_PORT="3001"
HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-180}"
HEALTH_INTERVAL="${DEPLOY_HEALTH_INTERVAL:-3}"

cd "$ROOT_DIR"

has_command() {
  command -v "$1" >/dev/null 2>&1
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
  elif has_command docker-compose; then
    COMPOSE=(docker-compose)
  else
    echo "[deploy] docker compose / docker-compose 未安装。" >&2
    exit 1
  fi
}

COMPOSE=()
compose_cmd

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi
}

resolve_port() {
  if [[ -n "${PORT:-}" ]]; then
    echo "$PORT"
  else
    echo "$DEFAULT_PORT"
  fi
}

require_prereqs() {
  if ! has_command docker; then
    echo "[deploy] docker 未安装，请先安装 Docker。" >&2
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "[deploy] Docker daemon 不可用，请先启动 Docker。" >&2
    exit 1
  fi

  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "[deploy] 未找到 $COMPOSE_FILE" >&2
    exit 1
  fi
}

service_cid() {
  "${COMPOSE[@]}" -f "$COMPOSE_FILE" ps -q "$SERVICE_NAME"
}

service_state() {
  local cid
  cid="$(service_cid)"
  if [[ -z "$cid" ]]; then
    echo "not-created"
    return 0
  fi
  docker inspect -f '{{.State.Status}}' "$cid"
}

service_health() {
  local cid
  cid="$(service_cid)"
  if [[ -z "$cid" ]]; then
    echo "unknown"
    return 0
  fi
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$cid"
}

print_status() {
  load_env
  local port state health cid
  port="$(resolve_port)"
  state="$(service_state)"
  health="$(service_health)"
  cid="$(service_cid)"

  echo "[deploy] service: $SERVICE_NAME"
  echo "[deploy] state:   $state"
  echo "[deploy] health:  $health"
  if [[ -n "$cid" ]]; then
    echo "[deploy] cid:     $cid"
  fi
  echo "[deploy] url:     http://localhost:${port}"
  echo "[deploy] health:  http://localhost:${port}/health"

  "${COMPOSE[@]}" -f "$COMPOSE_FILE" ps "$SERVICE_NAME"
}

wait_for_healthy() {
  local deadline now state health
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))

  while true; do
    state="$(service_state)"
    health="$(service_health)"

    if [[ "$state" == "running" && "$health" == "healthy" ]]; then
      echo "[deploy] 健康检查通过。"
      return 0
    fi

    if [[ "$state" == "exited" || "$state" == "dead" ]]; then
      echo "[deploy] 容器状态异常: $state" >&2
      "${COMPOSE[@]}" -f "$COMPOSE_FILE" logs --tail=100 "$SERVICE_NAME" >&2 || true
      exit 1
    fi

    now=$(date +%s)
    if (( now >= deadline )); then
      echo "[deploy] 等待健康检查超时 (${HEALTH_TIMEOUT}s)。当前 state=$state health=$health" >&2
      "${COMPOSE[@]}" -f "$COMPOSE_FILE" logs --tail=100 "$SERVICE_NAME" >&2 || true
      exit 1
    fi

    echo "[deploy] 等待服务就绪... state=$state health=$health"
    sleep "$HEALTH_INTERVAL"
  done
}

deploy() {
  require_prereqs
  mkdir -p "$ROOT_DIR/state" "$ROOT_DIR/task_workspaces"
  echo "[deploy] 启动并构建服务..."
  "${COMPOSE[@]}" -f "$COMPOSE_FILE" up -d --build
  wait_for_healthy
  print_status
}

restart() {
  require_prereqs
  echo "[deploy] 重启服务..."
  "${COMPOSE[@]}" -f "$COMPOSE_FILE" restart "$SERVICE_NAME"
  wait_for_healthy
  print_status
}

stop() {
  require_prereqs
  echo "[deploy] 停止服务..."
  "${COMPOSE[@]}" -f "$COMPOSE_FILE" stop "$SERVICE_NAME"
  print_status
}

logs() {
  require_prereqs
  "${COMPOSE[@]}" -f "$COMPOSE_FILE" logs -f --tail=200 "$SERVICE_NAME"
}

status() {
  require_prereqs
  print_status
}

case "${1:-deploy}" in
  deploy|up)
    deploy
    ;;
  restart)
    restart
    ;;
  stop)
    stop
    ;;
  status)
    status
    ;;
  logs)
    logs
    ;;
  *)
    cat >&2 <<'EOF'
用法:
  bash scripts/deploy.sh           # 部署 / 更新
  bash scripts/deploy.sh restart   # 重启
  bash scripts/deploy.sh stop      # 停止
  bash scripts/deploy.sh status    # 状态
  bash scripts/deploy.sh logs      # 查看日志
EOF
    exit 1
    ;;
esac
