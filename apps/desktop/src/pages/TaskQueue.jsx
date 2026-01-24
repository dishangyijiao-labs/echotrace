import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import api from "../lib/api";

const STATUS_LABELS = {
  queued: "排队中",
  running: "处理中",
  done: "已完成",
  error: "失败"
};

function TaskQueue() {
  const [jobs, setJobs] = useState([]);
  const [progressHistory, setProgressHistory] = useState({});
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newJob, setNewJob] = useState({
    media_id: "",
    model: "small",
    device: "cpu"
  });

  const loadJobs = useCallback(async (withLoading = true) => {
    try {
      if (withLoading) setLoading(true);
      const response = await api.get("/jobs");
      const data = response.data?.data || [];
      setJobs(data);
      setProgressHistory((prev) => {
        const next = { ...prev };
        const now = Date.now();
        data.forEach((job) => {
          const progress = Math.min(Math.max(job.progress || 0, 0), 1);
          const entry = { t: now, v: progress };
          const history = next[job.id] ? [...next[job.id]] : [];
          const last = history[history.length - 1];
          if (!last || last.v !== entry.v) {
            history.push(entry);
          }
          next[job.id] = history.slice(-30);
        });
        return next;
      });
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      if (withLoading) setLoading(false);
    }
  }, []);

  const loadMedia = useCallback(async () => {
    try {
      const response = await api.get("/media");
      setMedia(response.data?.data || []);
    } catch (error) {
      console.error("Failed to load media:", error);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    loadMedia();
    const interval = setInterval(() => loadJobs(false), 3000);
    return () => clearInterval(interval);
  }, [loadJobs, loadMedia]);

  const createJob = async () => {
    if (!newJob.media_id) return;
    try {
      setCreating(true);
      await api.post("/jobs/transcribe", {
        media_id: Number(newJob.media_id),
        model: newJob.model,
        device: newJob.device,
        engine: "whisper"
      });
      setNewJob({ media_id: "", model: "small", device: "cpu" });
      loadJobs();
    } catch (error) {
      console.error("Failed to create job:", error);
    } finally {
      setCreating(false);
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case "done":
        return "badge badge-success";
      case "running":
        return "badge badge-warning";
      case "error":
        return "badge badge-error";
      default:
        return "badge badge-info";
    }
  };

  const mediaOptions = useMemo(
    () => media.map((item) => ({ value: item.id, label: item.filename })),
    [media]
  );

  const renderSparkline = (jobId) => {
    const history = progressHistory[jobId] || [];
    if (history.length < 2) return null;
    const width = 120;
    const height = 28;
    const points = history
      .map((point, index) => {
        const x = (index / (history.length - 1)) * width;
        const y = height - point.v * height;
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-28 h-6">
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          points={points}
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">任务队列</h1>
          <p className="mt-2 text-gray-600">
            创建转写任务并跟踪处理状态。
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadJobs}>
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">新建任务</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">资源文件</label>
            <select
              className="form-input"
              value={newJob.media_id}
              onChange={(event) =>
                setNewJob((prev) => ({ ...prev, media_id: event.target.value }))
              }
            >
              <option value="">选择文件</option>
              {mediaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">模型</label>
            <select
              className="form-input"
              value={newJob.model}
              onChange={(event) =>
                setNewJob((prev) => ({ ...prev, model: event.target.value }))
              }
            >
              <option value="tiny">tiny</option>
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large">large</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">设备</label>
            <select
              className="form-input"
              value={newJob.device}
              onChange={(event) =>
                setNewJob((prev) => ({ ...prev, device: event.target.value }))
              }
            >
              <option value="cpu">CPU</option>
              <option value="cuda">CUDA</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={createJob}
          disabled={creating || !newJob.media_id}
        >
          <Play className="w-4 h-4" />
          {creating ? "创建中..." : "开始转写"}
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>任务</th>
                <th>模型</th>
                <th>设备</th>
                <th>状态</th>
                <th>进度</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const progress = Math.min(Math.max(job.progress || 0, 0), 1);
                const percent = Math.round(progress * 100);
                return (
                  <tr key={job.id}>
                    <td>#{job.id} / 媒体 {job.media_id}</td>
                    <td>{job.model}</td>
                    <td>{job.device}</td>
                    <td>
                      <span className={statusBadge(job.status)}>
                        {STATUS_LABELS[job.status] || job.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-28 bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {percent}% ({job.processed_segments || 0}/{job.total_segments || 0})
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        {renderSparkline(job.id)}
                      </div>
                    </td>
                    <td className="text-xs text-gray-500">{job.updated_at}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {jobs.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">暂无任务</p>
              <p className="empty-state-text">选择文件并创建第一个转写任务。</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default TaskQueue;
