# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EchoTrace is a macOS desktop app for video/audio transcription and search. Tauri 2.0 (Rust) shell manages a React frontend and Python backend processes.

## Architecture

```
apps/
  desktop/          # Tauri 2.0 + React frontend
    src/            # React pages (JSX), TailwindCSS, i18next (zh/en)
    src-tauri/      # Rust shell: spawns/manages Python child processes
  core/             # Python backend (FastAPI + faster-whisper)
    app.py          # REST API server on port 8787 + SSE endpoint
    worker.py       # Background transcription worker (polls job queue)
    llm_service.py  # MCP gateway for LLM providers
    pipeline/       # Media processing: audio extraction (FFmpeg), whisper transcription
    db/             # SQLite schema, migrations, init_db.py
    rag/            # ChromaDB vector store for semantic search
```

**Data flow:** Frontend → REST API (app.py) → SQLite (jobs/media/transcripts) ← Worker (worker.py) polls and processes jobs. SSE `/events/jobs` for real-time updates with polling fallback.

**Process management:** Rust `lib.rs` spawns `app.py` and `worker.py` as child processes using Unix process groups (`setpgid`). On exit, kills entire process group (`kill -pid`).

## Common Commands

```bash
# Full dev mode (starts core API, worker, and Tauri frontend)
npm run dev

# Individual components
npm run dev:core        # Python API on :8787
npm run dev:worker      # Background worker
npm run dev:desktop     # Tauri dev (auto-starts core + worker via Rust)

# Build release (.dmg, macOS only)
cd apps/desktop && npm run tauri build -- --target aarch64-apple-darwin

# Setup from scratch
npm run setup           # Creates Python venv + installs deps + npm install

# Python venv setup only
npm run setup:core

# Run Python tests
cd apps/core && .venv/bin/python -m pytest

# Clean all build artifacts
npm run clean
```

## Key Conventions

- **macOS only** — CI builds for `aarch64-apple-darwin` only. No Linux/Windows support.
- **Bundled deps** — Release bundles Python interpreter, FFmpeg, and whisper model inside `.app` via `bundle-deps.sh`. Rust detects bundled Python at `core/.venv/bin/python3` before falling back to system Python.
- **SQLite + FTS5** — Full-text search on transcripts. Schema in `apps/core/db/schema.sql`, migrations in `db/migrations/`.
- **i18n** — Chinese and English via `react-i18next`. Translation files in `apps/desktop/src/i18n/`.
- **UI** — TailwindCSS with neutral gray `card` class for consistent styling. No colored card backgrounds.
- **Audio cache** — Worker reuses cached WAV files (`staging/media_{id}.wav`) to skip redundant FFmpeg extraction.
- **Resources bundling** — `tauri.conf.json` `bundle.resources` maps core Python files into the `.app`. When adding new Python modules, update this mapping.
- **Process cleanup** — Child processes use `setpgid(0,0)` for group isolation. Always kill process groups, not individual PIDs.

## Frontend Structure

Pages in `apps/desktop/src/pages/`: Dashboard, TaskQueue, Results, TranscriptDetail, Resources, Models, Services, WhisperModels, Settings. Routing in `App.jsx`. API calls use `axios` to `http://127.0.0.1:8787`.

## Backend API

`app.py` serves REST endpoints: `/media`, `/jobs`, `/search`, `/transcripts/{id}`, `/settings`, `/events/jobs` (SSE). CORS enabled for Tauri webview origins.
