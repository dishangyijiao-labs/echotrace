# Worker Web Management - 网页端工作进程管理

## Overview

You can now **start, stop, and restart** the transcription worker directly from the web UI! No more command line needed.

---

## Location

**Task Queue Page**: `http://localhost:8080/taskqueue`

At the top of the page, you'll see a **Worker Status Card** with:
- 🟢 **Green**: Worker is running
- 🔴 **Red**: Worker is stopped

---

## Features

### 1. Real-time Worker Status

The status card shows:
- **运行状态** (Status): 运行中 (Running) or 已停止 (Stopped)
- **PID**: Process ID (when running)
- **处理中** (Processing): Number of jobs currently being processed
- **等待中** (Pending): Number of jobs waiting to be processed

**Auto-refresh**: Status updates every 10 seconds automatically

### 2. One-Click Controls

#### When Worker is Stopped (Red):
- **启动 Worker** button - Starts the background worker

#### When Worker is Running (Green):
- **重启** button - Restarts the worker (useful if stuck)
- **停止** button - Stops the worker

---

## How to Use

### Starting the Worker

1. Go to `http://localhost:8080/taskqueue`
2. If the worker card shows **红色 (Red)**, click **"启动 Worker"**
3. Wait for confirmation: "Worker 已启动"
4. The card turns **绿色 (Green)** and shows the PID

### Stopping the Worker

1. Click the **"停止"** button (red button)
2. Wait for confirmation: "Worker 已停止"
3. The card turns **红色 (Red)**

### Restarting the Worker

If jobs get stuck or the worker seems unresponsive:
1. Click the **"重启"** button (circular arrow icon)
2. Wait for confirmation: "Worker 已重启"
3. Worker stops and starts fresh

---

## Workflow Example

### Scenario: Process Your First Transcription Job

1. **Upload a media file**:
   - Go to Resources page
   - Click "上传文件"
   - Select your audio/video file

2. **Create a transcription job**:
   - Go to Task Queue
   - Click "创建任务"
   - Select your uploaded file from dropdown
   - Click "创建任务"

3. **Start the worker** (if not already running):
   - Check the worker status card at top
   - If red (stopped), click "启动 Worker"
   - If green (running), you're good to go!

4. **Monitor progress**:
   - Job status changes: 等待中 → 处理中 → 已完成
   - Worker card shows processing count updates
   - Refresh page to see latest status

5. **View transcript**:
   - Go to Transcripts page
   - Find your media file
   - View the transcribed text with timestamps

---

## API Endpoints

For developers or advanced users:

### Get Worker Status
```bash
GET /api/jobs/worker/status

Response:
{
  "ok": true,
  "data": {
    "is_running": true,
    "pid": 12345,
    "processing_count": 1,
    "pending_count": 3
  }
}
```

### Control Worker
```bash
POST /api/jobs/worker/control
{
  "action": "start",  // or "stop", "restart"
  "interval": 5       // poll interval in seconds
}

Response:
{
  "ok": true,
  "data": {
    "success": true,
    "message": "Worker started successfully",
    "pid": 12345
  }
}
```

---

## Permissions

- **View Status**: Any authenticated user
- **Start/Stop/Restart**: Admin users only

If you're not an admin and try to start/stop the worker, you'll see an error message.

---

## Troubleshooting

### Worker Won't Start

**Symptom**: Click "启动 Worker" but it stays red

**Solutions**:
1. Check backend logs:
   ```bash
   docker logs echotrace-backend --tail 50
   ```
2. Try manually starting from command line:
   ```bash
   docker exec echotrace-backend python manage.py process_jobs --once
   ```
3. Check for errors in the output

### Worker Shows Running but Jobs Not Processing

**Symptom**: Worker card is green, but jobs stay in "等待中"

**Solutions**:
1. **Restart the worker**: Click "重启" button
2. **Check job details**: Look for error messages in job list
3. **Verify media file exists**: Check if the file path is valid

### Jobs Stuck in "处理中"

**Symptom**: Job stays in "processing" status for too long

**Solutions**:
1. **Restart the worker**: Click "重启"
2. **Check backend logs** for errors:
   ```bash
   docker logs echotrace-backend --tail 100 | grep -i error
   ```
3. The job will be reset to "pending" and picked up again

---

## Technical Details

### How It Works

1. **Frontend** sends API request to backend
2. **Backend** uses `WorkerManager` class to:
   - Start: Spawn subprocess running `process_jobs` command
   - Stop: Send SIGTERM signal to worker process
   - Status: Check if PID file exists and process is alive
3. **PID file** stored at `/tmp/echotrace_worker.pid`
4. **Worker process** runs in background, polls database every 5 seconds

### Worker Manager Location

Backend file: `/backend/media/management/commands/worker_manager.py`

Key methods:
- `WorkerManager.start(interval=5)` - Start worker
- `WorkerManager.stop()` - Stop worker  
- `WorkerManager.restart(interval=5)` - Restart worker
- `WorkerManager.is_running()` - Check status
- `WorkerManager.get_status()` - Get full status info

---

## Comparison: Web UI vs Command Line

| Feature | Web UI | Command Line |
|---------|--------|--------------|
| **Ease of Use** | ✅ Click buttons | ❌ Type commands |
| **Real-time Status** | ✅ Auto-updates | ❌ Manual check |
| **Permissions** | ✅ Admin only | ✅ Anyone with Docker access |
| **Restart** | ✅ One click | ❌ Stop then start |
| **View Logs** | ❌ Not available | ✅ Full output |

**Recommendation**: Use Web UI for normal operation, command line for debugging.

---

## Future Enhancements

Planned features:
- 📊 Worker performance metrics (jobs/minute)
- 📝 Live log viewer in web UI
- 🔔 Notifications when worker stops unexpectedly
- ⚙️ Configure poll interval from UI
- 📈 Historical processing stats

---

## Summary

✅ **Now you can manage the transcription worker from the web interface!**

**Quick Reference**:
1. Go to Task Queue page
2. Check worker status card at top
3. Click buttons to start/stop/restart
4. Monitor job processing in real-time

No more command line commands needed for normal operation! 🎉
