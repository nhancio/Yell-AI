#!/usr/bin/env bash
#
# Stop everything started by ./run.sh: the Next.js frontend (port 3000),
# the FastAPI backend / uvicorn (port 8000), and the Docker-Compose
# Redis/Postgres services it brings up.
#
# Usage: ./stop.sh [--keep-docker] [-h|--help]
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

KEEP_DOCKER=0
for arg in "$@"; do
  case "$arg" in
    --keep-docker) KEEP_DOCKER=1 ;;
    -h|--help)
      echo "Usage: ./stop.sh [--keep-docker]"
      echo "  Stops the Next.js frontend (3000) and FastAPI backend (8000)."
      echo "  Also stops the Docker Redis/Postgres containers from docker-compose.yml"
      echo "  unless --keep-docker is passed."
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)"
      exit 1
      ;;
  esac
done

is_our_process() {
  local pid="$1"
  local cmd
  cmd="$(ps -ww -p "$pid" -o command= 2>/dev/null || true)"
  [[ -z "$cmd" ]] && return 1
  [[ "$cmd" == *"$ROOT"* ]] && return 0
  [[ "$cmd" == *"uvicorn app.main:app"* ]] && return 0
  [[ "$cmd" == *"/frontend/"*"next"* ]] && return 0
  return 1
}

kill_pid_gracefully() {
  local pid="$1"
  local label="$2"
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  echo "  stopping $label (pid $pid)"
  kill -TERM "$pid" 2>/dev/null || true
}

wait_pid_gone() {
  local pid="$1"
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.3
  done
  kill -KILL "$pid" 2>/dev/null || true
}

kill_port() {
  local port="$1"
  local label="$2"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  local pids
  pids="$(lsof -ti ":$port" 2>/dev/null || true)"
  [ -z "$pids" ] && return 0
  local killed=0
  for pid in $pids; do
    if is_our_process "$pid"; then
      kill_pid_gracefully "$pid" "$label :$port"
      wait_pid_gone "$pid"
      killed=1
    fi
  done
  if [ "$killed" = 0 ] && [ -n "$pids" ]; then
    echo "  port $port in use by non-Astra-AI process(es); left running"
  fi
}

kill_by_pattern() {
  local pattern="$1"
  local label="$2"
  local pids
  pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
  [ -z "$pids" ] && return 0
  for pid in $pids; do
    if is_our_process "$pid"; then
      kill_pid_gracefully "$pid" "$label"
      wait_pid_gone "$pid"
    fi
  done
}

stop_docker_services() {
  if [ "$KEEP_DOCKER" = 1 ]; then
    echo "  keeping Docker Redis/Postgres (--keep-docker)"
    return 0
  fi
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    return 0
  fi
  if [ ! -f "docker-compose.yml" ]; then
    return 0
  fi
  docker compose stop redis postgres >/dev/null 2>&1 || true
  echo "  stopped Docker redis/postgres containers"
}

echo "================================================="
echo "Stopping Astra AI"
echo "================================================="

echo "Backend / uvicorn (port 8000)..."
kill_port 8000 "uvicorn"
kill_by_pattern "${ROOT}/backend/.venv/bin/.*uvicorn app.main:app" "uvicorn"

echo "Frontend / Next.js (port 3000)..."
kill_port 3000 "next dev"
kill_by_pattern "${ROOT}/frontend.*next" "next dev"

echo "Docker Redis (6380) / Postgres (5433)..."
stop_docker_services

echo ""
echo "Done. Astra AI services should be stopped."
if command -v lsof >/dev/null 2>&1; then
  remaining=""
  for port in 3000 8000; do
    if lsof -ti ":$port" >/dev/null 2>&1; then
      remaining="${remaining} ${port}"
    fi
  done
  if [ -n "$remaining" ]; then
    echo "Note: port(s) still in use:${remaining} (may be another app)."
  fi
fi
