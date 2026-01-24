# EchoTrace Desktop (Tauri)

**Privacy-First Desktop Application** - All processing happens locally on your machine.

## Privacy Guarantee

- ✅ 100% local processing - no cloud uploads
- ✅ Your files never leave your device
- ✅ Works completely offline
- ✅ No telemetry, no tracking, no data collection

## Development

```bash
cd apps/desktop
npm install
npm run tauri dev
```

By default the UI expects the local core service at `http://127.0.0.1:8787`.
Set `VITE_API_BASE` if you change the core URL.

## Tray Controller

The tray menu can start/stop the local core and worker processes.
Set `ECHOTRACE_CORE_DIR` to point at the `apps/core` directory if needed, and
`ECHOTRACE_PYTHON` to override the Python executable.
