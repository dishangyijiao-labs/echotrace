# Scheduler vs Task Queue: Architecture Guide

## Overview

EchoTrace uses two separate but complementary systems for managing transcription work:

1. **Task Queue** (`/taskqueue`) - Monitors **current job execution**
2. **Scheduler** (`/scheduler`) - Automates **recurring job creation**

These systems **DO NOT conflict** - they serve different purposes in the transcription workflow.

---

## Task Queue (Job Monitoring)

### Purpose
Monitor and manage **individual transcription jobs** that are currently being processed or queued for processing.

### What It Does
- Shows all **Job** records from the database
- Displays job status (pending, processing, completed, failed)
- Allows creating new jobs for specific media files
- Tracks which resources are being transcribed
- Shows transcription engine and model being used

### User Workflow
1. User uploads a media file (creates **MediaFile** record)
2. User creates a transcription job (creates **Job** record)
3. Job appears in Task Queue with "Pending" status
4. Background worker (`process_jobs.py`) picks up the job
5. Task Queue updates to show "Processing" → "Completed" or "Failed"

### Key Model
```python
Job
├── media (MediaFile reference)
├── status (pending/processing/completed/failed)
├── engine (whisper)
├── engine_model (small/medium/large)
└── created_at
```

---

## Scheduler (Automated Job Creation)

### Purpose
Automatically create transcription jobs on a **recurring schedule** without manual intervention.

### What It Does
- **NOT** a job executor - it creates jobs for the Task Queue worker to process
- Runs on a schedule (daily, weekly, monthly)
- Automatically creates Job records for new/pending media files
- Useful for batch processing workflows

### Use Cases

#### Example 1: Daily Batch Transcription
```
Schedule: "Daily 9 AM Batch Processing"
- Type: Daily
- Time: 09:00
- Settings: {language: "zh-CN", model: "whisper-large"}

What happens:
→ Every day at 9 AM, scheduler creates Job records for all pending MediaFiles
→ Jobs appear in Task Queue
→ Worker processes them automatically
```

#### Example 2: Weekly Report Generation
```
Schedule: "Weekly Meeting Transcription"
- Type: Weekly
- Days: Monday, Friday
- Time: 18:00
- Settings: {auto_process: true}

What happens:
→ Every Monday and Friday at 6 PM, scheduler creates jobs for meeting recordings
→ Overnight processing completes before next business day
```

### Key Models
```python
Schedule
├── name
├── schedule_type (daily/weekly/monthly)
├── time (HH:MM)
├── days_of_week (for weekly schedules)
├── is_active (can be paused)
└── settings (language, model, auto_process)

ScheduleRun (execution history)
├── schedule (reference)
├── status (success/failed)
├── timestamp
├── duration
└── jobs_created (how many jobs were created)
```

---

## How They Work Together

```
┌─────────────┐
│  Scheduler  │  (Recurring automation)
└──────┬──────┘
       │ Creates jobs automatically
       ▼
┌─────────────┐
│ Task Queue  │  (Job monitoring)
└──────┬──────┘
       │ Shows all jobs (manual + automated)
       ▼
┌─────────────┐
│   Worker    │  (Actual transcription)
│process_jobs │
└─────────────┘
```

### Concrete Example

**Setup:**
1. User creates schedule: "Daily 9 AM Transcription"
2. User uploads 3 media files throughout the day

**Next Day at 9 AM:**
1. **Scheduler** wakes up and runs
2. Finds 3 pending MediaFile records
3. Creates 3 Job records (one for each media file)
4. **Task Queue** page now shows 3 new jobs in "Pending" status
5. **Worker** (`process_jobs.py`) picks them up one by one
6. **Task Queue** updates to show "Processing" → "Completed"
7. **Scheduler** records a ScheduleRun (3 jobs created, success)

---

## When to Use Each

### Use Task Queue When:
- ✅ Manually creating jobs for specific files
- ✅ Monitoring current transcription progress
- ✅ Checking status of individual jobs
- ✅ Troubleshooting failed transcriptions

### Use Scheduler When:
- ✅ Setting up automated batch processing
- ✅ Processing files at specific times (e.g., overnight)
- ✅ Recurring transcription needs (daily reports, weekly meetings)
- ✅ Reducing manual job creation overhead

---

## API Endpoints

### Task Queue (Jobs)
```
GET    /api/jobs/              # List all jobs
POST   /api/jobs/              # Create a new job
GET    /api/jobs/{id}/         # Get job details
PATCH  /api/jobs/{id}/         # Update job
POST   /api/jobs/{id}/cancel   # Cancel job
POST   /api/jobs/{id}/retry    # Retry failed job
```

### Scheduler
```
GET    /api/schedules/         # List all schedules
POST   /api/schedules/         # Create new schedule
GET    /api/schedules/{id}/    # Get schedule details
PATCH  /api/schedules/{id}/    # Update schedule (toggle active)
DELETE /api/schedules/{id}/    # Delete schedule
GET    /api/schedules/{id}/runs/  # Get execution history
```

---

## Database Schema

### Relationships
```
User ──┬── MediaFile ──┬── Job ←── Worker processes
       │               │
       └── Schedule    │
           └── ScheduleRun (creates) → Job
```

---

## Configuration

### Frontend Routes
- `/taskqueue` - `TaskQueue.jsx` - Shows Job records
- `/scheduler` - `Scheduler.jsx` - Shows Schedule records

### Backend Apps
- `media` - Handles MediaFile and Job models
- `scheduler` - Handles Schedule and ScheduleRun models

### Background Worker
- `python manage.py process_jobs` - Processes pending jobs
- Needs to run continuously (as daemon or cron job)

---

## Best Practices

### For Development
1. Keep Task Queue for **immediate, manual transcription**
2. Use Scheduler for **testing automated workflows**
3. Monitor ScheduleRun history to debug scheduling issues

### For Production
1. Run scheduler as a separate service (cron or celery beat)
2. Use Task Queue to monitor all jobs (manual + automated)
3. Set up alerts for failed ScheduleRun records
4. Pause schedules during maintenance windows

---

## Summary

| Feature | Task Queue | Scheduler |
|---------|-----------|-----------|
| **Purpose** | Monitor job execution | Automate job creation |
| **User Action** | Manual job creation | Set-and-forget automation |
| **Shows** | Individual jobs | Recurring schedules |
| **Updates** | Real-time status | Schedule configuration |
| **Use Case** | On-demand transcription | Batch processing |

**Key Insight:** Scheduler doesn't replace Task Queue - it feeds jobs into it automatically!
