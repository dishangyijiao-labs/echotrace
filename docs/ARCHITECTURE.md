# EchoTrace Architecture

## Overview

EchoTrace is a desktop application for local video/audio transcription and search, built with:
- **Frontend**: Tauri (Rust) + React
- **Backend**: FastAPI (Python) + SQLite
- **Transcription**: faster-whisper (local)
- **AI** (optional): LangChain + ChromaDB

## System Architecture

```
┌─────────────────────────────────────────┐
│         Desktop App (Tauri)             │
│  ┌─────────────┐   ┌─────────────────┐  │
│  │  React UI   │   │  System Tray    │  │
│  └─────────────┘   └─────────────────┘  │
└───────────────┬─────────────────────────┘
                │ HTTP (localhost:8787)
┌───────────────▼─────────────────────────┐
│       Core API (FastAPI)                │
│  ┌──────────┐  ┌────────┐  ┌─────────┐  │
│  │ REST API │  │ Worker │  │   MCP   │  │
│  └────┬─────┘  └───┬────┘  └────┬────┘  │
│       │            │            │        │
│       ▼            ▼            ▼        │
│  ┌────────────────────────────────────┐  │
│  │   SQLite (FTS5 + Vector Store)    │  │
│  └────────────────────────────────────┘  │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│      Processing Engines                 │
│  ┌─────────────┐   ┌──────────────────┐ │
│  │   Whisper   │   │     FFmpeg       │ │
│  │ (Transcribe)│   │ (Audio Extract)  │ │
│  └─────────────┘   └──────────────────┘ │
└─────────────────────────────────────────┘
```

## Data Flow

### 1. Import Media
```
User selects file → Desktop → Core API → Store path in `media` table
```

### 2. Transcription
```
User creates job → Core API → `job` table (queued)
                      ↓
                    Worker polls job
                      ↓
                  Extract audio (FFmpeg)
                      ↓
                  Transcribe (Whisper)
                      ↓
                Store in `transcript` + `segment` tables
```

### 3. Search
```
User searches text → Core API → SQLite FTS5 → Return results
```

### 4. AI Analysis (Optional)
```
User query → Core API → MCP/LangChain → LLM → Return analysis
```

## Key Components

### Desktop App (`apps/desktop/`)
- **Tech**: Tauri 2.0 + React + TailwindCSS
- **Features**: UI, system tray, service management
- **Auto-start**: Automatically launches Core API and Worker

### Core API (`apps/core/app.py`)
- **Tech**: FastAPI + SQLite
- **Port**: http://127.0.0.1:8787
- **Endpoints**: Media management, jobs, transcripts, search, RAG

### Worker (`apps/core/worker.py`)
- **Purpose**: Background job processor
- **Function**: Polls jobs, transcribes, updates database

### Database Schema
```sql
media     - Store media file metadata
job       - Transcription job queue
transcript - Transcript metadata and full text
segment    - Timeline segments with timestamps
```

## Service Management

The desktop app automatically manages backend services:

```rust
// On app startup
1. Start Core API (app.py)
2. Wait 2 seconds
3. Start Worker (worker.py)

// On app close
1. Stop Worker
2. Stop Core API
```

Manual control available via system tray menu.

## Optional: RAG Integration

When `requirements-rag.txt` is installed:

- **Vector Store**: ChromaDB (local)
- **Embeddings**: sentence-transformers (local) or OpenAI
- **LLM**: OpenAI, Claude, DeepSeek, or Ollama (local)
- **Framework**: LangChain + LangGraph

RAG enables:
- Semantic search across transcripts
- AI-powered clip extraction
- Multi-agent query answering

## Directory Structure

```
echotrace/
├── apps/
│   ├── desktop/          # Tauri + React app
│   │   ├── src/          # React components
│   │   └── src-tauri/    # Rust backend
│   └── core/             # Python backend
│       ├── app.py        # FastAPI server
│       ├── worker.py     # Job processor
│       ├── pipeline/     # Transcription logic
│       ├── rag/          # RAG/AI features
│       └── data/         # SQLite database
└── docs/                 # Documentation
```

## Deployment

The packaged app bundles:
- Desktop executable (.app on macOS)
- Assumes `../core/` directory with Python environment exists
- Services auto-start when app launches

For distribution, include both app and core directory with dependencies installed.
