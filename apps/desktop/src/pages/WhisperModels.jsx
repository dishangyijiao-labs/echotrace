import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, Download, Loader, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../lib/api";

const MODEL_LIST = ["tiny", "base", "small", "medium", "large-v2", "large-v3"];

const STATUS_ICON = {
  done: <CheckCircle className="w-4 h-4 text-green-500" />,
  downloading: <Loader className="w-4 h-4 text-blue-500 animate-spin" />,
  verifying: <Loader className="w-4 h-4 text-blue-400 animate-spin" />,
  queued: <Loader className="w-4 h-4 text-gray-400 animate-spin" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  cancelled: <XCircle className="w-4 h-4 text-gray-400" />,
};

function ProgressBar({ value }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div
        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

function ModelRow({ model, info, onDownload, onCancel, t }) {
  const isDownloaded = info?.downloaded || info?.status === "done";
  const isActive = ["queued", "downloading", "verifying"].includes(info?.status);
  const progress = info?.progress ?? 0;
  const message = info?.message || "";

  return (
    <tr>
      <td className="font-mono">{model}</td>
      <td>{info?.size_mb ? `${info.size_mb} MB` : "-"}</td>
      <td>{info?.params || "-"}</td>
      <td>
        <div className="flex items-center gap-2">
          {STATUS_ICON[info?.status] || (isDownloaded ? STATUS_ICON.done : null)}
          <span className="text-xs text-gray-500 capitalize">
            {isDownloaded ? t('whisperModels.status.downloaded') : (info?.status || t('whisperModels.status.notDownloaded'))}
          </span>
        </div>
        {isActive && (
          <div className="mt-1 space-y-1">
            <ProgressBar value={progress} />
            <p className="text-xs text-gray-400">{message}</p>
          </div>
        )}
        {info?.status === "failed" && info?.error && (
          <p className="text-xs text-red-500 mt-1">{info.error}</p>
        )}
      </td>
      <td>
        <div className="flex items-center gap-2">
          {isDownloaded ? null : isActive ? (
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => onCancel(model)}
            >
              {t('whisperModels.actions.cancel')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary text-xs"
              onClick={() => onDownload(model)}
            >
              <Download className="w-3 h-3" />
              {t('whisperModels.actions.download')}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function WhisperModels() {
  const { t } = useTranslation();
  const [modelInfo, setModelInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const eventSourcesRef = useRef({});

  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/models");
      const infoMap = {};
      for (const m of res.data?.models || []) {
        infoMap[m.name] = {
          ...m,
          status: m.downloaded ? "done" : undefined,
        };
      }
      setModelInfo(infoMap);
    } catch (err) {
      console.error("Failed to load models:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
    return () => {
      // Close all SSE connections on unmount
      for (const es of Object.values(eventSourcesRef.current)) {
        es.close();
      }
    };
  }, [loadModels]);

  const subscribeProgress = useCallback((modelName) => {
    if (eventSourcesRef.current[modelName]) {
      eventSourcesRef.current[modelName].close();
    }
    const baseUrl = api.defaults.baseURL || "http://127.0.0.1:8787";
    const es = new EventSource(`${baseUrl}/models/${modelName}/download/progress`);
    eventSourcesRef.current[modelName] = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setModelInfo((prev) => ({
          ...prev,
          [modelName]: { ...prev[modelName], ...data },
        }));
        if (["done", "failed", "cancelled"].includes(data.status)) {
          es.close();
          delete eventSourcesRef.current[modelName];
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      delete eventSourcesRef.current[modelName];
    };
  }, []);

  const handleDownload = useCallback(
    async (modelName) => {
      try {
        await api.post(`/models/${modelName}/download`);
        setModelInfo((prev) => ({
          ...prev,
          [modelName]: { ...prev[modelName], status: "queued", progress: 0 },
        }));
        subscribeProgress(modelName);
      } catch (err) {
        console.error("Failed to start download:", err);
      }
    },
    [subscribeProgress]
  );

  const handleCancel = useCallback(async (modelName) => {
    try {
      await api.delete(`/models/${modelName}/download`);
    } catch (err) {
      console.error("Failed to cancel:", err);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('whisperModels.title')}</h1>
        <p className="mt-2 text-gray-600">{t('whisperModels.subtitle')}</p>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('whisperModels.table.model')}</th>
                <th>{t('whisperModels.table.size')}</th>
                <th>{t('whisperModels.table.params')}</th>
                <th>{t('whisperModels.table.status')}</th>
                <th>{t('whisperModels.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {MODEL_LIST.map((m) => (
                <ModelRow
                  key={m}
                  model={m}
                  info={modelInfo[m]}
                  onDownload={handleDownload}
                  onCancel={handleCancel}
                  t={t}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-700">
          {t('whisperModels.info')}
        </p>
      </div>
    </div>
  );
}

export default WhisperModels;
