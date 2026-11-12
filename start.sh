#!/usr/bin/env bash
# OsseusAI — dev launcher
# Usage: bash start.sh
set -e

CONDA_ENV=vsp_proj
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "╔══════════════════════════════════════╗"
echo "║         OsseusAI — Starting          ║"
echo "╚══════════════════════════════════════╝"

# 1. Backend
echo "[1/2] Starting FastAPI (port 8000)..."
mkdir -p /tmp/osseus-data
cd "$BACKEND_DIR"
conda run -n $CONDA_ENV uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info \
  > /tmp/osseus-backend.log 2>&1 &
sleep 2
echo "     Backend ✓  (logs: /tmp/osseus-backend.log)"

# 2. Frontend
echo "[2/2] Starting Next.js (port 3000)..."
cd "$FRONTEND_DIR"
npm run dev > /tmp/osseus-frontend.log 2>&1 &
sleep 3
echo "     Frontend ✓  (logs: /tmp/osseus-frontend.log)"

echo ""
echo "  → http://localhost:3000"
echo ""
echo "  Logs: /tmp/osseus-{backend,frontend}.log"
echo "  Stop: kill \$(cat /tmp/osseus-pids.txt)"
echo ""
{ jobs -p; } > /tmp/osseus-pids.txt 2>/dev/null || true
