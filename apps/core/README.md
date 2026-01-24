# EchoTrace Core (MVP)

Local core service for the desktop app.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
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
