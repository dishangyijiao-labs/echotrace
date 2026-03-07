import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, RefreshCw, RotateCcw, CheckSquare, Square } from "lucide-react";
import api from "../lib/api";
import { formatDateTime } from "../lib/utils";

const STATUS_LABELS = {
  queued: "排队中",
  running: "处理中",
  done: "已完成",
  error: "失败"
};

const MODEL_OPTIONS = [
  { value: "tiny",     label: "tiny  — 最快，精度低" },
  { value: "small",    label: "small — 推荐，速度与精度均衡" },
  { value: "medium",   label: "medium — 较慢，精度高" },
  { value: "large",    label: "large — 最慢，精度最高" },
];

function calcEta(history) {
  if (!history || history.length < 3) return null;
  const recent = history.slice(-6);
  const dt = recent[recent.length - 1].t - recent[0].t;
  const dv = recent[recent.length - 1].v - recent[0].v;
  if (dt <= 0 || dv <= 0) return null;
  const rate = dv / dt;
  const remaining = 1 - recent[recent.length - 1].v;
  const msLeft = remaining / rate;
  const s = Math.round(msLeft / 1000);
  if (s <= 0) return null;
  if (s < 60) return `约 ${s} 秒`;
  if (s < 3600) return `约 ${Math.round(s / 60)} 分钟`;
  return `约 ${(s / 3600).toFixed(1)} 小时`;
}

function TaskQueue() {
  const [jobs, setJobs] = useState([]);
  const [progressHistory, setProgressHistory] = useState({});
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchModel, setBatchModel] = useState("small");
  const [batchDevice, setBatchDevice] = useState("cpu");
  const [batchResult, setBatchResult] = useState(null);
  const intervalRef = useRef(null);

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
          if (!last || last.v !== entry.v) history.push(entry);
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
    intervalRef.current = setInterval(() => loadJobs(false), 3000);
    return () => clearInterval(intervalRef.current);
  }, [loadJobs, loadMedia]);

  const mediaMap = useMemo(() => {
    const map = {};
    media.forEach((m) => { map[m.id] = m; });
    return map;
  }, [media]);

  // 已有未完成任务的 media_id，用于标记
  const busyMediaIds = useMemo(() => {
    const ids = new Set();
    jobs.forEach((j) => {
      if (j.status === "queued" || j.status === "running") ids.add(j.media_id);
    });
    return ids;
  }, [jobs]);

  const availableMedia = useMemo(
    () => media.filter((m) => !busyMediaIds.has(m.id)),
    [media, busyMediaIds]
  );

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(availableMedia.map((m) => m.id)));
  const clearAll = () => setSelectedIds(new Set());

  const createBatchJobs = async () => {
    if (selectedIds.size === 0) return;
    setCreating(true);
    setBatchResult(null);
    let success = 0;
    let failed = 0;
    for (const media_id of selectedIds) {
      try {
        await api.post("/jobs/transcribe", {
          media_id,
          model: batchModel,
          device: batchDevice,
          engine: "whisper"
        });
        success++;
      } catch {
        failed++;
      }
    }
    setBatchResult({ success, failed });
    setSelectedIds(new Set());
    loadJobs();
    loadMedia();
    setCreating(false);
  };

  const retryJob = async (job) => {
    try {
      await api.post("/jobs/transcribe", {
        media_id: job.media_id,
        model: job.model,
        device: job.device,
        engine: "whisper"
      });
      loadJobs();
    } catch (error) {
      console.error("Retry failed:", error);
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case "done":    return "badge badge-success";
      case "running": return "badge badge-warning";
      case "error":   return "badge badge-error";
      default:        return "badge badge-info";
    }
  };

  const renderSparkline = (jobId) => {
    const history = progressHistory[jobId] || [];
    if (history.length < 2) return null;
    const width = 120, height = 28;
    const points = history
      .map((point, i) => {
        const x = (i / (history.length - 1)) * width;
        const y = height - point.v * height;
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-28 h-6">
        <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={points} />
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
          <p className="mt-2 text-gray-600">批量创建转写任务，跟踪处理状态。</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadJobs}>
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* 批量创建区域 */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">批量新建任务</h2>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={selectAll}
              disabled={availableMedia.length === 0}
            >
              全选
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              className="text-gray-500 hover:underline"
              onClick={clearAll}
            >
              取消
            </button>
          </div>
        </div>

        {availableMedia.length === 0 ? (
          <p className="text-sm text-gray-400">暂无可用文件（所有文件已在队列中）</p>
        ) : (
          <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
            {availableMedia.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
              >
                {selectedIds.has(m.id)
                  ? <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />
                  : <Square className="w-4 h-4 text-gray-300 shrink-0" />
                }
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selectedIds.has(m.id)}
                  onChange={() => toggleSelect(m.id)}
                />
                <span className="text-sm text-gray-700 truncate">{m.filename}</span>
                <span className="ml-auto text-xs text-gray-400 shrink-0">{m.file_type?.split("/")[0]}</span>
              </label>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">模型</label>
            <select
              className="form-input"
              value={batchModel}
              onChange={(e) => setBatchModel(e.target.value)}
            >
              {MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">设备</label>
            <select
              className="form-input"
              value={batchDevice}
              onChange={(e) => setBatchDevice(e.target.value)}
            >
              <option value="cpu">CPU</option>
              <option value="cuda">CUDA（需要 NVIDIA GPU）</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="btn btn-primary"
            onClick={createBatchJobs}
            disabled={creating || selectedIds.size === 0}
          >
            <Play className="w-4 h-4" />
            {creating
              ? "提交中..."
              : selectedIds.size > 0
                ? `开始转写（${selectedIds.size} 个文件）`
                : "选择文件后开始"
            }
          </button>
          {batchResult && (
            <span className="text-sm text-gray-600">
              成功 {batchResult.success} 个
              {batchResult.failed > 0 && `，失败 ${batchResult.failed} 个`}
            </span>
          )}
        </div>
      </div>

      {/* 任务列表 */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>文件</th>
                <th>模型</th>
                <th>状态</th>
                <th>进度</th>
                <th>预计剩余</th>
                <th>更新时间</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const progress = Math.min(Math.max(job.progress || 0, 0), 1);
                const percent = Math.round(progress * 100);
                const history = progressHistory[job.id] || [];
                const eta = job.status === "running" ? calcEta(history) : null;
                const filename = mediaMap[job.media_id]?.filename || `媒体 ${job.media_id}`;
                return (
                  <tr key={job.id}>
                    <td className="max-w-xs truncate text-sm" title={filename}>
                      {filename}
                    </td>
                    <td className="text-sm">{job.model}</td>
                    <td>
                      <span className={statusBadge(job.status)}>
                        {STATUS_LABELS[job.status] || job.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-blue-500 transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {percent}%
                        </span>
                      </div>
                      <div className="mt-1">{renderSparkline(job.id)}</div>
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {eta || (job.status === "done" ? "—" : "")}
                    </td>
                    <td className="text-xs text-gray-400">
                      {formatDateTime(job.updated_at)}
                    </td>
                    <td>
                      {job.status === "error" && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs flex items-center gap-1"
                          onClick={() => retryJob(job)}
                          title={job.error || "重试"}
                        >
                          <RotateCcw className="w-3 h-3" />
                          重试
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {jobs.length === 0 && (
            <div className="empty-state">
              <p className="empty-state-title">暂无任务</p>
              <p className="empty-state-text">选择文件并创建第一个转写任务。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskQueue;
