#!/bin/bash
# 配置 EchoTrace Python 环境

set -e

echo "======================================"
echo "配置 EchoTrace Python 环境"
echo "======================================"
echo ""

cd "$(dirname "$0")/apps/core"

# 检查 Python
echo "📌 步骤 1/4: 检查 Python"
if ! command -v python3 &> /dev/null; then
    echo "   ❌ Python3 未找到，请先安装 Python 3.8+"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo "   ✅ $PYTHON_VERSION"
echo ""

# 创建/重建虚拟环境
echo "📌 步骤 2/4: 配置虚拟环境"
if [ -d ".venv" ]; then
    echo "   虚拟环境已存在，检查完整性..."
    if [ ! -f ".venv/bin/python3" ]; then
        echo "   ⚠️  虚拟环境不完整，重新创建..."
        rm -rf .venv
        python3 -m venv .venv
    else
        echo "   ✅ 虚拟环境完整"
    fi
else
    echo "   创建虚拟环境..."
    python3 -m venv .venv
fi
echo ""

# 升级 pip
echo "📌 步骤 3/4: 升级 pip"
.venv/bin/pip install --upgrade pip
echo ""

# 安装依赖
echo "📌 步骤 4/4: 安装依赖"
echo ""
echo "   安装基础依赖 (requirements.txt)..."
.venv/bin/pip install -r requirements.txt

echo ""
read -p "   是否安装 RAG/Agent 依赖? (可选，支持 AI 搜索功能) [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   安装 RAG 依赖 (requirements-rag.txt)..."
    .venv/bin/pip install -r requirements-rag.txt
fi

echo ""
echo "======================================"
echo "✅ Python 环境配置完成！"
echo "======================================"
echo ""
echo "🧪 测试环境:"
echo ""

# 测试导入关键库
echo "   测试关键依赖..."
.venv/bin/python3 << 'PYEOF'
import sys
try:
    import fastapi
    print("   ✅ FastAPI")
    import uvicorn
    print("   ✅ Uvicorn")
    import faster_whisper
    print("   ✅ faster-whisper")
    print("\n   ✅ 所有核心依赖已安装！")
except ImportError as e:
    print(f"\n   ❌ 缺少依赖: {e}")
    sys.exit(1)
PYEOF

echo ""
echo "🚀 现在可以："
echo "   1. 重新打包应用: cd ../desktop && ./rebuild-package.sh"
echo "   2. 或手动启动服务测试: .venv/bin/python3 app.py"
echo ""
