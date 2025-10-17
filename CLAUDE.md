# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EchoTrace (语迹)** is an intelligent media transcription management system that converts local audio/video files into text with full-text search capabilities. It consists of a Django backend, React frontend, and a standalone Python pipeline for batch transcription processing.

## Architecture

### Backend (Django + DRF)
- **Framework**: Django 5.2 + Django REST Framework
- **Database**: SQLite (development)
- **Authentication**: JWT (djangorestframework-simplejwt)
- **Transcription Engine**: faster-whisper (OpenAI Whisper)
- **API Port**: 8000 (configurable)

### Frontend (React + Vite)
- **Framework**: React 19.1 with React Router
- **Build Tool**: Vite
- **UI Components**: Headless UI, Lucide React
- **API Client**: Axios with JWT interceptors
- **Dev Port**: 5173

### Django Apps Structure

The backend is organized into modular Django apps:

- **accounts**: User authentication, registration, JWT token management, role-based access (admin/editor/viewer)
- **media**: MediaFile model (with deduplication via SHA256), Tag management, Job model for transcription tasks
- **transcripts**: Transcript and TranscriptVersion models with versioning support, QC status tracking
- **tasks**: Generic task queue system with status tracking (pending/running/completed/failed/cancelled)
- **scheduler**: Scheduling functionality using APScheduler
- **activities**: Activity logging and audit trails
- **audit**: System audit records
- **settings**: Application-level settings management

### Standalone Pipeline (`src/pipeline/`)

A batch processing pipeline for local media transcription, independent of the Django backend:

- **orchestrator.py**: Main pipeline orchestration (ingest → extract audio → chunk → transcribe → export)
- **manifest.py**: SQLModel-based tracking database for sources and chunks
- **transcribe.py**: Whisper model loading and transcription
- **media.py**: FFmpeg integration for audio extraction and chunking
- **cleaning.py**: Transcript cleaning and post-processing
- **config.py**: Pipeline configuration (Whisper model, device, language)
- **cli.py**: Command-line interface

Pipeline workflow:
1. Scan input directory for media files
2. Extract audio tracks using FFmpeg
3. Chunk audio into manageable segments
4. Transcribe chunks with Whisper
5. Clean and merge transcripts
6. Export to JSONL and Parquet formats

## Development Commands

### Backend Setup

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
# Server runs on http://localhost:8000
```

### Frontend Setup

```bash
cd frontend
npm install

# Start development server
npm run dev
# Server runs on http://localhost:5173

# Build for production
npm run build

# Preview production build
npm preview
```

### Code Quality

```bash
# From project root, run Ruff on backend and pipeline
ruff check backend src

# Auto-fix common issues
ruff check backend src --fix

# Format code
ruff format backend src
```

Ruff is configured in `backend/pyproject.toml` with:
- Line length: 88 characters
- Target: Python 3.11+
- Enabled rules: E, W, F, I, B, C4, UP, ARG, SIM, TCH, PTH, ERA, PL, RUF
- Migrations directory excluded from linting

### Testing

Currently uses manual API testing scripts:

```bash
cd backend
source venv/bin/activate

# Test authentication flow
python test_auth.py

# Test resource endpoints
python test_resources.py

# Test search functionality
python test_search.py
```

Note: Django server must be running on port 8000 before running test scripts.

### Standalone Pipeline

```bash
# Run the full pipeline
python -m src.pipeline.cli run --config config/default.yaml

# Individual stages can be invoked programmatically via orchestrator.py
```

## Key Configuration

### Django Settings (`backend/media_manager/settings.py`)

- **Timezone**: Asia/Shanghai
- **JWT Tokens**: 12-hour access, 7-day refresh with rotation
- **REST Framework**: JWT authentication required by default, pagination at 20 items
- **CORS**: Enabled for all origins (development)
- **Media Files**: Stored in `backend/media/`

EchoTrace-specific settings in `ECHOTRACE` dict:
- `WHISPER_MODEL`: Model size (tiny/base/small/medium/large)
- `WHISPER_DEVICE`: Device selection (auto/cpu/cuda)
- `WHISPER_LANGUAGE`: Language detection (zh/en/auto)
- `WORKER_CONCURRENCY`: Number of concurrent workers
- `MAX_FILE_SIZE`: 2GB file upload limit
- `TRANSCRIPTION_TIMEOUT`: 1 hour per file

### Frontend API Configuration (`frontend/src/App.jsx`)

- **API Base URL**: `http://localhost:8001/api` (configurable via `API_BASE`)
- **Token Storage**: localStorage keys: `token`, `user`
- **Auto-redirect**: 401 responses trigger redirect to `/signin`

## Database Models

### Core Relationships

```
User (Django auth)
  ├─> MediaFile (owner)
  │    ├─> Job (transcription jobs)
  │    └─> Transcript (one-to-one)
  │         └─> TranscriptVersion (versioning)
  ├─> Task (created_by, assigned_to)
  └─> Tag (created_by)
```

### MediaFile Model
- **Deduplication**: SHA256 file hash (unique constraint)
- **Status Flow**: pending → processing → done/failed
- **Metadata**: duration (seconds), size (bytes), media_type (audio/video), source_type (local/nas)

### Transcript Model
- **Versioning**: Each edit creates a new TranscriptVersion
- **QC Status**: unreviewed/reviewed
- **Properties**: `current_content`, `version_count`
- **Methods**: `create_version()`, `rollback_to_version()`, `mark_reviewed()`

### Job Model
- **Priority Queue**: High priority jobs processed first
- **Status Flow**: pending → processing → succeeded/failed/canceled
- **Tracking**: `started_at`, `finished_at`, `duration` property
- **Error Handling**: Stores `error_message` on failure

### Task Model
- **Generic Task Queue**: Supports transcription, upload, import, export types
- **Priority Levels**: low/normal/high/urgent
- **Progress Tracking**: 0-100 integer
- **JSON Fields**: `parameters` (input), `result` (output)

## Routing

### Backend API Routes (`backend/media_manager/urls.py`)
All routes prefixed with `/api/`:
- `/api/` - accounts (auth endpoints)
- `/api/` - media (file upload, management)
- `/api/transcripts/` - transcript CRUD and versioning
- `/api/` - tasks (task queue management)
- `/api/` - settings (app settings)
- `/api/` - scheduler (job scheduling)
- `/api/` - activities (activity logs)
- `/admin/` - Django admin interface

### Frontend Routes (`frontend/src/App.jsx`)
- `/signin`, `/register` - Public authentication pages
- `/dashboard` - Main dashboard (default route)
- `/tasks` - Task queue view
- `/results` - Transcription results
- `/resources` - Media file management
- `/scheduler` - Job scheduling
- `/activity` - Activity log
- `/settings`, `/users` - Admin-only routes

## Important Notes

### Authentication Flow
1. User registers/signs in via `/api/auth/signup` or `/api/auth/signin`
2. Backend returns JWT `access` and `refresh` tokens
3. Frontend stores tokens in localStorage
4. Axios interceptor adds `Authorization: Bearer <token>` header
5. Token refresh handled via `/api/auth/refresh`
6. 401 responses auto-redirect to signin

### Role-Based Access Control
Three user roles with different permissions:
- **admin**: Full system access including user management and settings
- **editor**: Can create, edit, and manage media/transcripts
- **viewer**: Read-only access to transcripts and media

### File Upload Flow
1. Frontend uploads media file to `/api/media/`
2. Backend calculates SHA256 hash for deduplication
3. Creates MediaFile record with status "pending"
4. Creates associated Job record
5. Background worker picks up job and transcribes
6. Job status updates: pending → processing → succeeded
7. Transcript created and linked to MediaFile

### Transcript Versioning
- Every transcript edit creates a new TranscriptVersion
- `current_version` foreign key tracks active version
- Version numbers auto-increment starting from 1
- Rollback supported via `rollback_to_version()`
- Version history preserved for audit trail

### Pipeline vs Django Backend
- **Pipeline**: Standalone batch processor for local files, outputs to JSONL/Parquet
- **Django Backend**: Web API with database, user management, and UI
- Both use faster-whisper for transcription but with separate configurations
- Pipeline uses SQLModel for tracking, Django backend uses Django ORM

## Tech Stack Details

### Python Dependencies
- Django 5.2 + djangorestframework 3.14.0
- faster-whisper 1.2.0 (Whisper implementation)
- APScheduler 3.10.4 (task scheduling)
- pydantic 2.12.2 (data validation)
- python-dotenv 1.0.0 (environment variables)

### Frontend Dependencies
- React 19.1 + React Router 6.28
- Axios 1.12.2 (HTTP client)
- Lucide React 0.468.0 (icons)
- Headless UI 2.2.0 (accessible components)
- Vite 7.1.7 (build tool)

### Development Tools
- Ruff 0.14.1 (linting and formatting)
- ESLint 9.36.0 (JavaScript linting)
