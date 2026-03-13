# EchoTrace

[中文文档](README.zh-CN.md)

**"I remember someone said that in a video — but which one, and when?"**

EchoTrace turns your audio and video files into searchable text, letting you find any sentence in seconds. Fully local — your data never leaves your machine.

## Who is it for?

| Role | Use case |
|------|----------|
| Short-video teams | Find every mention of a topic across dozens of long videos, batch-clip |
| Podcasters | Look up past episodes: "Which episode did I talk about XX?" |
| Journalists / Researchers | Search interview recordings by keyword for evidence |
| Legal / Compliance | Extract key statements from court or meeting recordings |
| Course creators | Locate knowledge points in lecture videos, generate subtitles |

### Before / After

```
Task: Find all clips about "artificial intelligence" across 50 long videos

Manual scrubbing: ~2 hours
EchoTrace: ~10 seconds
  1. Search "artificial intelligence"
  2. See all matching results + timestamps
  3. Click to jump, confirm, export
```

## Features

### Local Transcription
- Powered by OpenAI Whisper — 6 models to choose from (tiny → large-v3), balancing speed and accuracy
- Supports MP3 / WAV / MP4 / MOV / MKV / AVI / FLAC and more, up to 10 GB per file
- Drag-and-drop import, batch submission, background queue processing, system notifications on completion

### Search
- **Keyword search** — SQLite FTS5 full-text search, millisecond response
- **Semantic search** — Vector embedding-based, describe what you're looking for in natural language ("that part about reflecting on startup failure")
- **Hybrid mode** — Keyword + semantic search combined, results ranked by relevance
- Advanced filters: date range, duration, language, file type, sort order

### AI Analysis (optional)
- Connect to GPT-4o / Claude / DeepSeek / Ollama and other LLMs
- Smart summaries: one-click summary of an entire recording
- Cross-file Q&A: "What different perspectives did guests have on XX across these episodes?"

### Playback & Export
- Built-in player — click a search result to jump to the exact timestamp
- Sentence-level sync highlighting, variable speed playback (0.5x – 2.0x), single-sentence loop
- Export formats: TXT / SRT subtitles / Markdown, batch export as ZIP

### Privacy
- 100% local processing, no data uploaded
- No accounts, no telemetry, no tracking
- Works offline (except AI analysis)

## Getting Started

### Prerequisites

- Python 3.12
- Node.js 20+
- FFmpeg
- macOS 12+ (macOS only for now)

### System Requirements

Measured on Apple M4 / 32 GB using `apps/core/benchmark.py`. Results will vary on different hardware.

| | Minimum | Recommended | High quality |
|---|---|---|---|
| **Whisper model** | tiny | small (default) | medium / large-v2 |
| **RAM** | 4 GB | 8 GB | 16 GB |
| **Disk** | 1 GB | 2 GB | 5 GB |
| **CPU** | Dual-core | Quad-core | 8+ cores |

**Measured peak memory per model (30s audio):**

| Model | Disk size | Peak RAM | Peak CPU | Time (30s audio) |
|-------|-----------|----------|----------|-------------------|
| tiny | 75 MB | ~600 MB | ~180% | ~7s |
| small | 466 MB | ~1.2 GB | ~400% | ~1.7s |
| medium | 1.5 GB | ~2.8 GB | — | — |
| large-v2 | 2.9 GB | ~4.5 GB | — | — |

> The tiny model is fastest but has poor transcription quality — not recommended for real use. The small model offers the best balance of speed and accuracy.
>
> Enabling semantic search adds ~150 MB for the embedding model (bge-small-zh-v1.5, 102 MB on disk).
>
> The app automatically checks available memory when you select a model and warns if it may be insufficient.

### Install & Run

```bash
# 1. Set up Python environment
./setup-python-env.sh

# 2. Build the desktop app
cd apps/desktop
./rebuild-package.sh

# 3. Launch
open src-tauri/target/release/bundle/macos/EchoTrace.app
```

The app starts the backend automatically — no manual setup needed. On first launch you'll be guided to download a Whisper model.

## Architecture

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2.0 (Rust) |
| Frontend | React + TailwindCSS + i18next |
| Backend API | FastAPI (Python) |
| Transcription | faster-whisper + FFmpeg |
| Database | SQLite + FTS5 |
| AI / RAG | LangChain + ChromaDB + sentence-transformers |

See [Architecture](docs/ARCHITECTURE.md) for details.

## Development

```bash
# Start backend
cd apps/core && source .venv/bin/activate && python app.py

# Start worker (separate terminal)
python worker.py

# Start desktop app (separate terminal)
cd apps/desktop && npm run tauri dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ECHOTRACE_CORE_DIR` | Core directory path | `../core` |
| `ECHOTRACE_PYTHON` | Python executable | `python3.12` |
| `ECHOTRACE_FFMPEG` | FFmpeg executable | Auto-detected |
| `MCP_PROVIDERS_PATH` | MCP config file path | — |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Privacy Policy](docs/PRIVACY.md)

## Contributing

Issues and Pull Requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please do not open public issues for security vulnerabilities. Follow the process in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
