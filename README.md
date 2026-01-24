# EchoTrace Desktop

Local audio/video transcription and text management tool (Tauri + FastAPI + faster-whisper).

## Overview

- Local import audio/video → transcribe → timeline → search → summarize → export
- Local database SQLite + FTS5 full-text search
- MCP integration with multiple models (OpenAI / Claude / DeepSeek / Doubao / Local LLM)

## Getting Started

### 1) Start Core & Worker

```bash
cd apps/core
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
python worker.py
```

### 2) Start Desktop App

```bash
cd apps/desktop
npm install
npm run tauri dev
```

## MCP Configuration

- MCP provider config is written to app data directory (`mcp-providers.json`)
- Configure via "Models & Keys" page in the app
- Or set `MCP_PROVIDERS_PATH` to point to custom config

## Environment Variables

- `ECHOTRACE_CORE_DIR`: Core directory (default: `../core`)
- `ECHOTRACE_PYTHON`: Python executable (default: `python3` / Windows: `python`)
- `MCP_PROVIDERS_PATH`: MCP provider config path

## Legacy Code

Old Web/Django version has been moved to `legacy/`, for reference only. Not recommended for continued use.

## Documentation

- `docs/ARCHITECTURE.md`
- `apps/core/README.md`
- `apps/desktop/README.md`
