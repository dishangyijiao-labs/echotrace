# EchoTrace Desktop (Tauri)

Desktop shell for the EchoTrace MVP.

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
