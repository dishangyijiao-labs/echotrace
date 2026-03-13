import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import AppLayout from "./components/AppLayout";
import ModelSetup from "./components/ModelSetup";
import Dashboard from "./pages/Dashboard";
import Resources from "./pages/Resources";
import TaskQueue from "./pages/TaskQueue";
import Results from "./pages/Results";
import TranscriptDetail from "./pages/TranscriptDetail";
import Services from "./pages/Services";
import Models from "./pages/Models";
import Settings from "./pages/Settings";
import UpdateChecker from "./components/UpdateChecker";

import { invoke } from "@tauri-apps/api/core";

const PHASE_LABELS = {
  starting: '正在初始化...',
  setup_venv: '正在配置 Python 环境...',
  starting_core: '正在启动 Core API...',
  waiting_core: '等待 Core API 就绪...',
  ready: '服务已就绪',
};

function App() {
  const [modelReady, setModelReady] = useState(null); // null = checking, false = need setup, true = ready
  const [serviceStatus, setServiceStatus] = useState('starting'); // starting, ready, error
  const [phaseLabel, setPhaseLabel] = useState(PHASE_LABELS.starting);
  const timerRef = useRef(null);

  useEffect(() => {
    pollStartupStatus();
    return () => clearTimeout(timerRef.current);
  }, []);

  const pollStartupStatus = async () => {
    // Get startup phase from Tauri backend
    let phase = 'starting';
    try {
      phase = await invoke('startup_status');
    } catch {
      // command not available yet — fall through
    }

    // Update display label
    if (phase.startsWith('venv_error:') || phase.startsWith('core_error:')) {
      const errMsg = phase.split(':').slice(1).join(':');
      setPhaseLabel(errMsg);
      setServiceStatus('error');
      setModelReady(false);
      return;
    }

    if (phase === 'core_timeout') {
      setPhaseLabel('Core API 启动超时，请检查日志');
      setServiceStatus('error');
      setModelReady(false);
      return;
    }

    setPhaseLabel(PHASE_LABELS[phase] || PHASE_LABELS.starting);

    // If backend says ready, verify by checking the API
    if (phase === 'ready') {
      try {
        const response = await fetch('http://127.0.0.1:8787/models/base', {
          signal: AbortSignal.timeout(2000),
        });
        const data = await response.json();
        setServiceStatus('ready');
        setModelReady(data.downloaded === true);
        return;
      } catch {
        // Core said ready but API not responding yet — keep polling
      }
    }

    // Keep polling every 1s
    timerRef.current = setTimeout(pollStartupStatus, 1000);
  };

  // Show loading while starting services
  if (modelReady === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          {serviceStatus === 'error' ? (
            <>
              <div className="h-12 w-12 mx-auto mb-4 flex items-center justify-center">
                <svg className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-700 font-medium">服务启动失败</p>
              <p className="text-red-600 text-sm mt-2 max-w-md mx-auto">{phaseLabel}</p>
              <p className="text-gray-500 text-sm mt-4">
                请尝试重新安装应用，或查看日志获取详情。
              </p>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-700 font-medium">{phaseLabel}</p>
              <p className="text-gray-500 text-sm mt-2">Core API 和 Worker 正在后台启动</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Show model setup if needed
  if (!modelReady) {
    return <ModelSetup onComplete={() => setModelReady(true)} />;
  }

  // Show main app
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="resources" element={<Resources />} />
          <Route path="tasks" element={<TaskQueue />} />
          <Route path="results" element={<Results />} />
          <Route path="results/:id" element={<TranscriptDetail />} />

          <Route path="services" element={<Services />} />
          <Route path="models" element={<Models />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <UpdateChecker />
    </HashRouter>
  );
}

export default App;
