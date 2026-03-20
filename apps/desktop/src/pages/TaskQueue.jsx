import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, RefreshCw, RotateCcw, XCircle, CheckSquare, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../lib/api";
import { formatDateTime } from "../lib/utils";

function TaskQueue() {
  const { t } = useTranslation();

  const STATUS_LABELS = {
    queued: t('taskQueue.status.queued'),
    running: t('taskQueue.status.running'),
    done: t('taskQueue.status.done'),
    error: t('taskQueue.status.error'),
    cancelled: t('taskQueue.status.cancelled')
  };

  const MODEL_OPTIONS = [
    { value: "tiny",     label: t('taskQueue.model.tiny') },
    { value: "small",    label: t('taskQueue.model.small') },
    { value: "medium",   label: t('taskQueue.model.medium') },
    { value: "large-v3", label: t('taskQueue.model.large') },
  ];

  const calcEta = (history) => {
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
    if (s < 60) return t('taskQueue.eta.seconds', { s });
    if (s < 3600) return t('taskQueue.eta.minutes', { m: Math.round(s / 60) });
    return t('taskQueue.eta.hours', { h: (s / 3600).toFixed(1) });
  };

  const [jobs, setJobs] = useState([]);
  const [progressHistory, setProgressHistory] = useState({});
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchModel, setBatchModel] = useState("small");
  const [batchDevice, setBatchDevice] = useState("cpu");
  const [batchResult, setBatchResult] = useState(null);
  const [memWarning, setMemWarning] = useState(null);
  const intervalRef = useRef(null);
  const prevStatusRef = useRef({});
  const mediaMap = useRef({});

  const applyJobs = useCallback((data) => {
    setJobs(data);

    // Detect job completions and send system notifications
    if ("Notification" in window && Notification.permission === "granted") {
      data.forEach((job) => {
        const prev = prevStatusRef.current[job.id];
        if (prev && prev !== job.status) {
          if (job.status === "done") {
            const name = mediaMap.current?.[job.media_id]?.filename || t('taskQueue.taskFallback', { id: job.id });
            new Notification(t('taskQueue.notification.doneTitle'), {
              body: t('taskQueue.notification.doneBody', { name }),
              icon: "/icons/128x128.png",
            });
          } else if (job.status === "error") {
            const name = mediaMap.current?.[job.media_id]?.filename || t('taskQueue.taskFallback', { id: job.id });
            new Notification(t('taskQueue.notification.errorTitle'), {
              body: t('taskQueue.notification.errorBody', { name }),
            });
          }
        }
        prevStatusRef.current[job.id] = job.status;
      });
    }

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
  }, [t]);

  const loadJobs = useCallback(async (withLoading = true) => {
    try {
      if (withLoading) setLoading(true);
      const response = await api.get("/jobs");
      applyJobs(response.data?.data || []);
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      if (withLoading) setLoading(false);
    }
  }, [applyJobs]);

  const loadMedia = useCallback(async () => {
    try {
      const response = await api.get("/media");
      setMedia(response.data?.data || []);
    } catch (error) {
      console.error("Failed to load media:", error);
    }
  }, []);

  // Request notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Check memory when model selection changes
  useEffect(() => {
    setMemWarning(null);
    api.get(`/models/${batchModel}/preflight`)
      .then((res) => {
        const d = res.data;
        if (d?.enough === false) {
          setMemWarning(t('taskQueue.memWarning', { available: d.available_mb, required: d.required_mb }));
        }
      })
      .catch(() => {});
  }, [batchModel, t]);

  useEffect(() => {
    loadJobs();
    loadMedia();

    // Try SSE for real-time updates, fall back to polling on error
    const baseUrl = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8787";
    const es = new EventSource(`${baseUrl}/events/jobs`);
    let fallback = false;

    es.onmessage = (event) => {
      try {
        applyJobs(JSON.parse(event.data));
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    };

    es.onerror = () => {
      if (!fallback) {
        fallback = true;
        es.close();
        console.warn("SSE failed, falling back to polling");
        intervalRef.current = setInterval(() => loadJobs(false), 3000);
      }
    };

    return () => {
      es.close();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadJobs, loadMedia, applyJobs]);

  const mediaMapState = useMemo(() => {
    const map = {};
    media.forEach((m) => { map[m.id] = m; });
    return map;
  }, [media]);

  // Keep a ref so notification callbacks can access the latest media names
  mediaMap.current = mediaMapState;

  const busyMediaIds = useMemo(() => {
    const ids = new Set();
    jobs.forEach((j) => {
      if (j.status === "queued" || j.status === "running" || j.status === "done") ids.add(j.media_id);
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

  const cancelJob = async (job) => {
    try {
      await api.post(`/jobs/${job.id}/cancel`);
      loadJobs();
    } catch (error) {
      console.error("Cancel failed:", error);
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case "done":      return "badge badge-success";
      case "running":   return "badge badge-warning";
      case "error":     return "badge badge-error";
      case "cancelled": return "badge badge-neutral";
      default:          return "badge badge-info";
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
          <h1 className="text-3xl font-bold text-gray-900">{t('taskQueue.title')}</h1>
          <p className="mt-2 text-gray-600">{t('taskQueue.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadJobs}>
          <RefreshCw className="w-4 h-4" />
          {t('taskQueue.refresh')}
        </button>
      </div>

      {/* Batch create area */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('taskQueue.batch.title')}</h2>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={selectAll}
              disabled={availableMedia.length === 0}
            >
              {t('taskQueue.batch.selectAll')}
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              className="text-gray-500 hover:underline"
              onClick={clearAll}
            >
              {t('taskQueue.batch.clearAll')}
            </button>
          </div>
        </div>

        {availableMedia.length === 0 ? (
          <p className="text-sm text-gray-400">{t('taskQueue.batch.noFiles')}</p>
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
            <label className="text-sm font-medium text-gray-700">{t('taskQueue.batch.modelLabel')}</label>
            <select
              className="form-input"
              value={batchModel}
              onChange={(e) => setBatchModel(e.target.value)}
            >
              {MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {memWarning && (
              <p className="mt-1 text-xs text-yellow-600">{memWarning}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">{t('taskQueue.batch.deviceLabel')}</label>
            <select
              className="form-input"
              value={batchDevice}
              onChange={(e) => setBatchDevice(e.target.value)}
            >
              <option value="cpu">CPU</option>
              <option value="cuda">{t('taskQueue.batch.cudaOption')}</option>
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
              ? t('taskQueue.batch.submitting')
              : selectedIds.size > 0
                ? t('taskQueue.batch.startTranscribe', { count: selectedIds.size })
                : t('taskQueue.batch.selectToStart')
            }
          </button>
          {batchResult && (
            <span className="text-sm text-gray-600">
              {t('taskQueue.batch.resultSuccess', { success: batchResult.success })}
              {batchResult.failed > 0 && t('taskQueue.batch.resultFailed', { failed: batchResult.failed })}
            </span>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('taskQueue.table.file')}</th>
                <th>{t('taskQueue.table.model')}</th>
                <th>{t('taskQueue.table.status')}</th>
                <th>{t('taskQueue.table.progress')}</th>
                <th>{t('taskQueue.table.eta')}</th>
                <th>{t('taskQueue.table.updatedAt')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const progress = Math.min(Math.max(job.progress || 0, 0), 1);
                const percent = Math.round(progress * 100);
                const history = progressHistory[job.id] || [];
                const eta = job.status === "running" ? calcEta(history) : null;
                const filename = mediaMapState[job.media_id]?.filename || t('taskQueue.mediaFallback', { id: job.media_id });
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
                      {eta || (job.status === "done" ? "\u2014" : "")}
                    </td>
                    <td className="text-xs text-gray-400">
                      {formatDateTime(job.updated_at)}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {(job.status === "running" || job.status === "queued") && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs flex items-center gap-1"
                            onClick={() => cancelJob(job)}
                            title={t('taskQueue.actions.cancelTitle')}
                          >
                            <XCircle className="w-3 h-3" />
                            {t('taskQueue.actions.cancel')}
                          </button>
                        )}
                        {(job.status === "error" || job.status === "cancelled") && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs flex items-center gap-1"
                            onClick={() => retryJob(job)}
                            title={job.error || t('taskQueue.actions.retry')}
                          >
                            <RotateCcw className="w-3 h-3" />
                            {t('taskQueue.actions.retry')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {jobs.length === 0 && (
            <div className="empty-state">
              <p className="empty-state-title">{t('taskQueue.empty.title')}</p>
              <p className="empty-state-text">{t('taskQueue.empty.text')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskQueue;
