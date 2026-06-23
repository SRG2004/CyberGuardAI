#!/usr/bin/env bash
# ============================================================
# CyberGuard AI — Start All Services
# Usage:  ./start.sh           (dev mode, all 3 services)
#         ./start.sh --only=backend
#         ./start.sh --only=ml
#         ./start.sh --only=frontend
#         ./start.sh --skip-install
# ============================================================
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${GREEN}[CyberGuard]${RESET} $*"; }
warn() { echo -e "${YELLOW}[WARN]${RESET} $*"; }
err()  { echo -e "${RED}[ERROR]${RESET} $*"; }
info() { echo -e "${CYAN}[INFO]${RESET} $*"; }

# ─── Directories ─────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
ML_DIR="$ROOT_DIR/ml-service"
FRONTEND_DIR="$ROOT_DIR/cyberguard-ui"

# ─── Parse flags ──────────────────────────────────────────
ONLY=""
SKIP_INSTALL=false
for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY="${arg#*=}" ;;
    --skip-install) SKIP_INSTALL=true ;;
  esac
done

should_run() {
  [[ -z "$ONLY" || "$ONLY" == "$1" ]]
}

# ─── PID tracking for cleanup ────────────────────────────
PIDS=()

cleanup() {
  log "Shutting down all services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  log "All services stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM

# ─── Prerequisite checks ──────────────────────────────────
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    err "$1 is required but not installed."
    exit 1
  fi
}

# ─── Install dependencies ─────────────────────────────────
install_deps() {
  # Backend
  if should_run backend || should_run frontend; then
    if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
      log "Installing backend dependencies..."
      (cd "$BACKEND_DIR" && npm install)
    else
      info "Backend node_modules already present."
    fi
  fi

  # Frontend
  if should_run frontend; then
    if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
      log "Installing frontend dependencies..."
      (cd "$FRONTEND_DIR" && npm install)
    else
      info "Frontend node_modules already present."
    fi
  fi

  # ML service
  if should_run ml; then
    check_cmd python3
    check_cmd pip3
    if ! python3 -c "import fastapi" 2>/dev/null; then
      log "Installing ML service Python dependencies..."
      (cd "$ML_DIR" && pip3 install -r requirements.txt)
    else
      info "Python dependencies already installed."
    fi
  fi
}

# ─── Create required directories ──────────────────────────
mkdir -p "$BACKEND_DIR/logs" "$BACKEND_DIR/uploads" "$ML_DIR/models" "$ML_DIR/data"

# ─── Check for .env ───────────────────────────────────────
if [[ ! -f "$ROOT_DIR/.env" ]]; then
  warn ".env not found. Creating from .env.example..."
  warn "Edit $ROOT_DIR/.env with your actual API keys before starting."
  if [[ -f "$ROOT_DIR/.env.example" ]]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  fi
fi

# Copy .env into backend for the dotenv loader
cp "$ROOT_DIR/.env" "$BACKEND_DIR/.env"

# ─── Start services ───────────────────────────────────────
start_backend() {
  info "Starting backend API on port 5000..."
  (cd "$BACKEND_DIR" && NODE_ENV=development node --watch src/server.js) &
  PIDS+=($!)
}

start_ml() {
  info "Starting ML service on port 8001..."
  (cd "$ML_DIR" && python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload) &
  PIDS+=($!)
}

start_frontend() {
  info "Starting frontend dev server on port 3000..."
  (cd "$FRONTEND_DIR" && npm run dev) &
  PIDS+=($!)
}

# ─── Main ────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   🛡️  CyberGuard AI — Startup Script      ║${RESET}"
echo -e "${BOLD}╚════════════════════════════════════════════╝${RESET}"
echo ""

if [[ "$SKIP_INSTALL" != true ]]; then
  install_deps
fi

echo ""

if should_run backend; then
  start_backend
  sleep 1
fi

if should_run ml; then
  start_ml
  sleep 1
fi

if should_run frontend; then
  start_frontend
fi

echo ""
log "All services started. PIDs: ${PIDS[*]}"
log ""
log "  Backend   -> http://localhost:5000"
log "  ML Service-> http://localhost:8001"
log "  Frontend  -> http://localhost:3000"
log ""
log "  Health check: curl http://localhost:5000/health"
log "  ML health:    curl http://localhost:8001/health"
log ""
info "Press Ctrl+C to stop all services."

# Wait for any process to exit
wait
