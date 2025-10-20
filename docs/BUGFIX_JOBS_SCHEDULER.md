# Bug Fixes: Task Queue Jobs List & Scheduler Modal

## Issues Fixed

### 1. ✅ Task Queue: Jobs Created But Not Showing in List

**Problem:**
- POST `/api/jobs/` created jobs successfully (201 status)
- GET `/api/jobs/` returned 405 Method Not Allowed
- Jobs list remained empty despite successful creation

**Root Cause:**
URL routing split GET and POST into separate views:
```python
# Old routing
path("jobs", JobListView.as_view(), name="jobs-list")     # GET only, no slash
path("jobs/", JobCreateView.as_view(), name="jobs-create") # POST only, with slash
```

Frontend called `/jobs/` (with slash) for both GET and POST, but `JobListView` only handled `/jobs` (without slash).

**Solution:**
Combined into single `JobListCreateView` handling both methods:
```python
class JobListCreateView(generics.ListCreateAPIView):
    """
    GET /api/jobs/ - List jobs
    POST /api/jobs/ - Create job
    """
```

**Files Changed:**
- `/backend/media/views.py` - Merged `JobListView` + `JobCreateView` → `JobListCreateView`
- `/backend/media/urls.py` - Updated to use `JobListCreateView` for both `/jobs` and `/jobs/`

---

### 2. ✅ Scheduler: "创建计划" Button Shows Blank Modal

**Problem:**
- Clicking "创建计划" (Create Schedule) button showed blank modal
- No content visible inside modal

**Root Cause:**
Frontend code and CSS were correct, but the **built frontend files in the Docker container** were outdated. The browser was loading old JavaScript that didn't include the Scheduler modal code.

**Solution:**
Rebuilt frontend with latest code and deployed to container:
```bash
cd frontend
npm run build
docker cp dist/. echotrace-frontend:/usr/share/nginx/html/
docker exec echotrace-frontend nginx -s reload
```

**Why This Happened:**
The frontend is served as static files from the Docker container. When you modify source code (`.jsx` files), you need to:
1. Rebuild the frontend (`npm run build`)
2. Copy the built files to the container
3. Reload nginx

Simply changing source files doesn't update what the browser sees.

---

## How to Test

### Test 1: Task Queue Job Creation and Listing

1. **Navigate to Task Queue:**
   ```
   http://localhost:8080/taskqueue
   ```

2. **Create a Job:**
   - Click "创建任务" (Create Task)
   - Select a resource from dropdown (NOT manual ID entry anymore!)
   - Click "创建任务" to submit

3. **Verify Job Appears:**
   - The new job should immediately appear in the jobs list
   - Status should show "等待中" (Pending)
   - Resource filename and details should be visible

4. **Check API Response:**
   ```bash
   # GET request should now work
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:8001/api/jobs/
   ```

---

### Test 2: Scheduler Modal

1. **Navigate to Scheduler:**
   ```
   http://localhost:8080/scheduler
   ```

2. **Open Create Modal:**
   - Click "创建计划" (Create Schedule) button
   - Modal should appear with full form

3. **Verify Modal Contents:**
   - ✅ Title: "创建新计划"
   - ✅ Fields visible:
     - 计划名称 (Schedule Name)
     - 描述 (Description)
     - 执行频率 (Frequency: Daily/Weekly/Monthly)
     - 执行时间 (Time picker)
     - 执行星期 (Days of week - for weekly)
     - 执行参数 (Language, Model)
     - 自动处理选项 (Auto-process checkbox)
   - ✅ Buttons: "取消" and "创建计划"

4. **Test Create Schedule:**
   - Fill in name: "测试计划"
   - Select frequency: Daily
   - Set time: 09:00
   - Click "创建计划"
   - Schedule should appear in list

---

## Deployment Steps Taken

### Backend Updates
```bash
# Copy updated views and URLs
docker cp backend/media/views.py echotrace-backend:/app/media/views.py
docker cp backend/media/urls.py echotrace-backend:/app/media/urls.py

# Django auto-reloads in development mode
```

### Frontend Updates
```bash
# Rebuild frontend
cd frontend
VITE_API_BASE=http://localhost:8001/api npm run build

# Deploy to container
docker cp dist/. echotrace-frontend:/usr/share/nginx/html/

# Reload nginx
docker exec echotrace-frontend nginx -s reload
```

---

## Important Notes

### For Future Development

1. **Frontend Changes Require Rebuild:**
   - Editing `.jsx` files doesn't update the browser immediately
   - Must run `npm run build` and copy to container
   - Or: Use `npm run dev` for hot-reload during development

2. **URL Trailing Slash Consistency:**
   - Django treats `/api/jobs` and `/api/jobs/` as different URLs
   - Best practice: Support both with and without slash
   - Use `APPEND_SLASH = True` in Django settings (already configured)

3. **API Response Wrapping:**
   - All endpoints should return `{ok: true, data: ...}` format
   - `JobListCreateView` now wraps both GET and POST responses

---

## Files Modified

### Backend
1. `/backend/media/views.py`
   - Removed: `JobListView`, `JobCreateView` (separate classes)
   - Added: `JobListCreateView` (combined ListCreateAPIView)
   - Added response wrapping for both list() and create()

2. `/backend/media/urls.py`
   - Updated imports: `JobListCreateView` instead of separate views
   - Both `/jobs` and `/jobs/` now point to `JobListCreateView`

### Frontend
- No code changes needed (was already correct)
- Only needed rebuild and redeploy

---

## API Endpoints (Updated)

### Jobs API
```
GET  /api/jobs/          # List all jobs (wrapped response)
GET  /api/jobs           # Same as above (no trailing slash)
POST /api/jobs/          # Create new job
GET  /api/jobs/{id}/     # Get job details
POST /api/jobs/{id}/retry   # Retry failed job
POST /api/jobs/{id}/cancel  # Cancel pending job
```

### Response Format
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "media": {
        "id": 5,
        "filename": "test.mp4",
        "media_type": "video"
      },
      "status": "pending",
      "engine": "whisper",
      "engine_model": "small",
      "created_at": "2025-10-20T14:48:58Z"
    }
  ]
}
```

---

## Summary

✅ **Fixed:** Jobs created successfully now appear in Task Queue list
✅ **Fixed:** Scheduler "创建计划" modal displays correctly with all fields
✅ **Deployed:** Both backend and frontend updates applied to running containers

**Next Steps:**
1. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
2. Test job creation and verify it appears in list
3. Test scheduler modal creation flow
