# EchoTrace Desktop Setup & Troubleshooting

## Running

```bash
cd apps/core
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
python worker.py
```

```bash
cd apps/desktop
npm install
npm run tauri dev
```

## Environment Variables

- `ECHOTRACE_CORE_DIR`: Core directory (default: `../core`)
- `ECHOTRACE_PYTHON`: Python executable
- `MCP_PROVIDERS_PATH`: MCP config file path

## Troubleshooting

- Startup fails: Ensure `ffmpeg` is in PATH
- Summarization fails: Verify MCP provider config has API key filled in
- No audio playback: Confirm media file path exists and hasn't been moved
