#!/bin/bash
# Install EchoTrace Core dependencies (Python 3.12 + av support)
# Usage: cd apps/core && ./install-python312.sh

set -e

echo "======================================"
echo "Install EchoTrace Core Dependencies (Python 3.12 + av)"
echo "======================================"
echo ""

# Check Python version
echo "📌 Checking Python version..."
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
        echo ""
        echo "   Please install Python 3.12:"
        echo "   Method 1 (using pyenv):"
        echo "     pyenv install 3.12.7"
        echo "     pyenv local 3.12.7"
        echo ""
        echo "   Method 2 (using Homebrew):"
        echo "     brew install python@3.12"
        echo ""
        exit 1
    fi
else
    echo "   ❌ Python 3.12 not found"
    echo "   Please install Python 3.12 first"
    exit 1
fi

# Verify Python version
PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
if [ "$PYTHON_VERSION" != "3.12" ]; then
    echo "   ❌ Python version mismatch: $PYTHON_VERSION, requires 3.12"
    exit 1
fi

echo "   Using: $PYTHON_CMD ($($PYTHON_CMD --version))"
echo ""

# Check/create virtual environment
echo "📌 Configuring virtual environment..."
if [ -d ".venv" ]; then
    echo "   Virtual environment exists, checking Python version..."
    VENV_PYTHON=$(.venv/bin/python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
    if [ "$VENV_PYTHON" != "3.12" ]; then
        echo "   ⚠️  Virtual environment uses Python $VENV_PYTHON, requires 3.12"
        echo "   Removing old virtual environment..."
        rm -rf .venv
        echo "   Creating new virtual environment with Python 3.12..."
        $PYTHON_CMD -m venv .venv
    else
        echo "   ✅ Virtual environment uses Python 3.12"
    fi
else
    echo "   Creating virtual environment (Python 3.12)..."
    $PYTHON_CMD -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate
echo "   ✅ Virtual environment activated"
echo ""

# Upgrade pip
echo "📌 Step 1/5: Upgrading pip..."
pip install --upgrade pip setuptools wheel
echo ""

# Check FFmpeg
echo "📌 Step 2/5: Checking FFmpeg (required for av package)..."
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n1)
    echo "   ✅ FFmpeg installed: $FFMPEG_VERSION"
else
    echo "   ⚠️  FFmpeg not found, av package requires it"
    echo "   Installing FFmpeg..."
    if command -v brew &> /dev/null; then
        brew install ffmpeg
        echo "   ✅ FFmpeg installation completed"
    else
        echo "   ❌ Homebrew not found, please install FFmpeg manually:"
        echo "      brew install ffmpeg"
        echo "   Or visit: https://ffmpeg.org/download.html"
        exit 1
    fi
fi
echo ""

# Install build dependencies
echo "📌 Step 3/5: Installing build dependencies..."
pip install Cython numpy
echo "   ✅ Build dependencies installed"
echo ""

# Install base dependencies
echo "📌 Step 4/5: Installing base dependencies..."
pip install fastapi uvicorn[standard] pydantic mcp requests
echo "   ✅ Base dependencies installed"
echo ""

# Clean previous attempts
echo "📌 Cleaning previous installation attempts..."
pip uninstall -y faster-whisper onnxruntime av 2>/dev/null || true
echo ""

# Install faster-whisper (with av)
echo "📌 Step 5/5: Installing faster-whisper (with av support)..."
echo "   This may take a few minutes (av package needs to be compiled)..."

# Try installing onnxruntime first (if available)
echo "   Attempting to install onnxruntime..."
if pip install "onnxruntime>=1.14.0,<2.0.0" 2>/dev/null; then
    echo "   ✅ onnxruntime installed successfully"
    ONNXRUNTIME_AVAILABLE=true
else
    echo "   ⚠️  onnxruntime not available, will use ctranslate2"
    ONNXRUNTIME_AVAILABLE=false
fi

# Install faster-whisper (full version with av)
echo "   Installing faster-whisper (full version)..."
if pip install faster-whisper 2>&1 | tee /tmp/faster-whisper-install.log; then
    echo "   ✅ faster-whisper installed successfully"
    
    # Verify if av package is installed
    echo "   Verifying av package..."
    if python3 -c "import av" 2>/dev/null; then
        echo "   ✅ av package included in faster-whisper"
    else
        echo "   ⚠️  av package not auto-installed, installing manually..."
        if pip install av; then
            echo "   ✅ av package installed successfully"
        else
            echo "   ⚠️  av package installation failed, but faster-whisper core functionality is available"
            echo "   If av functionality is needed, ensure FFmpeg is installed: brew install ffmpeg"
        fi
    fi
else
    echo "   ⚠️  Full installation failed, trying step-by-step installation..."
    
    # Step-by-step installation
    echo "   Installing tokenizers and ctranslate2..."
    pip install tokenizers ctranslate2
    
    echo "   Installing faster-whisper (core)..."
    pip install faster-whisper --no-deps || {
        echo "   ❌ faster-whisper installation failed"
        exit 1
    }
    
    echo "   Installing av package (required)..."
    echo "   This may take a few minutes (needs compilation)..."
    if pip install av; then
        echo "   ✅ av package installed successfully"
    else
        echo "   ❌ av package installation failed"
        echo "   Please check:"
        echo "   1. FFmpeg is installed: brew install ffmpeg"
        echo "   2. Build dependencies are installed: pip install Cython numpy"
        echo "   3. Using Python 3.12 (not 3.13 or 3.14)"
        echo ""
        echo "   If issues persist, you can install separately later: pip install av"
        exit 1
    fi
fi

echo ""

# Verify installation
echo "======================================"
echo "🧪 Verifying installation..."
echo "======================================"
python3 << 'PYEOF'
import sys
errors = []
warnings = []

try:
    import fastapi
    print("✅ FastAPI")
except ImportError as e:
    errors.append(f"FastAPI: {e}")

try:
    import uvicorn
    print("✅ Uvicorn")
except ImportError as e:
    errors.append(f"Uvicorn: {e}")

try:
    import faster_whisper
    print("✅ faster-whisper")
    
    # 测试是否可以创建模型
    try:
        from faster_whisper import WhisperModel
        print("   ✅ WhisperModel 可以导入")
    except Exception as e:
        warnings.append(f"WhisperModel: {e}")
except ImportError as e:
    errors.append(f"faster-whisper: {e}")

try:
    import av
    print("✅ av (视频处理支持)")
except ImportError as e:
    warnings.append(f"av: {e} (视频处理功能可能不可用)")

if errors:
    print("\n❌ 以下依赖安装失败:")
    for err in errors:
        print(f"   - {err}")
    sys.exit(1)

if warnings:
    print("\n⚠️  Warnings:")
    for warn in warnings:
        print(f"   - {warn}")

print("\n✅ All core dependencies installed!")
PYEOF

echo ""
echo "======================================"
echo "✅ Installation completed!"
echo "======================================"
echo ""
echo "📝 Installed features:"
echo "   ✅ Python 3.12"
echo "   ✅ faster-whisper (audio transcription)"
if [ "$ONNXRUNTIME_AVAILABLE" = "true" ]; then
    echo "   ✅ onnxruntime (model inference)"
fi
echo "   ✅ FFmpeg (video/audio processing)"
echo ""
echo "🚀 You can now run the application:"
echo "   python app.py"
echo ""
