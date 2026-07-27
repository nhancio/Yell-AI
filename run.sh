#!/bin/bash
# Yell AI — Local Development Runner
# Usage: ./run.sh

set -e

echo "🗣️  Starting Yell AI locally..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env with your actual API keys before running."
    exit 1
fi

# Docker publishes Postgres on host 5433 and Redis on 6380 (see docker-compose.yml) so
# Homebrew services on 5432/6379 do not need to be stopped for ./run.sh.

echo "🐳 Starting Redis & PostgreSQL..."
if ! docker info >/dev/null 2>&1; then
    echo "⚠️  Docker does not appear to be running. Start Docker Desktop (or the Docker daemon), then rerun."
    exit 1
fi

docker compose down --remove-orphans 2>/dev/null || true

if ! docker compose up -d redis postgres; then
    echo "⚠️  Docker Compose failed to start redis/postgres (see output above)."
    exit 1
fi

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 3

# Determine python interpreter (prefer 3.11 because asyncpg fails with 3.13)
PYTHON_CANDIDATES=(python3.11 python3)
PYTHON_CMD=""
for candidate in "${PYTHON_CANDIDATES[@]}"; do
    if command -v "$candidate" >/dev/null 2>&1; then
        PYTHON_CMD="$candidate"
        break
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "⚠️  No Python 3 interpreter found. Install Python 3.11+ and rerun."
    exit 1
fi
PYTHON_VERSION=$($PYTHON_CMD -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
if [ "$PYTHON_VERSION" = "3.13" ] && command -v python3.11 >/dev/null 2>&1; then
    PYTHON_CMD=python3.11
    PYTHON_VERSION=$($PYTHON_CMD -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
fi
# asyncpg>=0.31 has wheels for 3.13; older asyncpg failed to compile from source on 3.13.

# Recreate venv if it was built with a different Python (e.g. old 3.13 venv while we now prefer 3.11)
if [ -d "backend/.venv" ] && [ -x "backend/.venv/bin/python" ]; then
    VENV_VER=$(backend/.venv/bin/python -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    WANT_VER=$($PYTHON_CMD -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    if [ "$VENV_VER" != "$WANT_VER" ]; then
        echo "🐍 Replacing backend/.venv (was Python $VENV_VER, need $WANT_VER)..."
        rm -rf backend/.venv
    fi
fi

if [ ! -d "backend/.venv" ]; then
    echo "🐍 Creating Python virtual environment with $PYTHON_CMD..."
    "$PYTHON_CMD" -m venv backend/.venv
fi

# Activate venv and install deps
source backend/.venv/bin/activate
pip install -q -r backend/requirements.txt

# Start Frontend setup
echo "💻 Setting up Yell AI Frontend..."
cd frontend
npm install
npx prisma generate
npx prisma db push
cd ..

# Free typical dev ports if a previous Yell / uvicorn / Next run is still listening
listen_pids_on_port() {
    local port=$1
    lsof -nP -i :"$port" 2>/dev/null | grep LISTEN | awk '{print $2}' | sort -u
}

free_listen_port() {
    local port=$1
    local name=$2
    local pids
    pids=$(listen_pids_on_port "$port" | tr '\n' ' ')
    if [ -z "$pids" ]; then
        return 0
    fi
    echo "⚠️  Port $port ($name) in use; stopping listener(s): $pids"
    local pid
    for pid in $pids; do
        kill "$pid" 2>/dev/null || true
    done
    sleep 0.5
    pids=$(listen_pids_on_port "$port" | tr '\n' ' ')
    for pid in $pids; do
        kill -9 "$pid" 2>/dev/null || true
    done
}

echo "🔌 Ensuring ports 3000 (Next.js) and 8000 (backend) are free..."
free_listen_port 3000 "Next.js"
free_listen_port 8000 "Backend"

# Run the server
echo ""
echo "🚀 Yell AI Backend is running at http://localhost:8000"
echo "🌐 Yell AI Web App is running at http://localhost:3000"
echo "📱 WhatsApp webhook: http://localhost:8000/webhook"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start frontend in background and backend in foreground
(cd frontend && npm run dev) &
FRONTEND_PID=$!

cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Cleanup when done
kill $FRONTEND_PID 2>/dev/null || true
