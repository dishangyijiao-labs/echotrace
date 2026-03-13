#!/bin/bash
# EchoTrace rebuild package script
# Usage: cd apps/desktop && ./rebuild-package.sh

set -e

echo "======================================"
echo "EchoTrace Rebuild Package Script"
echo "======================================"
echo ""

# Step 1: Check Node.js version
echo "Step 1/5: Check Node.js version"
NODE_VERSION=$(node --version)
echo "  Current version: $NODE_VERSION"
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "  Error: Node.js version too low, requires v20.19+ or v22.12+"
    exit 1
fi
echo "  Node.js version OK"
echo ""

# Step 2: Bundle dependencies (Python, FFmpeg, model)
echo "Step 2/5: Bundle dependencies"
./bundle-deps.sh
echo ""

# Step 3: Clean old build artifacts
echo "Step 3/5: Clean old build artifacts"
rm -rf node_modules package-lock.json dist src-tauri/target/release/bundle
echo "  Cleanup completed"
echo ""

# Step 4: Install dependencies & build frontend
echo "Step 4/5: Install dependencies & build frontend"
npm install --registry=https://registry.npmmirror.com
npm run build
echo "  Frontend build completed"
echo ""

# Step 5: Package Tauri app
echo "Step 5/5: Package Tauri app"
echo "  This may take a few minutes..."
npm run tauri build
echo "  Tauri app packaging completed"
echo ""

# Display results
echo "======================================"
echo "Packaging successful!"
echo "======================================"
echo ""
echo "Package artifacts:"

DMG_FILE=$(ls src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null | head -1)
if [ -n "$DMG_FILE" ]; then
    DMG_SIZE=$(ls -lh "$DMG_FILE" | awk '{print $5}')
    echo "  DMG: $DMG_FILE ($DMG_SIZE)"
fi

APP_BUNDLE=$(ls -d src-tauri/target/release/bundle/macos/*.app 2>/dev/null | head -1)
if [ -n "$APP_BUNDLE" ]; then
    echo "  App: $APP_BUNDLE"
fi

echo ""
echo "Bundled: Python runtime, FFmpeg, Base Whisper model"
echo "Users can install and use immediately - no additional setup needed."
