# EchoTrace Desktop App

Tauri-based desktop application for EchoTrace.

## Tech Stack

- **Frontend**: React + TailwindCSS + i18next
- **Backend**: Tauri 2.0 (Rust)
- **Routing**: React Router
- **Build**: Vite 7

## Development

### Prerequisites

- Node.js 20.19+ or 22.12+
- Rust (for Tauri)
- Core API running (see `apps/core/`)

### Setup

```bash
npm install
```

### Run Dev Mode

```bash
npm run tauri dev
```

This will:
1. Start Vite dev server
2. Launch Tauri window
3. Hot-reload on file changes

## Build

### Build Frontend Only

```bash
npm run build
```

### Build Desktop App

```bash
npm run tauri build
```

Or use the convenience script:

```bash
./rebuild-package.sh
```

Output:
- **macOS**: `src-tauri/target/release/bundle/macos/EchoTrace.app`
- **DMG**: `src-tauri/target/release/bundle/dmg/EchoTrace_0.1.0_aarch64.dmg`

## Auto-Start Services

The packaged app automatically starts backend services:

1. Core API (`../core/app.py`)
2. Worker (`../core/worker.py`)

Services are managed by Tauri and stop when app closes.

## Configuration

Environment variables:
- `ECHOTRACE_CORE_DIR` - Core directory (default: `../core`)
- `ECHOTRACE_PYTHON` - Python executable (default: `python3.12`)
- `MCP_PROVIDERS_PATH` - MCP config file path

## System Tray

The app runs with a system tray icon that allows:
- Manual service control (start/stop Core and Worker)
- Quick access to quit

## Scripts

- `rebuild-package.sh` - Clean build and package the app

## Project Structure

```
src/
├── App.jsx                 # Main app component
├── components/             # Reusable components
│   ├── AppLayout.jsx      # Main layout
│   ├── ModelSetup.jsx     # First-run model download
│   └── LanguageSwitcher.jsx
├── pages/                  # Route pages
│   ├── Dashboard.jsx
│   ├── Resources.jsx
│   ├── TaskQueue.jsx
│   ├── Results.jsx
│   ├── AISearch.jsx       # RAG/semantic search
│   ├── Models.jsx
│   ├── Services.jsx       # Service management
│   └── Settings.jsx
├── lib/                    # Utilities
│   ├── api.js             # Core API client
│   └── settings.js
└── i18n/                   # Internationalization
    └── locales/
        ├── en.json
        └── zh.json

src-tauri/
├── src/
│   ├── main.rs            # Tauri entry point
│   └── lib.rs             # Service management logic
├── Cargo.toml             # Rust dependencies
└── tauri.conf.json        # Tauri configuration
```

## Notes

- Frontend communicates with Core API at `http://127.0.0.1:8787`
- First-run prompts user to download Whisper model
- Logs stored in system log directory
