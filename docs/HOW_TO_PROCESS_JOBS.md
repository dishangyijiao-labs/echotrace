# How to Process Transcription Jobs

## Overview

When you create a transcription job in the Task Queue, it starts with status **"等待中" (Pending)**. To actually transcribe the media file, you need to run the **job processor worker**.

---

## Quick Start

### Start the Worker (Background Mode)

Run this command to start continuous job processing:

```bash
cd /Users/zhanghao/CS/Tools/echotrace
docker exec -d echotrace-backend python manage.py process_jobs --interval 5
```

✅ The worker will now:
- Check for pending jobs every 5 seconds
- Process them automatically
- Keep running in the background

---

## Worker Commands

### 1. Background Mode (Recommended for Production)

```bash
# Start worker that runs continuously
docker exec -d echotrace-backend python manage.py process_jobs --interval 5
```

- Polls every 5 seconds for new jobs
- Processes them automatically
- Runs in the background (`-d` flag)

### 2. Foreground Mode (For Debugging)

```bash
# See live processing output
docker exec -it echotrace-backend python manage.py process_jobs --interval 5
```

- Shows real-time logs
- Use Ctrl+C to stop
- Good for debugging

### 3. One-Time Processing (For Testing)

```bash
# Process pending jobs once and exit
docker exec echotrace-backend python manage.py process_jobs --once
```

- Processes all pending jobs
- Exits after completion
- Useful for testing

---

## How the Worker Works

### Job Processing Flow

```
1. Worker polls database for jobs with status="pending"
   ↓
2. Picks job with highest priority (or oldest if same priority)
   ↓
3. Marks job as "processing"
   ↓
4. Loads faster-whisper model (small/medium/large)
   ↓
5. Transcribes the media file
   ↓
6. Saves transcript to database
   ↓
7. Marks job as "succeeded" or "failed"
```

### What You'll See

When processing a job, the worker outputs:

```
Starting job processor (interval: 5s, once: False)
Found 1 pending jobs
Processing job 1 - 短语音测试。.mp4
  Loading model: small
  Transcribing: 短语音测试。.mp4
  Saving transcript (15 segments)
  ✓ Saved transcript version 1
✓ Job 1 completed successfully
```

---

## Monitoring Jobs

### Check Job Status via Web UI

1. Navigate to **Task Queue**: `http://localhost:8080/taskqueue`
2. Jobs show status badges:
   - 🟡 **等待中** (Pending) - Not yet processed
   - 🔵 **处理中** (Processing) - Currently transcribing
   - 🟢 **已完成** (Succeeded) - Completed successfully
   - 🔴 **失败** (Failed) - Error occurred
   - ⚫ **已取消** (Canceled) - User canceled

### Check Job Status via CLI

```bash
# List all jobs
docker exec echotrace-backend python manage.py shell -c "
from media.models import Job
for job in Job.objects.all():
    print(f'Job {job.id}: {job.media.filename} - {job.status}')
"

# Check specific job
docker exec echotrace-backend python manage.py shell -c "
from media.models import Job
job = Job.objects.get(id=1)
print(f'Status: {job.status}')
print(f'Created: {job.created_at}')
"
```

---

## Viewing Transcripts

### Via Web UI

1. Go to **Transcripts**: `http://localhost:8080/transcripts`
2. Find your media file
3. View the transcribed text with timestamps

### Via CLI

```bash
docker exec echotrace-backend python manage.py shell -c "
from transcripts.models import Transcript
transcript = Transcript.objects.first()
print(f'Media: {transcript.media.filename}')
print(f'Versions: {transcript.versions.count()}')
print(f'Content preview:')
print(transcript.versions.first().content[:300])
"
```

---

## Troubleshooting

### Job Stuck in "处理中" (Processing)

If a job gets stuck (worker crashed while processing):

```bash
# Reset job to pending
docker exec echotrace-backend python manage.py shell -c "
from media.models import Job
job = Job.objects.get(id=1)  # Replace with your job ID
job.status = 'pending'
job.save()
print('Job reset to pending')
"

# Then restart the worker
docker exec -d echotrace-backend python manage.py process_jobs --interval 5
```

### Check if Worker is Running

```bash
# List processes
docker exec echotrace-backend ps aux | grep process_jobs
```

If no output, the worker is not running. Start it with:

```bash
docker exec -d echotrace-backend python manage.py process_jobs --interval 5
```

### View Worker Logs

```bash
# See recent worker output
docker logs echotrace-backend --tail 50 | grep -A 10 "process"
```

### Job Fails with Error

Check the job's error message:

```bash
docker exec echotrace-backend python manage.py shell -c "
from media.models import Job
job = Job.objects.get(status='failed')
print(f'Job {job.id} failed:')
print(f'Error: {job.error_message}')
"
```

Common errors:
- **File not found**: Media file path is invalid
- **Model download failed**: Internet connection issue downloading Whisper model
- **Out of memory**: Model too large for available RAM (try "small" instead of "large")

---

## Worker Options

### Command Line Arguments

```bash
python manage.py process_jobs [OPTIONS]
```

**Options:**
- `--once` - Process once and exit (default: continuous loop)
- `--interval SECONDS` - Poll interval (default: 5 seconds)

**Examples:**

```bash
# Fast polling (every 2 seconds)
docker exec -d echotrace-backend python manage.py process_jobs --interval 2

# Slow polling (every 30 seconds)
docker exec -d echotrace-backend python manage.py process_jobs --interval 30

# Process once for testing
docker exec echotrace-backend python manage.py process_jobs --once
```

---

## Production Recommendations

### 1. Run Worker as a Service

For production, add the worker to your `docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  job-worker:
    build:
      context: backend
      dockerfile: Dockerfile
    container_name: echotrace-job-worker
    depends_on:
      - backend
    volumes:
      - backend_data:/app/data
      - backend_media:/app/media
    command: python manage.py process_jobs --interval 5
    environment:
      DJANGO_DEBUG: "false"
      DJANGO_SECRET_KEY: "${DJANGO_SECRET_KEY}"
      # ... other env vars ...
```

Then start all services:

```bash
docker compose up -d
```

### 2. Monitor Worker Health

Set up a health check to ensure the worker is running:

```bash
#!/bin/bash
# check_worker.sh

if docker exec echotrace-backend ps aux | grep -q "process_jobs"; then
    echo "✅ Worker is running"
    exit 0
else
    echo "❌ Worker is NOT running"
    echo "Starting worker..."
    docker exec -d echotrace-backend python manage.py process_jobs --interval 5
    exit 1
fi
```

Run this script with cron every 5 minutes.

### 3. Configure Job Priority

Create high-priority jobs for urgent transcriptions:

```python
# In the frontend or via API
{
    "media_id": 123,
    "priority": 1,  # Higher priority (0=normal, 1=high)
    "engine": "whisper",
    "engine_model": "small"
}
```

High-priority jobs are processed first.

---

## FAQ

### Q: Do I need to restart the worker after creating a new job?

**A:** No! The worker polls the database every few seconds and automatically picks up new pending jobs.

### Q: Can I run multiple workers?

**A:** Yes! You can run multiple worker processes for parallel processing:

```bash
docker exec -d echotrace-backend python manage.py process_jobs --interval 5
docker exec -d echotrace-backend python manage.py process_jobs --interval 5
```

Each worker will pick up different pending jobs.

### Q: How long does transcription take?

**A:** Depends on:
- Media duration (longer = more time)
- Model size (large > medium > small)
- CPU/GPU availability (GPU is much faster)

Typical:
- 1 minute audio with "small" model: ~10-30 seconds
- 1 minute audio with "large" model: ~1-2 minutes

### Q: Where are the transcripts saved?

**A:** In the database (SQLite at `/app/data/db.sqlite3` in the container). They're accessible via:
- Web UI: `http://localhost:8080/transcripts`
- API: `GET /api/transcripts/`

### Q: What happens if the worker crashes?

**A:** Jobs being processed will be stuck in "processing" status. Reset them to "pending" (see Troubleshooting section) and restart the worker.

---

## Summary

✅ **To start processing jobs:**
```bash
docker exec -d echotrace-backend python manage.py process_jobs --interval 5
```

✅ **To check if worker is running:**
```bash
docker exec echotrace-backend ps aux | grep process_jobs
```

✅ **To view transcripts:**
- Web UI: `http://localhost:8080/transcripts`
- Or check database via Django shell

That's it! The worker will handle all your transcription jobs automatically. 🚀
