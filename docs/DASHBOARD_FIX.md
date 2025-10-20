# Dashboard Data Fix - 仪表盘数据修复

## Problem

The Dashboard page (`http://localhost:8080/dashboard`) was displaying incorrect or missing data because:
1. **Missing Backend API**: The frontend was calling `/api/dashboard/stats/` which returned **404 Not Found**
2. **No Data Aggregation**: There was no endpoint to collect statistics from different models
3. **Wrong Data Sources**: Stats were not being calculated from the correct database models

## Solution

Created a complete **Dashboard API** that aggregates real-time statistics from the database.

---

## Changes Made

### 1. New Backend App: `/backend/dashboard/`

Created a new Django app to handle dashboard statistics.

#### Files Created:
- `/backend/dashboard/__init__.py` - App initialization
- `/backend/dashboard/views.py` - Dashboard stats API view
- `/backend/dashboard/urls.py` - URL routing

### 2. Dashboard Stats Endpoint

**URL:** `GET /api/dashboard/stats/`

**Response Format:**
```json
{
  "ok": true,
  "data": {
    "totalResources": 5,
    "totalTranscripts": 3,
    "pendingTasks": 1,
    "completedTasks": 2,
    "activeUsers": 2,
    "recentActivity": [
      {
        "description": "admin 创建了转录任务",
        "timestamp": "5分钟前"
      },
      {
        "description": "admin 上传了文件",
        "timestamp": "1小时前"
      }
    ]
  }
}
```

### 3. Data Sources (Verified Correct)

All statistics now come from the **correct database models**:

| Statistic | Model | Query |
|-----------|-------|-------|
| **总资源数** | `MediaFile` | `MediaFile.objects.count()` |
| **转录文档** | `Transcript` | `Transcript.objects.count()` |
| **待处理任务** | `Job` | `Job.objects.filter(status="pending").count()` |
| **已完成任务** | `Job` | `Job.objects.filter(status="succeeded").count()` |
| **活跃用户** | `Activity` | Users with activity in last 7 days |
| **最近活动** | `Activity` | Last 10 activity records |

### 4. Frontend Fix

Updated [Dashboard.jsx](file:///Users/zhanghao/CS/Tools/echotrace/frontend/src/pages/Dashboard.jsx) to:
- Handle wrapped API response: `{ok: true, data: {...}}`
- Set default values on error (prevents showing `undefined`)
- Display "0" instead of blank when no data

### 5. URL Registration

Added dashboard routes to `/backend/media_manager/urls.py`:
```python
path("api/dashboard/", include("dashboard.urls")),
```

---

## Data Accuracy Verification

### Before Fix:
- ❌ All stats showed `undefined` or `0`
- ❌ Recent activity was empty
- ❌ API returned 404 error
- ❌ Console showed: `GET /api/dashboard/stats/ 404`

### After Fix:
- ✅ Total resources shows actual `MediaFile` count
- ✅ Transcripts shows actual `Transcript` count  
- ✅ Pending tasks shows jobs with `status="pending"`
- ✅ Completed tasks shows jobs with `status="succeeded"`
- ✅ Active users shows users with activity in last 7 days
- ✅ Recent activity displays last 10 actions with relative timestamps

---

## Testing

### Test the Dashboard

1. **Navigate to Dashboard:**
   ```
   http://localhost:8080/dashboard
   ```

2. **Verify Statistics:**
   - **总资源数**: Should match number of uploaded files in Resources page
   - **转录文档**: Should match number of transcripts in Transcripts page
   - **待处理任务**: Should match jobs with "等待中" status in Task Queue
   - **已完成任务**: Should match jobs with "已完成" status in Task Queue

3. **Check Recent Activity:**
   - Should show last 10 user actions
   - Time format: "刚刚", "5分钟前", "2小时前", "3天前"
   - Actions include: 上传文件, 创建转录任务, 下载文件, etc.

### Test the API Directly

```bash
# Get dashboard stats
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8001/api/dashboard/stats/

# Expected response (example):
{
  "ok": true,
  "data": {
    "totalResources": 5,
    "totalTranscripts": 3,
    "pendingTasks": 1,
    "completedTasks": 2,
    "activeUsers": 2,
    "recentActivity": [...]
  }
}
```

---

## Activity Action Mapping

The dashboard translates activity actions into Chinese descriptions:

| Action Code | Chinese Description |
|-------------|-------------------|
| `signup` | 注册了账号 |
| `signin` | 登录系统 |
| `logout` | 退出登录 |
| `upload` | 上传了文件 |
| `transcribe` | 创建了转录任务 |
| `edit_transcript` | 编辑了转录文本 |
| `delete` | 删除了资源 |
| `download` | 下载了文件 |

---

## Time Format Logic

Recent activity timestamps use relative time:

```python
< 1 minute:    "刚刚"
< 1 hour:      "N分钟前"
< 24 hours:    "N小时前"
>= 24 hours:   "N天前"
```

---

## Database Queries

### Total Resources
```python
MediaFile.objects.count()
```
Counts all uploaded media files (audio/video).

### Total Transcripts
```python
Transcript.objects.count()
```
Counts all transcript records (one per media file that has been transcribed).

### Pending Tasks
```python
Job.objects.filter(status="pending").count()
```
Counts jobs waiting to be processed by the worker.

### Completed Tasks
```python
Job.objects.filter(status="succeeded").count()
```
Counts successfully completed transcription jobs.

### Active Users (Last 7 Days)
```python
seven_days_ago = timezone.now() - timedelta(days=7)
Activity.objects.filter(timestamp__gte=seven_days_ago)\
    .values("user").distinct().count()
```
Counts unique users who performed any action in the last 7 days.

### Recent Activity
```python
Activity.objects.select_related("user")\
    .order_by("-timestamp")[:10]
```
Gets the 10 most recent activity records with user information.

---

## Troubleshooting

### Dashboard Still Shows 0 for Everything

**Cause:** No data in database yet

**Solution:**
1. Upload some media files in Resources page
2. Create transcription jobs in Task Queue
3. Wait for jobs to complete
4. Refresh dashboard

### Recent Activity is Empty

**Cause:** No recent user actions recorded

**Solution:**
- Perform some actions (upload, create job, download)
- These will be logged as activities
- Refresh dashboard to see them

### Active Users Shows 0

**Cause:** No user activity in last 7 days

**Solution:**
- Login, upload files, create jobs
- These actions count as user activity
- Number will update automatically

### Stats Don't Match Other Pages

**Possible Issues:**
1. **Caching**: Hard refresh browser (Ctrl+Shift+R)
2. **Old data**: Check if jobs have changed status
3. **Permissions**: Some users may not see all data

**Verify:**
```bash
# Check actual counts in database
docker exec echotrace-backend python manage.py shell -c "
from media.models import MediaFile, Job
from transcripts.models import Transcript
print(f'Resources: {MediaFile.objects.count()}')
print(f'Transcripts: {Transcript.objects.count()}')
print(f'Pending Jobs: {Job.objects.filter(status=\"pending\").count()}')
print(f'Completed Jobs: {Job.objects.filter(status=\"succeeded\").count()}')
"
```

---

## Summary

✅ **Fixed:** Dashboard now displays accurate real-time statistics
✅ **Added:** Complete `/api/dashboard/stats/` endpoint
✅ **Verified:** All data sources use correct database models
✅ **Enhanced:** Recent activity with user-friendly time format

**All dashboard statistics are now accurate and update in real-time!** 🎉
