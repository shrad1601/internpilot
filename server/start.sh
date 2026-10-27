#!/bin/zsh
# Kill any existing instance on the port first
lsof -ti :8765 | xargs kill -9 2>/dev/null || true
exec /Users/shrad1601/.local/bin/uv run uvicorn internpilot.main:app --host 127.0.0.1 --port 8765 2>&1
