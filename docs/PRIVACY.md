# EchoTrace Privacy Statement

## Our Privacy Commitment

**EchoTrace is designed with privacy as the foundation, not an afterthought.**

## What We DON'T Do

- ❌ **No Cloud Uploads**: Your audio/video files never leave your device
- ❌ **No Data Collection**: We don't collect any user data, analytics, or telemetry
- ❌ **No Third-Party Services**: No tracking pixels, no advertising networks
- ❌ **No Account Required**: No login, no registration, no personal information
- ❌ **No Internet Required**: Works completely offline

## What We DO

- ✅ **100% Local Processing**: All transcription happens on your device
- ✅ **Your Data Stays Yours**: Files stored only in your chosen directory
- ✅ **Open Source**: Code is transparent and auditable
- ✅ **No Hidden Processes**: Everything runs locally on your machine

## Technical Details

### Data Storage
- **Location**: SQLite database in `apps/core/data/app.db`
- **Content**: Media file paths, transcripts, job status
- **Control**: You can delete the database anytime to remove all data

### Network Usage
- **Core API**: Runs on `localhost:8787` - only accessible from your machine
- **Optional LLM**: You control which AI services to connect (if any)
- **No Telemetry**: No background connections, no update checks without consent

### Transcription Process
1. Select local audio/video file
2. Extract audio using FFmpeg (local)
3. Transcribe using Whisper model (local)
4. Save to local SQLite database
5. **Your file never touches the internet**

## For Sensitive Content

EchoTrace is specifically designed for:
- Legal recordings (attorney-client privilege)
- Medical consultations (HIPAA compliance)
- Business meetings (trade secrets)
- Personal recordings (journal entries)
- Research interviews (confidential data)

## Questions?

If you have concerns about privacy, please:
1. Review our open-source code
2. Check your local database at `apps/core/data/app.db`
3. Monitor network traffic (you'll see no outbound connections)
4. Contact us with specific questions

## Last Updated

January 24, 2026
