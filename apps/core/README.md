# EchoTrace Core (MVP)

Local core service for the desktop app.

## Requirements

- Python 3.12
- FFmpeg (for audio extraction)

## Setup

From repo root:

```bash
./setup-python-env.sh
```

Or from this directory:

```bash
./install-python312.sh
```

## Run

```bash
python app.py
```

Service listens on http://127.0.0.1:8787.

## Worker

```bash
python worker.py
```

The worker polls for queued jobs and writes transcripts to the local SQLite database.

Requirements:
- `ffmpeg` available in PATH for audio extraction.

## MCP Summaries

Providers are configured in `apps/core/mcp_gateway/providers.json`.
Set `MCP_PROVIDERS_PATH` to override the file location and point each provider to an MCP server.
