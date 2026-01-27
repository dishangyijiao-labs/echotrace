# Apple Silicon (M1/M2/M3) Setup Guide

## Problem

`faster-whisper` requires `onnxruntime`, which has limited support on Apple Silicon (ARM64) macOS.

## Solution

Follow these steps to install dependencies correctly:

### Step 1: Clean Environment

```bash
cd apps/core

# Remove old virtual environment
rm -rf .venv

# Create fresh environment
python3 -m venv .venv
source .venv/bin/activate
```

### Step 2: Upgrade pip

```bash
pip install --upgrade pip setuptools wheel
```

### Step 3: Install Dependencies in Correct Order

```bash
# Install basic dependencies first
pip install fastapi uvicorn pydantic requests mcp

# Install faster-whisper (will handle onnxruntime automatically)
pip install faster-whisper

# Or if that fails, try with no binary option:
pip install --no-binary=onnxruntime faster-whisper
```

### Step 4: Install RAG Dependencies (Optional)

```bash
pip install -r requirements-rag.txt
```

### Step 5: Test Installation

```bash
python3 -c "import faster_whisper; print('✅ faster-whisper OK')"
python3 -c "import fastapi; print('✅ FastAPI OK')"
```

## Alternative: Use ctranslate2 Directly

If `faster-whisper` continues to fail, you can use `ctranslate2` directly:

```bash
pip install ctranslate2
pip install tokenizers
```

Then modify the whisper pipeline code to use ctranslate2 instead.

## Troubleshooting

### Error: "No matching distribution for onnxruntime"

This means onnxruntime doesn't have a prebuilt wheel for your platform. Solutions:

1. **Try installing from conda-forge** (if using conda):
```bash
conda install -c conda-forge onnxruntime
```

2. **Use older version of faster-whisper**:
```bash
pip install faster-whisper==0.9.0
```

3. **Build from source** (requires Xcode Command Line Tools):
```bash
pip install --no-binary=onnxruntime faster-whisper
```

### Error: "Building wheel for onnxruntime failed"

Install Xcode Command Line Tools:
```bash
xcode-select --install
```

## Verify Your Architecture

```bash
uname -m  # Should show: arm64
python3 -c "import platform; print(platform.machine())"
```

## Last Resort

If nothing works, consider using Whisper.cpp bindings instead:
```bash
pip install whisper-cpp-python
```
