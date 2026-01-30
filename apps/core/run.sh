#!/bin/bash
# Universal Python runner for EchoTrace Core
# Usage: ./run.sh [app.py|worker.py]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="${1:-app.py}"

# Try different Python sources in order of preference
if [ -f "$SCRIPT_DIR/.venv/bin/python3" ]; then
    # Linux/Mac virtual environment
    exec "$SCRIPT_DIR/.venv/bin/python3" "$SCRIPT_DIR/$PYTHON_SCRIPT"
elif [ -f "$SCRIPT_DIR/.venv/Scripts/python.exe" ]; then
    # Windows virtual environment
    exec "$SCRIPT_DIR/.venv/Scripts/python.exe" "$SCRIPT_DIR/$PYTHON_SCRIPT"
elif command -v python3.12 >/dev/null 2>&1; then
    # System Python 3.12
    exec python3.12 "$SCRIPT_DIR/$PYTHON_SCRIPT"
elif command -v python3 >/dev/null 2>&1; then
    # Generic system Python 3
    exec python3 "$SCRIPT_DIR/$PYTHON_SCRIPT"
else
    echo "Error: Python not found. Please install Python 3.12 or set up a virtual environment."
    exit 1
fi
