#!/bin/bash
# EchoTrace dependency bundling script
# Downloads portable Python, FFmpeg, and Whisper model for self-contained app bundle.
#
# Usage: cd apps/desktop && ./bundle-deps.sh
# Output: apps/core/python/, apps/core/bin/, apps/core/models/

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CORE_DIR="$(cd "$SCRIPT_DIR/../core" && pwd)"

# --- Configuration ---
PYTHON_VERSION="3.12"
PYTHON_BUILD_TAG="20250317"
ARCH="$(uname -m)"  # aarch64 or x86_64

# Map arch names
if [ "$ARCH" = "arm64" ]; then
    ARCH="aarch64"
fi

PYTHON_TARBALL="cpython-${PYTHON_VERSION}.9+${PYTHON_BUILD_TAG}-${ARCH}-apple-darwin-install_only.tar.gz"
PYTHON_URL="https://github.com/indygreg/python-build-standalone/releases/download/${PYTHON_BUILD_TAG}/${PYTHON_TARBALL}"

FFMPEG_VERSION="7.1.1"
FFMPEG_URL="https://evermeet.cx/ffmpeg/ffmpeg-${FFMPEG_VERSION}.zip"

WHISPER_MODEL="base"

DEPS_CACHE="${SCRIPT_DIR}/.bundle-cache"

echo "======================================"
echo "EchoTrace Dependency Bundler"
echo "======================================"
echo "  Core dir:  $CORE_DIR"
echo "  Arch:      $ARCH"
echo "  Cache dir: $DEPS_CACHE"
echo ""

mkdir -p "$DEPS_CACHE"

# ============================================================
# Step 1: Download & install portable Python
# ============================================================
echo "[1/3] Portable Python ${PYTHON_VERSION}"

PYTHON_DIR="$CORE_DIR/python"

if [ -f "$PYTHON_DIR/bin/python3" ]; then
    EXISTING_VER=$("$PYTHON_DIR/bin/python3" --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
    if [ "$EXISTING_VER" = "$PYTHON_VERSION" ]; then
        echo "  Already present (Python $EXISTING_VER), skipping download."
    else
        echo "  Existing Python $EXISTING_VER != $PYTHON_VERSION, re-downloading..."
        rm -rf "$PYTHON_DIR"
    fi
fi

if [ ! -f "$PYTHON_DIR/bin/python3" ]; then
    CACHED_TARBALL="$DEPS_CACHE/$PYTHON_TARBALL"
    if [ ! -f "$CACHED_TARBALL" ]; then
        echo "  Downloading python-build-standalone..."
        echo "  URL: $PYTHON_URL"
        curl -L --progress-bar -o "$CACHED_TARBALL" "$PYTHON_URL"
    else
        echo "  Using cached tarball."
    fi

    echo "  Extracting..."
    # python-build-standalone extracts to python/ directory
    rm -rf "$PYTHON_DIR"
    tar xzf "$CACHED_TARBALL" -C "$CORE_DIR"
    # The tarball extracts to python/install/ — flatten it
    if [ -d "$PYTHON_DIR/install" ]; then
        TMP_DIR="$CORE_DIR/_python_tmp"
        mv "$PYTHON_DIR/install" "$TMP_DIR"
        rm -rf "$PYTHON_DIR"
        mv "$TMP_DIR" "$PYTHON_DIR"
    fi

    echo "  Verifying..."
    "$PYTHON_DIR/bin/python3" --version
fi

# Install core dependencies into the portable Python
PYTHON_BIN="$PYTHON_DIR/bin/python3"
PIP_BIN="$PYTHON_DIR/bin/pip3"

# Ensure pip is available
if [ ! -f "$PIP_BIN" ]; then
    echo "  Bootstrapping pip..."
    "$PYTHON_BIN" -m ensurepip --upgrade
fi

echo "  Installing core dependencies..."
"$PIP_BIN" install --upgrade pip setuptools wheel -q

# Install core deps only (skip RAG/test deps which pull PyTorch ~2GB)
"$PIP_BIN" install -q \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.32.0" \
    "pydantic>=2.10.0" \
    "mcp>=1.20.0" \
    "requests>=2.32.0" \
    "faster-whisper>=1.0.0" \
    "opencc-python-reimplemented>=0.1.7" \
    "httpx>=0.27.0"

echo "  Python ready: $("$PYTHON_BIN" --version)"
echo ""

# ============================================================
# Step 2: Download static FFmpeg
# ============================================================
echo "[2/3] Static FFmpeg"

FFMPEG_BIN="$CORE_DIR/bin/ffmpeg"
mkdir -p "$CORE_DIR/bin"

if [ -f "$FFMPEG_BIN" ]; then
    echo "  Already present, skipping."
else
    CACHED_FFMPEG="$DEPS_CACHE/ffmpeg-${FFMPEG_VERSION}.zip"
    if [ ! -f "$CACHED_FFMPEG" ]; then
        echo "  Downloading static ffmpeg ${FFMPEG_VERSION}..."
        curl -L --progress-bar -o "$CACHED_FFMPEG" "$FFMPEG_URL"
    else
        echo "  Using cached archive."
    fi

    echo "  Extracting..."
    unzip -o -q "$CACHED_FFMPEG" -d "$CORE_DIR/bin/"
    chmod +x "$FFMPEG_BIN"

    echo "  Verifying..."
    "$FFMPEG_BIN" -version | head -1
fi
echo ""

# ============================================================
# Step 3: Pre-download Base Whisper model
# ============================================================
echo "[3/3] Whisper ${WHISPER_MODEL} model"

MODEL_DIR="$CORE_DIR/models/$WHISPER_MODEL"

if [ -d "$MODEL_DIR" ] && [ "$(ls -A "$MODEL_DIR" 2>/dev/null)" ]; then
    echo "  Already present, skipping."
else
    echo "  Downloading via faster-whisper..."
    mkdir -p "$MODEL_DIR"

    "$PYTHON_BIN" -c "
from faster_whisper import WhisperModel
import shutil, os
from pathlib import Path

model_size = '${WHISPER_MODEL}'
print(f'  Loading model {model_size} (triggers download)...')
model = WhisperModel(model_size, device='cpu', compute_type='int8')
del model

# Copy from HuggingFace cache to bundle dir
cache_dir = Path.home() / '.cache' / 'huggingface' / 'hub' / f'models--Systran--faster-whisper-{model_size}'
target_dir = Path('$MODEL_DIR')

if cache_dir.exists():
    # Find the actual model files (in snapshots/)
    snapshots = cache_dir / 'snapshots'
    if snapshots.exists():
        for snapshot in snapshots.iterdir():
            if snapshot.is_dir():
                for f in snapshot.iterdir():
                    dst = target_dir / f.name
                    if f.is_file() and not dst.exists():
                        shutil.copy2(f, dst)
                        print(f'  Copied: {f.name}')
                break
    print(f'  Model files copied to bundle directory.')
else:
    print(f'  Warning: cache not found at {cache_dir}')
"
fi
echo ""

# ============================================================
# Summary
# ============================================================
echo "======================================"
echo "Bundle dependencies ready!"
echo "======================================"
PYTHON_SIZE=$(du -sh "$PYTHON_DIR" 2>/dev/null | cut -f1)
FFMPEG_SIZE=$(du -sh "$CORE_DIR/bin" 2>/dev/null | cut -f1)
MODEL_SIZE=$(du -sh "$MODEL_DIR" 2>/dev/null | cut -f1)
echo "  Python:  $PYTHON_DIR ($PYTHON_SIZE)"
echo "  FFmpeg:  $FFMPEG_BIN ($FFMPEG_SIZE)"
echo "  Model:   $MODEL_DIR ($MODEL_SIZE)"
echo ""
echo "These will be included in the app bundle via tauri.conf.json resources."
echo "Run 'npm run tauri build' to create the app."
