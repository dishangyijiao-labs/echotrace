#!/bin/bash
# Install RAG/Agent dependencies for EchoTrace

set -e

echo "======================================"
echo "Installing RAG/Agent Dependencies"
echo "======================================"
echo ""

cd "$(dirname "$0")/apps/core"

# Check virtual environment
if [ ! -f ".venv/bin/python3" ]; then
    echo "❌ Virtual environment not found!"
    echo "Please run: ./setup-python-env.sh first"
    exit 1
fi

echo "📌 Installing RAG dependencies..."
echo ""

# Upgrade pip first
.venv/bin/pip install --upgrade pip

# Install RAG requirements
.venv/bin/pip install -r requirements-rag.txt

echo ""
echo "======================================"
echo "✅ RAG Dependencies Installed!"
echo "======================================"
echo ""

# Test imports
echo "Testing dependencies..."
.venv/bin/python3 << 'PYEOF'
import sys
try:
    import langchain
    print("✅ LangChain")
    import chromadb
    print("✅ ChromaDB")
    import sentence_transformers
    print("✅ Sentence Transformers")
    print("\n✅ All RAG dependencies installed successfully!")
except ImportError as e:
    print(f"\n❌ Missing dependency: {e}")
    sys.exit(1)
PYEOF

echo ""
echo "🎉 You can now use AI Search features!"
echo ""
