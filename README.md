# EchoTrace

**Local Video Archive Search Engine** - Find any moment in your video content instantly.

## What is EchoTrace?

EchoTrace transcribes your audio/video files locally and makes them searchable. Built for content creators who need to find specific clips in large video archives.

### Use Case

```
Short-form video team needs clips about "AI" from 50+ long videos

Without EchoTrace: 2 hours of manual searching
With EchoTrace: 10 seconds
  1. Search "artificial intelligence"
  2. See all mentions with timestamps
  3. Click to play → verify → export
```

**Time saved: 120x faster**

## Features

- 🎙️ **Local transcription** - Powered by OpenAI Whisper, runs offline
- 🔍 **Full-text search** - Fast SQLite FTS5 search across all transcripts
- 🤖 **AI analysis** - Optional semantic search and intelligent summarization
- 📤 **Multi-format export** - Export to txt, srt, or markdown
- 🔒 **Privacy-first** - All processing happens on your device

## Quick Start

### Prerequisites

- Python 3.12
- Node.js 20+
- FFmpeg (for audio extraction)

### Setup

```bash
# 1. Configure Python 3.12 environment
./setup-python-env.sh

# 2. Build desktop app
cd apps/desktop
./rebuild-package.sh

# 3. Run the app
open src-tauri/target/release/bundle/macos/EchoTrace.app
```

## Architecture

- **Desktop App**: Tauri (Rust) + React frontend
- **Core API**: FastAPI backend (Python)
- **Worker**: Background transcription processor
- **Database**: SQLite with FTS5 for fast search
- **AI/RAG**: Optional LangChain + ChromaDB integration

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Privacy

EchoTrace is designed for sensitive content:

- ✅ 100% local processing
- ✅ No cloud uploads
- ✅ No telemetry or tracking
- ✅ Works completely offline

See [docs/PRIVACY.md](docs/PRIVACY.md) for more information.

## Development

```bash
# Start Core API
cd apps/core
source .venv/bin/activate
python app.py

# Start Worker (in another terminal)
python worker.py

# Start Desktop (in another terminal)
cd apps/desktop
npm run tauri dev
```

## Environment Variables

- `ECHOTRACE_CORE_DIR` - Core directory path (default: `../core`)
- `ECHOTRACE_PYTHON` - Python executable (default: `python3.12`)
- `MCP_PROVIDERS_PATH` - Custom MCP config path

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Privacy Statement](docs/PRIVACY.md)
- [Core API Documentation](apps/core/README.md)
- [Desktop App Documentation](apps/desktop/README.md)

## License

MIT
