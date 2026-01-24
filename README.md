# EchoTrace Desktop

**Your Video Archive Search Engine** - Find any moment in seconds, not hours.

## 🎬 Built for Content Creators

**The Problem**: You have 100+ hours of video content. Finding a specific clip takes 30 minutes of manual scrubbing.

**The Solution**: Transcribe everything locally, search by keyword, jump to exact timestamp.

### Real Use Case

```
Short-form video team needs clips about "AI" from 50+ long-form videos

Old way: 2 hours of manual searching
EchoTrace: 10 seconds
  1. Search "artificial intelligence"
  2. See all 23 mentions with timestamps
  3. Click to play → verify → export timecode
  4. Import to Premiere Pro
```

**Time saved per search: 120x**

## 💡 Who Is This For?

- 📹 **Short-video editors** - Repurpose long-form content into clips
- 🎙️ **Podcast producers** - Generate show notes and chapter markers
- 🎓 **Course creators** - Find and repackage specific topics
- 📺 **MCN content teams** - Manage large video archives
- 🎬 **Video bloggers** - Quickly recall "that one time I said..."

## Core Features

- 🎙️ **Local audio/video transcription** (powered by OpenAI Whisper)
  - Completely offline processing
  - No internet required for transcription
  
- 📊 **Timeline segmentation & full-text search** (SQLite FTS5)
  - Fast local search across all transcripts
  - No cloud indexing
  
- 📤 **Export to multiple formats** (txt / srt / md)
  - All processing local
  
- 🤖 **Optional AI analysis** (⚠️ privacy trade-offs apply)
  - **Local LLM**: Requires Ollama, data stays local, performance limited
  - **Cloud LLM**: OpenAI/Claude/DeepSeek, faster but uploads text to cloud
  - **Recommendation**: Use local for sensitive content, cloud for public content

## ⚠️ Privacy Trade-offs

### What's Always Local (100% Private)
✅ Audio/video file processing  
✅ Transcription generation  
✅ Full-text search  
✅ Export functions  

### What's Optional (Privacy Impact)
⚠️ **Cloud AI Analysis** (OpenAI/Claude/DeepSeek):
- Uploads transcript text to third-party servers
- Faster and higher quality
- **NOT recommended for sensitive content**

✅ **Local AI Analysis** (Ollama):
- Runs on your device
- Data never leaves your computer
- Slower and quality depends on model size
- **Recommended for sensitive content**

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
