import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Folder, ListTodo } from "lucide-react";
import api from "../lib/api";

function Dashboard() {
  const [stats, setStats] = useState({
    mediaCount: 0,
    transcriptCount: 0,
    jobCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState({
    core_running: false,
    worker_running: false
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [mediaRes, jobRes, transcriptRes] = await Promise.all([
          api.get("/media"),
          api.get("/jobs"),
          api.get("/transcripts")
        ]);
        setStats({
          mediaCount: mediaRes.data?.data?.length || 0,
          jobCount: jobRes.data?.data?.length || 0,
          transcriptCount: transcriptRes.data?.data?.length || 0
        });
        const status = await invoke("process_status");
        setServices(status);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const controlService = async (action) => {
    try {
      await invoke(action);
      const status = await invoke("process_status");
      setServices(status);
    } catch (error) {
      console.error("Failed to control service:", error);
    }
  };

  const cards = useMemo(
    () => [
      {
        title: "资源文件",
        value: stats.mediaCount,
        icon: Folder,
        accent: "text-blue-600 bg-blue-50 border-blue-200"
      },
      {
        title: "任务队列",
        value: stats.jobCount,
        icon: ListTodo,
        accent: "text-amber-600 bg-amber-50 border-amber-200"
      },
      {
        title: "转录结果",
        value: stats.transcriptCount,
        icon: FileText,
        accent: "text-emerald-600 bg-emerald-50 border-emerald-200"
      }
    ],
    [stats]
  );

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
        <h1 className="text-3xl font-bold text-gray-900">工作台</h1>
        <p className="mt-2 text-gray-600">
          管理本地音视频转写流程，所有数据保存在本机。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={`card border ${card.accent}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="text-3xl font-semibold text-gray-900">
                    {card.value}
                  </p>
                </div>
                <Icon className="w-8 h-8" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">下一步</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-600">
          <li>1. 导入音视频文件到资源管理。</li>
          <li>2. 创建转写任务并查看处理状态。</li>
          <li>3. 在转录结果中搜索、编辑或导出。</li>
        </ul>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">本地服务</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between border rounded-xl p-4">
            <div>
              <p className="text-sm text-gray-500">Core API</p>
              <p className="text-base font-medium text-gray-900">
                {services.core_running ? "运行中" : "已停止"}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                controlService(services.core_running ? "stop_core" : "start_core")
              }
            >
              {services.core_running ? "停止" : "启动"}
            </button>
          </div>
          <div className="flex items-center justify-between border rounded-xl p-4">
            <div>
              <p className="text-sm text-gray-500">Worker</p>
              <p className="text-base font-medium text-gray-900">
                {services.worker_running ? "运行中" : "已停止"}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                controlService(services.worker_running ? "stop_worker" : "start_worker")
              }
            >
              {services.worker_running ? "停止" : "启动"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
