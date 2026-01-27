# Privacy Statement

## Privacy-First Design

EchoTrace is built for sensitive content. Everything runs locally on your device.

## What We DON'T Do

- ❌ No cloud uploads
- ❌ No data collection or telemetry
- ❌ No third-party tracking
- ❌ No account or login required
- ❌ No internet required for core features

## What We DO

- ✅ 100% local processing
- ✅ Open-source and auditable
- ✅ Your data stays on your device
- ✅ No hidden background processes

## Technical Details

### Data Storage
- **Location**: `apps/core/data/app.db` (SQLite)
- **Content**: File paths, transcripts, job status
- **Control**: Delete the database anytime to remove all data

### Network Usage
- **Core API**: Runs on `localhost:8787` (local only)
- **Optional AI**: You control which services to connect
- **No telemetry**: No background connections

### Transcription Process
```
1. Select local file
2. Extract audio (FFmpeg - local)
3. Transcribe (Whisper - local)
4. Save to local database
→ File never touches the internet
```

## For Sensitive Content

EchoTrace is designed for:
- Legal recordings (attorney-client privilege)
- Medical consultations (HIPAA)
- Business meetings (trade secrets)
- Personal recordings
- Research interviews

## Verification

Want to verify? You can:
1. Review the open-source code
2. Check local database at `apps/core/data/app.db`
3. Monitor network traffic (no outbound connections)
4. Run completely offline

## Last Updated

January 2026
