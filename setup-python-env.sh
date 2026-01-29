#!/bin/bash
# Setup EchoTrace Python environment

set -e

echo "======================================"
echo "Setup EchoTrace Python Environment"
echo "======================================"
echo ""

cd "$(dirname "$0")/apps/core"

# Check Python 3.12
echo "📌 Step 1/4: Check Python 3.12 (required)"
PYTHON_CMD=""
if command -v python3.12 &> /dev/null; then
    PYTHON_CMD="python3.12"
    echo "   ✅ Found python3.12"
elif command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
    if [ "$PYTHON_VERSION" = "3.12" ]; then
        PYTHON_CMD="python3"
        echo "   ✅ Current python3 is version 3.12"
    else
        echo "   ❌ Current Python version is $PYTHON_VERSION, requires 3.12"
        echo "   Please install Python 3.12:"
        echo "   - Using pyenv: pyenv install 3.12.7 && pyenv local 3.12.7"
        echo "   - Using Homebrew: brew install python@3.12"
        exit 1
    fi
else
    echo "   ❌ Python3 not found, please install Python 3.12 first"
    echo "   - Using pyenv: pyenv install 3.12.7"
    echo "   - Using Homebrew: brew install python@3.12"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version)
echo "   Using: $PYTHON_VERSION"
echo ""

# Create/rebuild virtual environment
echo "📌 Step 2/4: Configure virtual environment (Python 3.12)"
if [ -d ".venv" ]; then
    echo "   Virtual environment exists, checking Python version..."
    if [ -f ".venv/bin/python3" ]; then
        VENV_VERSION=$(.venv/bin/python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
        if [ "$VENV_VERSION" != "3.12" ]; then
            echo "   ⚠️  Virtual environment uses Python $VENV_VERSION, requires 3.12"
            echo "   Removing old virtual environment..."
            rm -rf .venv
            echo "   Creating new virtual environment with Python 3.12..."
            $PYTHON_CMD -m venv .venv
        else
            echo "   ✅ Virtual environment uses Python 3.12"
        fi
    else
        echo "   ⚠️  Virtual environment incomplete, recreating..."
        rm -rf .venv
        $PYTHON_CMD -m venv .venv
    fi
else
    echo "   Creating virtual environment (Python 3.12)..."
    $PYTHON_CMD -m venv .venv
fi
echo ""

# Upgrade pip
echo "📌 Step 3/4: Upgrade pip"
.venv/bin/pip install --upgrade pip setuptools wheel
echo ""

# Install dependencies
echo "📌 Step 4/4: Install dependencies (with av support)"
echo ""
echo "   Using Python 3.12 specific installation script..."
if [ -f "install-python312.sh" ]; then
    ./install-python312.sh
else
    echo "   ❌ Missing install-python312.sh, please check repository files are complete"
    exit 1
fi

echo ""
read -p "   Install RAG/Agent dependencies? (optional, enables AI search features) [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Installing RAG dependencies (requirements-rag.txt)..."
    .venv/bin/pip install -r requirements-rag.txt
fi

echo ""
echo "======================================"
echo "✅ Python environment setup completed!"
echo "======================================"
echo ""
echo "🧪 Testing environment:"
echo ""

# Test importing key libraries
echo "   Testing key dependencies..."
.venv/bin/python3 << 'PYEOF'
import sys
try:
    import fastapi
    print("   ✅ FastAPI")
    import uvicorn
    print("   ✅ Uvicorn")
    import faster_whisper
    print("   ✅ faster-whisper")
    print("\n   ✅ All core dependencies installed!")
except ImportError as e:
    print(f"\n   ❌ Missing dependency: {e}")
    sys.exit(1)
PYEOF

echo ""
echo "🚀 You can now:"
echo "   1. Rebuild the app: cd ../desktop && ./rebuild-package.sh"
echo "   2. Or manually start services for testing: .venv/bin/python3 app.py"
echo ""
