#!/bin/bash
# 快速安装 EchoTrace 依赖（使用国内镜像）

set -e

echo "======================================"
echo "快速安装 EchoTrace（国内镜像加速）"
echo "======================================"
echo ""

cd "$(dirname "$0")/apps/core"

# 清华镜像源
MIRROR="https://pypi.tuna.tsinghua.edu.cn/simple"

# 检查 Python 3.12
if ! command -v python3.12 &> /dev/null; then
    echo "❌ 未找到 Python 3.12"
    exit 1
fi

echo "✅ Python 版本: $(python3.12 --version)"
echo ""

# 清理旧环境
if [ -d ".venv" ]; then
    echo "📌 清理旧环境..."
    rm -rf .venv
fi

# 创建虚拟环境
echo "📌 创建虚拟环境（Python 3.12）..."
python3.12 -m venv .venv
source .venv/bin/activate

# 升级 pip
echo "📌 升级 pip..."
pip install --upgrade pip -i $MIRROR

echo ""
echo "======================================"
echo "📦 安装核心依赖（使用清华镜像）"
echo "======================================"
echo ""

# 安装核心依赖
echo "→ FastAPI..."
pip install fastapi -i $MIRROR

echo "→ Uvicorn..."
pip install uvicorn -i $MIRROR

echo "→ Pydantic..."
pip install pydantic -i $MIRROR

echo "→ Requests..."
pip install requests -i $MIRROR

echo "→ MCP..."
pip install mcp -i $MIRROR

echo "→ faster-whisper（这个较大，请稍候）..."
pip install faster-whisper -i $MIRROR

echo ""
echo "======================================"
echo "✅ 核心依赖安装完成！"
echo "======================================"
echo ""

# 测试
echo "测试导入..."
python -c "import fastapi; print('✅ FastAPI')"
python -c "import uvicorn; print('✅ Uvicorn')"
python -c "import faster_whisper; print('✅ faster-whisper')"

echo ""
read -p "是否安装 RAG/Agent 依赖？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "======================================"
    echo "📦 安装 RAG 依赖"
    echo "======================================"
    echo ""
    
    pip install -r requirements-rag.txt -i $MIRROR
    
    echo ""
    echo "测试 RAG 导入..."
    python -c "import langchain; print('✅ LangChain')"
    python -c "import chromadb; print('✅ ChromaDB')"
    python -c "import sentence_transformers; print('✅ Sentence Transformers')"
fi

echo ""
echo "======================================"
echo "🎉 安装完成！"
echo "======================================"
echo ""
echo "Python 版本: $(python --version)"
echo ""
echo "下一步："
echo "  1. 测试 Core API: python app.py"
echo "  2. 测试 Worker: python worker.py"
echo "  3. 打包应用: cd ../desktop && ./rebuild-package.sh"
echo ""
