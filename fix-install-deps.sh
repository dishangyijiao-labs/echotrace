#!/bin/bash
# Fix and install Python dependencies for Apple Silicon

set -e

echo "======================================"
echo "Installing EchoTrace Dependencies"
echo "(Apple Silicon Optimized)"
echo "======================================"
echo ""

cd "$(dirname "$0")/apps/core"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found"
    exit 1
fi

# Create/verify virtual environment
if [ ! -d ".venv" ]; then
    echo "📌 Creating virtual environment..."
    python3 -m venv .venv
fi

echo "📌 Upgrading pip..."
.venv/bin/pip install --upgrade pip setuptools wheel

echo ""
echo "📌 Installing dependencies for Apple Silicon..."
echo ""

# Install dependencies one by one for better error handling
echo "→ Installing FastAPI..."
.venv/bin/pip install "fastapi>=0.115.0"

echo "→ Installing Uvicorn..."
.venv/bin/pip install "uvicorn[standard]>=0.32.0"

echo "→ Installing Pydantic..."
.venv/bin/pip install "pydantic>=2.10.0"

echo "→ Installing requests..."
.venv/bin/pip install "requests>=2.32.0"

echo "→ Installing MCP..."
.venv/bin/pip install "mcp>=1.20.0"

# Install faster-whisper (includes onnxruntime for Apple Silicon)
echo "→ Installing faster-whisper..."
# Use --only-binary to prefer prebuilt wheels
.venv/bin/pip install "faster-whisper>=1.0.0" --only-binary=:all: || \
.venv/bin/pip install "faster-whisper>=1.0.0"

echo ""
echo "======================================"
echo "✅ Core Dependencies Installed!"
echo "======================================"
echo ""

# Test imports
echo "Testing imports..."
.venv/bin/python3 << 'PYEOF'
import sys
try:
    import fastapi
    print("✅ FastAPI")
    import uvicorn
    print("✅ Uvicorn")
    import faster_whisper
    print("✅ faster-whisper")
    print("\n✅ All core dependencies working!")
except ImportError as e:
    print(f"\n❌ Import error: {e}")
    sys.exit(1)
PYEOF

echo ""
read -p "Install RAG/Agent dependencies? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📌 Installing RAG dependencies..."
    .venv/bin/pip install -r requirements-rag.txt
    
    echo ""
    echo "Testing RAG imports..."
    .venv/bin/python3 << 'PYEOF'
import sys
try:
    import langchain
    print("✅ LangChain")
    import chromadb
    print("✅ ChromaDB")
    print("\n✅ RAG dependencies working!")
except ImportError as e:
    print(f"\n❌ Import error: {e}")
    sys.exit(1)
PYEOF
fi

echo ""
echo "======================================"
echo "🎉 Installation Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Start Core API: .venv/bin/python3 app.py"
echo "  2. Start Worker: .venv/bin/python3 worker.py"
echo "  3. Or build desktop app: cd ../desktop && ./rebuild-package.sh"
echo ""
