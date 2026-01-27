#!/bin/bash
# Install EchoTrace dependencies with Python 3.12

set -e

echo "======================================"
echo "Installing EchoTrace with Python 3.12"
echo "======================================"
echo ""

cd "$(dirname "$0")/apps/core"

# Check for Python 3.12
if ! command -v python3.12 &> /dev/null; then
    echo "❌ Python 3.12 not found!"
    echo ""
    echo "Please install Python 3.12:"
    echo "  brew install python@3.12"
    exit 1
fi

PYTHON_VERSION=$(python3.12 --version)
echo "✅ Found $PYTHON_VERSION"
echo ""

# Clean old environment
if [ -d ".venv" ]; then
    echo "📌 Removing old virtual environment..."
    rm -rf .venv
fi

# Create new environment with Python 3.12
echo "📌 Creating virtual environment with Python 3.12..."
python3.12 -m venv .venv

# Activate
source .venv/bin/activate

echo "📌 Upgrading pip..."
pip install --upgrade pip setuptools wheel

echo ""
echo "📌 Installing core dependencies..."
pip install fastapi uvicorn pydantic requests mcp

echo ""
echo "📌 Installing faster-whisper..."
pip install faster-whisper

echo ""
echo "======================================"
echo "✅ Core Dependencies Installed!"
echo "======================================"
echo ""

# Test
echo "Testing imports..."
python -c "import fastapi; print('✅ FastAPI')"
python -c "import uvicorn; print('✅ Uvicorn')"
python -c "import faster_whisper; print('✅ faster-whisper')"

echo ""
read -p "Install RAG/Agent dependencies? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📌 Installing RAG dependencies..."
    pip install -r requirements-rag.txt
    
    echo ""
    echo "Testing RAG imports..."
    python -c "import langchain; print('✅ LangChain')"
    python -c "import chromadb; print('✅ ChromaDB')"
fi

echo ""
echo "======================================"
echo "🎉 Installation Complete!"
echo "======================================"
echo ""
echo "Python version: $(python --version)"
echo ""
echo "Next steps:"
echo "  1. Test Core API: python app.py"
echo "  2. Test Worker: python worker.py"
echo "  3. Build desktop: cd ../desktop && ./rebuild-package.sh"
echo ""
