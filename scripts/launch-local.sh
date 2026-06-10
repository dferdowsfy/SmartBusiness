#!/bin/zsh
# SmartPR Local Launch Script
# Starts the frontend (Next.js demo) and optional backend (FastAPI) for testing the designed platform.
# Usage: ./scripts/launch-local.sh
# Or simply type `smartpr` after adding the alias (see below).

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "🚀 Starting SmartPR Local Development Environment"
echo "Project: $PROJECT_ROOT"
echo ""

# --- Frontend (always) ---
echo "→ Starting Next.js frontend on http://localhost:3000 ..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

# --- Backend (optional but recommended) ---
if [ -d "$BACKEND_DIR/.venv" ]; then
  echo "→ Starting FastAPI backend on http://localhost:8000 ..."
  cd "$BACKEND_DIR"
  source .venv/bin/activate
  uvicorn main:app --reload --port 8000 &
  BACKEND_PID=$!
  echo "   (Backend PID: $BACKEND_PID)"
else
  echo "⚠️  Backend virtualenv not found. Run the setup steps in the README to enable the real backend."
  BACKEND_PID=""
fi

echo ""
echo "✅ SmartPR is running locally for testing."
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000 (if started)"
echo ""
echo "Press Ctrl+C to stop both servers."

# Wait for user interrupt
trap "echo 'Stopping SmartPR servers...'; kill $FRONTEND_PID 2>/dev/null || true; [ -n '$BACKEND_PID' ] && kill $BACKEND_PID 2>/dev/null || true; exit" INT TERM
wait
