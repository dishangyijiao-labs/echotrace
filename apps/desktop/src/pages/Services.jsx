import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, Search, Trash2 } from "lucide-react";

const LOG_TABS = [
  { key: "core", label: "Core" },
  { key: "worker", label: "Worker" }
];

function Services() {
  const [status, setStatus] = useState({
    core_running: false,
    worker_running: false
  });
  const [activeLog, setActiveLog] = useState("core");
  const [logContent, setLogContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const result = await invoke("process_status");
      setStatus(result);
    } catch (error) {
      console.error("Failed to load status:", error);
    }
  }, []);

  const loadLogs = useCallback(
    async (kind = activeLog) => {
      try {
        const content = await invoke("read_logs", { kind, lines: 300 });
        setLogContent(content || "");
      } catch (error) {
        console.error("Failed to load logs:", error);
      }
    },
    [activeLog]
  );

  useEffect(() => {
    const init = async () => {
      await loadStatus();
      await loadLogs();
      setLoading(false);
    };
    init();

    const interval = setInterval(() => {
      loadStatus();
      loadLogs();
    }, 4000);

    return () => clearInterval(interval);
  }, [loadStatus, loadLogs]);

  const toggleService = async (service) => {
    try {
      const action = status[`${service}_running`] ? `stop_${service}` : `start_${service}`;
      await invoke(action);
      await loadStatus();
    } catch (error) {
      console.error("Failed to toggle service:", error);
    }
  };

  const clearLog = async () => {
    try {
      await invoke("clear_logs", { kind: activeLog });
      await loadLogs(activeLog);
    } catch (error) {
      console.error("Failed to clear log:", error);
    }
  };

  const filteredLogs = useMemo(() => {
    const lines = (logContent || "").split("\n");
    return lines.filter((line) => {
      if (levelFilter !== "all") {
        const token = levelFilter.toUpperCase();
        if (!line.includes(token)) return false;
      }
      if (searchTerm.trim()) {
        return line.toLowerCase().includes(searchTerm.trim().toLowerCase());
      }
      return true;
    });
  }, [logContent, levelFilter, searchTerm]);

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
          <h1 className="text-3xl font-bold text-gray-900">服务与日志</h1>
          <p className="mt-2 text-gray-600">管理本地 Core 与 Worker，并查看运行日志。</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => {
          loadStatus();
          loadLogs();
        }}>
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Core 服务</p>
            <p className="text-lg font-semibold text-gray-900">
              {status.core_running ? "运行中" : "已停止"}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => toggleService("core")}
          >
            {status.core_running ? "停止" : "启动"}
          </button>
        </div>
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Worker</p>
            <p className="text-lg font-semibold text-gray-900">
              {status.worker_running ? "运行中" : "已停止"}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => toggleService("worker")}
          >
            {status.worker_running ? "停止" : "启动"}
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="tabs">
            {LOG_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`tab ${activeLog === tab.key ? "active" : ""}`}
                onClick={() => {
                  setActiveLog(tab.key);
                  loadLogs(tab.key);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-secondary" onClick={clearLog}>
            <Trash2 className="w-4 h-4" />
            清空日志
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr,160px] gap-3">
          <div className="form-search">
            <Search className="form-search-icon" />
            <input
              className="form-search-input"
              placeholder="过滤日志内容"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <select
            className="form-input"
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
          >
            <option value="all">全部级别</option>
            <option value="info">INFO</option>
            <option value="warning">WARNING</option>
            <option value="error">ERROR</option>
            <option value="debug">DEBUG</option>
          </select>
        </div>
        <div className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs leading-relaxed h-80 overflow-y-auto font-mono">
          {filteredLogs.length ? filteredLogs.join("\n") : "暂无日志。"}
        </div>
      </div>
    </div>
  );
}

export default Services;
