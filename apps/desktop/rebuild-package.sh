#!/bin/bash
# EchoTrace rebuild package script
# Usage: cd apps/desktop && ./rebuild-package.sh

set -e

echo "======================================"
echo "EchoTrace Rebuild Package Script"
echo "======================================"
echo ""

# Step 1: Check Node.js version
echo "Step 1/6: Check Node.js version"
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
echo "Step 2/6: Bundle dependencies"
./bundle-deps.sh
echo ""

# Step 3: Clean old build artifacts
echo "Step 3/6: Clean old build artifacts"
rm -rf dist src-tauri/target/release/bundle
echo "  Cleanup completed"
echo ""

# Step 4: Install dependencies & build frontend
echo "Step 4/6: Install dependencies & build frontend"
npm install --registry=https://registry.npmmirror.com
npm run build
echo "  Frontend build completed"
echo ""

# Step 5: Package Tauri app
echo "Step 5/6: Build Tauri app (without DMG)"
echo "  This may take a few minutes..."
# Build app bundle only (DMG created later after we inject Python)
npm run tauri build -- --no-bundle
echo "  Tauri compilation completed"
echo ""

# Step 6: Assemble full app bundle with Python runtime
echo "Step 6/6: Assemble app bundle"

# Create the .app bundle manually from the compiled binary
APP_NAME="EchoTrace"
RELEASE_DIR="src-tauri/target/release"
BUNDLE_DIR="$RELEASE_DIR/bundle/macos"

# Build the .app bundle in /tmp to avoid macOS .app path protection
STAGE="/tmp/echotrace_app_build"
rm -rf "$STAGE"
APP_BUNDLE="$STAGE/$APP_NAME.app"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Copy binary
cp "$RELEASE_DIR/echotrace" "$APP_BUNDLE/Contents/MacOS/$APP_NAME"

# Create Info.plist
VERSION=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
cat > "$APP_BUNDLE/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>English</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>CFBundleIdentifier</key>
    <string>com.echotrace.desktop</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

# Copy icon
cp src-tauri/icons/icon.icns "$APP_BUNDLE/Contents/Resources/"

# Copy frontend dist
cp -R dist "$APP_BUNDLE/Contents/Resources/_app"

# Copy core resources (code, db, pipeline, etc.)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CORE_DIR="$SCRIPT_DIR/../core"
RESOURCES="$APP_BUNDLE/Contents/Resources"
mkdir -p "$RESOURCES/core"

for item in app.py worker.py download_manager.py errors.py llm_service.py requirements.txt; do
    cp "$CORE_DIR/$item" "$RESOURCES/core/"
done
for dir in db pipeline rag; do
    cp -R "$CORE_DIR/$dir" "$RESOURCES/core/"
done

# Copy bundled Python runtime (use ditto to handle macOS provenance attributes)
echo "  Copying Python runtime..."
ditto "$CORE_DIR/python" "$RESOURCES/core/python"

# Copy FFmpeg
echo "  Copying FFmpeg..."
mkdir -p "$RESOURCES/core/bin"
ditto "$CORE_DIR/bin/ffmpeg" "$RESOURCES/core/bin/ffmpeg"

# Copy model
echo "  Copying Whisper model..."
ditto "$CORE_DIR/models" "$RESOURCES/core/models"

# Clean up __pycache__ etc.
find "$RESOURCES/core" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$RESOURCES/core" -type f -name "*.pyc" -delete 2>/dev/null || true

# Move assembled bundle to final location
mkdir -p "$BUNDLE_DIR"
rm -rf "$BUNDLE_DIR/$APP_NAME.app" 2>/dev/null || true
mv "$APP_BUNDLE" "$BUNDLE_DIR/"
APP_BUNDLE="$BUNDLE_DIR/$APP_NAME.app"
rm -rf "$STAGE"

echo "  App bundle assembled: $APP_BUNDLE"

# Create DMG
echo "  Creating DMG..."
DMG_DIR="$RELEASE_DIR/bundle/dmg"
mkdir -p "$DMG_DIR"
DMG_FILE="$DMG_DIR/${APP_NAME}_${VERSION}_aarch64.dmg"

# Use hdiutil to create DMG with Applications symlink
STAGING="/tmp/echotrace_dmg_staging"
rm -rf "$STAGING"
mkdir -p "$STAGING"
cp -R "$APP_BUNDLE" "$STAGING/"
ln -s /Applications "$STAGING/Applications"

hdiutil create -volname "$APP_NAME" -srcfolder "$STAGING" -ov -format UDZO "$DMG_FILE"
rm -rf "$STAGING"

echo ""

# Display results
echo "======================================"
echo "Packaging successful!"
echo "======================================"
echo ""
echo "Package artifacts:"

if [ -f "$DMG_FILE" ]; then
    DMG_SIZE=$(ls -lh "$DMG_FILE" | awk '{print $5}')
    echo "  DMG: $DMG_FILE ($DMG_SIZE)"
fi
echo "  App: $APP_BUNDLE"
echo ""
echo "Bundled: Python runtime, FFmpeg, Base Whisper model"
echo "Users can install and use immediately - no additional setup needed."
echo ""
echo "To test:"
echo "  open $DMG_FILE"
