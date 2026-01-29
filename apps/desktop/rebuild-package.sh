#!/bin/bash
# EchoTrace rebuild package script
# Usage: cd apps/desktop && ./rebuild-package.sh

set -e  # Exit on error

echo "======================================"
echo "EchoTrace Rebuild Package Script"
echo "======================================"
echo ""

# Check Python environment
echo "📌 Pre-check: Python environment"
if [ ! -d "../core/.venv" ]; then
    echo "   ⚠️  Warning: Core Python virtual environment does not exist"
    echo "   Packaged app requires Python 3.12 environment to run"
    echo ""
    echo "   Recommended to run first:"
    echo "   - cd ../core && ./install-python312.sh"
    echo "   - Or from project root: ./setup-python-env.sh"
    echo ""
    read -p "   Continue packaging? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    if [ -f "../core/.venv/bin/python3" ]; then
        VENV_VERSION=$(../core/.venv/bin/python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
        if [ "$VENV_VERSION" != "3.12" ]; then
            echo "   ❌ Core virtual environment uses Python $VENV_VERSION, requires 3.12"
            echo "   Please recreate virtual environment: cd ../core && ./install-python312.sh"
            exit 1
        fi
        echo "   ✅ Python 3.12 environment configured"
    else
        echo "   ⚠️  Core virtual environment incomplete (.venv/bin/python3 missing)"
        echo "   Recommended to run: cd ../core && ./install-python312.sh"
        echo ""
        read -p "   Continue packaging? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi
echo ""

# Check Node.js version
echo "📌 Step 1/5: Check Node.js version"
NODE_VERSION=$(node --version)
echo "   Current version: $NODE_VERSION"

# Check if version meets requirements (needs v20.19+ or v22.12+)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "   ❌ Error: Node.js version too low, requires v20.19+ or v22.12+"
    echo "   Please run: brew upgrade node"
    exit 1
fi
echo "   ✅ Node.js version meets requirements"
echo ""

# Clean old build artifacts
echo "📌 Step 2/5: Clean old build artifacts"
echo "   Cleaning node_modules..."
rm -rf node_modules
echo "   Cleaning package-lock.json..."
rm -rf package-lock.json
echo "   Cleaning dist..."
rm -rf dist
echo "   Cleaning old Tauri bundle..."
rm -rf src-tauri/target/release/bundle
echo "   ✅ Cleanup completed"
echo ""

# Reinstall dependencies
echo "📌 Step 3/5: Install dependencies"
echo "   Running npm install (using taobao mirror for speed)..."
npm install --registry=https://registry.npmmirror.com
echo "   ✅ Dependencies installed"
echo ""

# Build frontend
echo "📌 Step 4/5: Build frontend"
echo "   Running npm run build..."
npm run build
echo "   ✅ Frontend build completed"
echo ""

# Package Tauri app
echo "📌 Step 5/6: Package Tauri app"
echo "   Running npm run tauri build..."
echo "   ⏳ This may take a few minutes..."
npm run tauri build
echo "   ✅ Tauri app packaging completed"
echo ""

# Pre-download Base model (optional)
echo "📌 Step 6/7: Pre-download Base model (optional)"
echo "   This will download the Base model (~142MB) so users don't need to download it on first launch."
echo "   Note: This will increase the app bundle size."
read -p "   Pre-download and include Base model? (y/N) " -n 1 -r
echo
PRE_DOWNLOAD_MODEL=false
if [[ $REPLY =~ ^[Yy]$ ]]; then
    PRE_DOWNLOAD_MODEL=true
    echo "   Pre-downloading Base model..."
    cd ../core
    if [ -f ".venv/bin/python3" ]; then
        source .venv/bin/activate
        python3 << 'PYEOF'
from pipeline.model_manager import download_model, is_model_downloaded
import sys

model = "base"
if is_model_downloaded(model):
    print(f"   ✅ Base model already downloaded")
    sys.exit(0)

print(f"   Downloading Base model (this may take a few minutes)...")
success = download_model(model, progress_callback=lambda msg: print(f"   {msg}"))
if success:
    print(f"   ✅ Base model downloaded successfully")
    sys.exit(0)
else:
    print(f"   ⚠️  Failed to download Base model, will download on first launch")
    sys.exit(1)
PYEOF
        cd - > /dev/null
    else
        echo "   ⚠️  Virtual environment not found, skipping model pre-download"
        echo "   Users will need to download the model on first launch"
    fi
else
    echo "   Skipping model pre-download (users will download on first launch)"
fi
echo ""

# Copy Core directory to app bundle
echo "📌 Step 7/7: Copy Core directory to app bundle"
APP_BUNDLE="src-tauri/target/release/bundle/macos/EchoTrace.app"
if [ -d "$APP_BUNDLE" ]; then
    RESOURCES_DIR="$APP_BUNDLE/Contents/Resources"
    echo "   Creating Resources directory..."
    mkdir -p "$RESOURCES_DIR"
    
    echo "   Copying core directory to app bundle..."
    # Check if rsync is available, otherwise use cp
    if command -v rsync &> /dev/null; then
        # Use rsync to copy, excluding unnecessary files
        rsync -av --exclude='__pycache__' \
              --exclude='*.pyc' \
              --exclude='*.pyo' \
              --exclude='.git' \
              --exclude='logs/*.log' \
              --exclude='data/staging/*.wav' \
              --exclude='data/embeddings_cache' \
              "../core/" "$RESOURCES_DIR/core/"
    else
        # Use cp to copy (slower but more compatible)
        echo "   Using cp to copy (rsync not available)..."
        cp -R "../core" "$RESOURCES_DIR/"
        # Clean up unnecessary files
        find "$RESOURCES_DIR/core" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
        find "$RESOURCES_DIR/core" -type f -name "*.pyc" -delete 2>/dev/null || true
        find "$RESOURCES_DIR/core" -type f -name "*.pyo" -delete 2>/dev/null || true
    fi
    
    # Copy pre-downloaded model if available
    if [ "$PRE_DOWNLOAD_MODEL" = true ]; then
        MODEL_CACHE="$HOME/.cache/huggingface/hub/models--Systran--faster-whisper-base"
        if [ -d "$MODEL_CACHE" ] && [ "$(ls -A $MODEL_CACHE 2>/dev/null)" ]; then
            echo "   Copying pre-downloaded Base model to app bundle..."
            BUNDLE_MODEL_DIR="$RESOURCES_DIR/core/models/base"
            mkdir -p "$BUNDLE_MODEL_DIR"
            if command -v rsync &> /dev/null; then
                rsync -av "$MODEL_CACHE/" "$BUNDLE_MODEL_DIR/"
            else
                cp -R "$MODEL_CACHE"/* "$BUNDLE_MODEL_DIR/" 2>/dev/null || true
            fi
            if [ -d "$BUNDLE_MODEL_DIR" ] && [ "$(ls -A $BUNDLE_MODEL_DIR 2>/dev/null)" ]; then
                echo "   ✅ Base model copied to app bundle (~142MB)"
                echo "   Users won't need to download on first launch"
            else
                echo "   ⚠️  Failed to copy model, users will download on first launch"
            fi
        else
            echo "   ⚠️  Model not found in cache, users will download on first launch"
        fi
    fi
    
    # Verify key files exist
    if [ -f "$RESOURCES_DIR/core/app.py" ] && [ -f "$RESOURCES_DIR/core/worker.py" ]; then
        echo "   ✅ Core directory copied to app bundle"
        echo "   Location: $RESOURCES_DIR/core"
        
        # Check Python virtual environment
        if [ -f "$RESOURCES_DIR/core/.venv/bin/python3" ]; then
            echo "   ✅ Python virtual environment included"
        else
            echo "   ⚠️  Warning: Python virtual environment not found"
            echo "   App may not be able to auto-start services"
        fi
    else
        echo "   ❌ Error: Core directory copy failed, key files missing"
        exit 1
    fi
else
    echo "   ⚠️  Warning: App bundle not found, skipping Core directory copy"
fi
echo ""

# Display packaging results
echo "======================================"
echo "🎉 Packaging successful!"
echo "======================================"
echo ""
echo "📦 Package artifacts location:"
echo ""

if [ -f "src-tauri/target/release/bundle/dmg/EchoTrace_0.1.0_aarch64.dmg" ]; then
    DMG_SIZE=$(ls -lh src-tauri/target/release/bundle/dmg/EchoTrace_0.1.0_aarch64.dmg | awk '{print $5}')
    echo "   ✅ DMG installer:"
    echo "      src-tauri/target/release/bundle/dmg/EchoTrace_0.1.0_aarch64.dmg"
    echo "      Size: $DMG_SIZE"
    echo ""
fi

if [ -d "src-tauri/target/release/bundle/macos/EchoTrace.app" ]; then
    echo "   ✅ macOS app:"
    echo "      src-tauri/target/release/bundle/macos/EchoTrace.app"
    echo ""
fi

echo "======================================"
echo "🧪 Test the app:"
echo "======================================"
echo ""
echo "Method 1: Run .app directly"
echo "   open src-tauri/target/release/bundle/macos/EchoTrace.app"
echo ""
echo "Method 2: Install DMG"
echo "   open src-tauri/target/release/bundle/dmg/EchoTrace_0.1.0_aarch64.dmg"
echo ""
echo "✅ App includes Core services, will auto-start on launch"
echo "   No need to manually start Core and Worker services"
echo ""
