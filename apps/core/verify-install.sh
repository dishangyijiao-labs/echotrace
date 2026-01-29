#!/bin/bash
# Verify installation status

echo "======================================"
echo "Verify EchoTrace Core Installation"
echo "======================================"
echo ""

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "❌ Virtual environment does not exist"
    exit 1
fi

source .venv/bin/activate

echo "📌 Python version:"
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
python3 --version
if [ "$PYTHON_VERSION" != "3.12" ]; then
    echo ""
    echo "❌ Python version must be 3.12 (current: $PYTHON_VERSION)"
    exit 1
fi
echo ""

echo "📌 Installed key packages:"
echo ""

# Check base dependencies
echo "Base dependencies:"
python3 << 'PYEOF'
import sys
packages = {
    "fastapi": "FastAPI",
    "uvicorn": "Uvicorn",
    "pydantic": "Pydantic",
    "mcp": "MCP",
    "requests": "Requests"
}

for pkg, name in packages.items():
    try:
        __import__(pkg)
        print(f"   ✅ {name}")
    except ImportError:
        print(f"   ❌ {name} (not installed)")
PYEOF

echo ""
echo "faster-whisper related:"
python3 << 'PYEOF'
import sys
try:
    import faster_whisper
    from faster_whisper import WhisperModel
    print("   ✅ faster-whisper")
    print("   ✅ WhisperModel can be imported")
except ImportError as e:
    print(f"   ❌ faster-whisper: {e}")

try:
    import av
    print(f"   ✅ av (version: {av.__version__})")
    print("   ✅ Video processing available")
except ImportError:
    print("   ❌ av (not installed, video processing unavailable)")

try:
    import onnxruntime
    print(f"   ✅ onnxruntime (version: {onnxruntime.__version__})")
except ImportError:
    print("   ⚠️  onnxruntime (not installed, will use ctranslate2)")

try:
    import ctranslate2
    print(f"   ✅ ctranslate2 (available)")
except ImportError:
    print("   ⚠️  ctranslate2 (not installed)")
PYEOF

echo ""
echo "======================================"
echo "Installation Status Summary"
echo "======================================"
python3 << 'PYEOF'
import sys
all_ok = True

try:
    import faster_whisper
    import av
    print("✅ Full installation: faster-whisper + av (all features available)")
except ImportError as e:
    if "av" in str(e):
        print("⚠️  Partial installation: faster-whisper installed, but av not installed")
        print("   Audio transcription available, but video processing unavailable")
        all_ok = False
    else:
        print("❌ faster-whisper not properly installed")
        all_ok = False

if not all_ok:
    print("")
    print("To install av package, run:")
    print("  pip install av")
    print("Or re-run: ./install-python312.sh")
    sys.exit(1)
else:
    print("")
    print("🎉 All features properly installed!")
PYEOF

echo ""
