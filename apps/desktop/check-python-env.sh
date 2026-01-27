#!/bin/bash
# 检查 Python 环境配置脚本

echo "======================================"
echo "检查 EchoTrace Python 环境"
echo "======================================"
echo ""

# 检查 Python 是否存在
echo "📌 步骤 1/4: 检查 Python"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "   ✅ 找到 Python: $PYTHON_VERSION"
else
    echo "   ❌ 未找到 Python3"
    echo "   请安装 Python 3.8+"
    exit 1
fi
echo ""

# 检查 Core 目录
echo "📌 步骤 2/4: 检查 Core 目录"
CORE_DIR="../core"
if [ -d "$CORE_DIR" ]; then
    echo "   ✅ Core 目录存在: $CORE_DIR"
else
    echo "   ❌ Core 目录不存在: $CORE_DIR"
    echo "   请确保项目结构完整"
    exit 1
fi
echo ""

# 检查虚拟环境
echo "📌 步骤 3/4: 检查 Python 虚拟环境"
if [ -d "$CORE_DIR/.venv" ]; then
    echo "   ✅ 虚拟环境存在"
    
    # 激活虚拟环境并检查依赖
    source "$CORE_DIR/.venv/bin/activate"
    
    # 检查关键依赖
    echo ""
    echo "   检查关键依赖..."
    DEPS=("fastapi" "uvicorn" "faster-whisper" "sqlite-fts4")
    ALL_OK=true
    
    for dep in "${DEPS[@]}"; do
        if python3 -c "import ${dep//-/_}" 2>/dev/null; then
            echo "   ✅ $dep"
        else
            echo "   ❌ $dep (未安装)"
            ALL_OK=false
        fi
    done
    
    if [ "$ALL_OK" = false ]; then
        echo ""
        echo "   ⚠️  缺少依赖，请运行:"
        echo "   cd $CORE_DIR && .venv/bin/pip install -r requirements.txt"
    fi
else
    echo "   ⚠️  虚拟环境不存在"
    echo ""
    echo "   创建虚拟环境并安装依赖:"
    echo "   cd $CORE_DIR"
    echo "   python3 -m venv .venv"
    echo "   source .venv/bin/activate"
    echo "   pip install -r requirements.txt"
fi
echo ""

# 检查数据库
echo "📌 步骤 4/4: 检查数据库"
if [ -f "$CORE_DIR/data/app.db" ]; then
    echo "   ✅ 数据库文件存在"
else
    echo "   ⚠️  数据库文件不存在（首次运行时会自动创建）"
fi
echo ""

echo "======================================"
echo "✅ 环境检查完成"
echo "======================================"
echo ""
echo "🚀 现在可以打包应用:"
echo "   ./rebuild-package.sh"
echo ""
