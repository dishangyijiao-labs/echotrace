import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Folder, ListTodo, Shield, HardDrive } from "lucide-react";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    mediaCount: 0,
    transcriptCount: 0,
    jobCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [quickSearch, setQuickSearch] = useState("");
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
      {/* Hero Search Section */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-8 text-white">
        <h1 className="text-4xl font-bold mb-3">找到任何时刻</h1>
        <p className="text-blue-100 mb-6 text-lg">
          搜索你的所有视频素材，10秒定位到精确时间点
        </p>
        
        {/* Quick Search */}
        <div className="bg-white rounded-xl p-2 flex items-center gap-2 shadow-lg">
          <input
            type="text"
            placeholder='搜索关键词，例如："人工智能"、"产品发布"、"张三访谈"...'
            className="flex-1 px-4 py-3 text-gray-900 bg-transparent focus:outline-none text-lg"
            value={quickSearch}
            onChange={(event) => setQuickSearch(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && quickSearch.trim()) {
                navigate(`/results?q=${encodeURIComponent(quickSearch.trim())}`);
              }
            }}
          />
          <button
            className="btn btn-primary px-6 py-3 text-lg"
            type="button"
            onClick={() => {
              if (!quickSearch.trim()) return;
              navigate(`/results?q=${encodeURIComponent(quickSearch.trim())}`);
            }}
          >
            搜索
          </button>
        </div>
        
        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <div className="text-2xl font-bold">{stats.mediaCount}</div>
            <div className="text-sm text-blue-100">视频素材</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <div className="text-2xl font-bold">{stats.transcriptCount}</div>
            <div className="text-sm text-blue-100">可搜索内容</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <div className="text-2xl font-bold">{stats.jobCount === 0 ? '✓' : stats.jobCount}</div>
            <div className="text-sm text-blue-100">{stats.jobCount === 0 ? '全部完成' : '处理中'}</div>
          </div>
        </div>
      </div>

      {/* Use Case Examples */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <h3 className="font-semibold text-gray-900 mb-2">🎬 短视频剪辑</h3>
          <p className="text-sm text-gray-600">
            从50个长视频中快速找到"AI"相关片段，节省2小时查找时间
          </p>
        </div>
        <div className="card bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-2">🎙️ 播客制作</h3>
          <p className="text-sm text-gray-600">
            自动生成章节时间戳和Show Notes，一键导出
          </p>
        </div>
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <h3 className="font-semibold text-gray-900 mb-2">📚 课程复用</h3>
          <p className="text-sm text-gray-600">
            搜索"Python"找到所有相关章节，重组为新课程
          </p>
        </div>
      </div>

      {/* Privacy Guarantee Banner - Simplified */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">100% 本地处理</p>
              <p className="text-xs text-gray-600">所有转录和搜索在本机完成，文件不上传云端</p>
            </div>
          </div>
          <HardDrive className="w-8 h-8 text-gray-400" />
        </div>
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
