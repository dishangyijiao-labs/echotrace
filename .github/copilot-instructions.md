# EchoTrace Copilot Instructions

## Project Overview
EchoTrace (语迹) is a bilingual (Chinese/English) intelligent media transcription system with Django backend, React frontend, and standalone Python transcription pipeline. It converts local and NAS audio/video files into searchable text using OpenAI Whisper.

## Architecture Quick Reference

**3-Tier Structure:**
- **Backend**: Django 5.2 + DRF (`backend/`) - API on port 8001
- **Frontend**: React 19 + Vite (`frontend/`) - Dev on port 5173, Docker on port 8080  
- **Pipeline**: Standalone batch processor (`src/pipeline/`) - Independent of Django

**Key Services** (docker-compose.yml):
- `backend`: Django + Celery tasks
- `celery-worker`: Async transcription processing
- `celery-beat`: Scheduled jobs (NAS scans at 22:00)
- `postgres`: Primary database (port 5434)
- `redis`: Celery broker + cache (port 6380)

## Critical Developer Workflows

### Local Development Setup
```bash
# Backend
cd backend && source venv/bin/activate
python manage.py migrate
python manage.py runserver  # runs on :8000 by default

# Frontend
cd frontend && npm install
npm run dev  # Vite dev server on :5173

# Docker (recommended)
./scripts/start.sh  # Equivalent to: docker compose up --build backend frontend
```

### Testing
- **Manual API tests**: `python test_auth.py`, `test_resources.py`, `test_search.py` (requires backend running on port 8000)
- **No pytest/unittest yet** - tests are standalone scripts

### Code Quality
```bash
ruff check backend src           # Lint backend + pipeline
ruff check backend src --fix     # Auto-fix issues
ruff format backend src          # Format code
```
Ruff config: `backend/pyproject.toml` - 88 char lines, Python 3.11+, excludes migrations

### Pipeline Execution
```bash
# Batch transcription (independent of Django)
python -m src.pipeline.cli run --config config/config.yaml
```
Pipeline stages: ingest → extract audio → chunk → transcribe → clean → export (JSONL/Parquet)

## Django App Structure & Responsibilities

```
backend/
├── accounts/      # JWT auth, user roles (admin/editor/viewer)
├── media/         # MediaFile model, NOT media app - see management/
├── transcripts/   # Transcript + TranscriptVersion with versioning
├── tasks/         # Generic task queue (pending/running/completed/failed)
├── scheduler/     # APScheduler integration (being replaced by Celery Beat)
├── activities/    # Activity logging and audit trails
├── settings/      # App-level settings (SystemSetting model)
├── dashboard/     # Dashboard aggregation views
└── audit/         # System audit records
```

**⚠️ Important**: `backend/media/` is a Django app, not the media files directory. Uploaded files go to `backend/media/` (filesystem) or Docker volume `backend_media:/app/media`.

## Project-Specific Patterns

### Database Models - Key Relationships
```python
User
  ├─> MediaFile (owner) - SHA256 deduplication, one-to-one with Transcript
  │    └─> Job (transcription jobs with priority queue)
  ├─> Transcript (owner) - Has current_version FK
  │    └─> TranscriptVersion (editor) - Immutable versions, version_no
  └─> Task (created_by, assigned_to)
```

### MediaFile Deduplication Pattern
- **Unique Constraint**: SHA256 hash prevents duplicate uploads
- **Status Flow**: `pending → processing → done/failed`
- Check `media/models.py` for validation logic

### Transcript Versioning Pattern
- Every edit creates a new `TranscriptVersion` record
- `Transcript.current_version` FK points to active version
- Methods: `create_version(editor, content)`, `rollback_to_version(version_id)`
- Properties: `current_content`, `version_count`

### Celery Task Integration (Recent Migration from APScheduler)
- **Broker**: Redis at `redis://localhost:6379/0` (or `redis:6379` in Docker)
- **Task location**: `media/tasks.py` (converted from APScheduler)
- **Beat schedule**: Defined in `settings.CELERY_BEAT_SCHEDULE`
  - `nas-scan-daily`: Runs at 22:00 daily
  - `cleanup-weekly`: Runs Sundays at 02:00
- **Worker command**: `celery -A backend worker --loglevel=info`
- **Beat command**: `celery -A backend beat --scheduler django_celery_beat.schedulers:DatabaseScheduler`

### Frontend API Configuration
- **Base URL**: `VITE_API_BASE` env var (default: `http://localhost:8001/api`)
- **Auth**: JWT tokens in localStorage (`token`, `user`)
- **Interceptors** (App.jsx):
  - Request: Adds `Authorization: Bearer <token>` header
  - Response: Auto-redirects to `/signin` on 401

### Environment Configuration
**Backend** (`backend/media_manager/settings.py`):
- `ECHOTRACE` dict for app-specific settings:
  - `WHISPER_MODEL`: tiny/base/small/medium/large
  - `WHISPER_DEVICE`: cpu/cuda/auto (default: cpu to avoid GPU issues)
  - `WHISPER_LANGUAGE`: zh/en/auto
  - `MAX_FILE_SIZE`: 2GB limit
  - `TRANSCRIPTION_TIMEOUT`: 1800s (30 min)

**Docker Env Vars**:
- `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`
- `DJANGO_DB_ENGINE`: Switch between SQLite and PostgreSQL
- `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`: Redis connection strings

## Cross-Component Integration

### NAS Integration
- **Apps involved**: `media/` (NAS connector), `scheduler/` (periodic scans)
- **Access methods**: SMB/WebDAV file browsing from frontend
- **Scan jobs**: Celery Beat task runs daily NAS discovery

### Job Priority Queue
- `Job` model has `priority` field: high-priority jobs processed first
- Worker concurrency: `ECHOTRACE['WORKER_CONCURRENCY']` (default: 1)

### Pipeline-to-Django Boundary
- Pipeline operates **independently** - no Django models imported
- Output: JSONL/Parquet files in `pipeline_data/output/`
- Manual import process required to sync results to Django

## Migration Notes & Current State

### Recently Completed
- **Celery Migration**: Replaced APScheduler with Celery + Redis + django-celery-beat
- **Test Results**: See `CELERY_INTEGRATION_SUMMARY.md` - all tests passed

### Known Issues
- Docker builds may fail due to network issues (rebuild when stable)
- Manual test scripts require backend on port 8000 (not 8001)

## Common Gotchas

1. **Port Confusion**: Dev backend uses 8000, Docker uses 8001, frontend Vite uses 5173, Docker frontend uses 8080
2. **Database Switching**: Check `DJANGO_DB_ENGINE` env var - SQLite by default, PostgreSQL in Docker
3. **Media Files**: Don't confuse `backend/media/` (Django app) with `backend/media/` (uploaded files) or Docker volume `backend_media`
4. **Migrations**: Must run `python manage.py migrate` after adding django-celery-beat to create scheduler tables
5. **Pipeline Independence**: `src/pipeline/` has no Django dependencies - uses SQLModel for its own manifest DB

## References
- Architecture deep-dive: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- Setup guide: [README.md](../README.md)
- Celery integration: [CELERY_INTEGRATION_SUMMARY.md](../CELERY_INTEGRATION_SUMMARY.md)
- Legacy AI guidance: [CLAUDE.md](../CLAUDE.md)
