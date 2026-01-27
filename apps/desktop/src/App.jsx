import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useState, useEffect } from "react";
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
import AISearch from "./pages/AISearch";

function App() {
  const [modelReady, setModelReady] = useState(null); // null = checking, false = need setup, true = ready
  const [serviceStatus, setServiceStatus] = useState('starting'); // starting, ready, error

  useEffect(() => {
    waitForServicesAndCheckModel();
  }, []);

  const waitForServicesAndCheckModel = async () => {
    // Wait for Core API to be ready (with retries)
    const maxRetries = 15; // 15 seconds timeout
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const response = await fetch('http://127.0.0.1:8787/models/base', {
          signal: AbortSignal.timeout(1000)
        });
        const data = await response.json();
        
        // Service is ready, check model status
        setServiceStatus('ready');
        setModelReady(data.downloaded === true);
        return;
      } catch (err) {
        // Service not ready yet, wait and retry
        retries++;
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // If we get here, service failed to start
    setServiceStatus('error');
    setModelReady(false);
  };

  // Show loading while starting services
  if (modelReady === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          {serviceStatus === 'starting' && (
            <>
              <p className="text-gray-700 font-medium">正在启动服务...</p>
              <p className="text-gray-500 text-sm mt-2">Core API 和 Worker 正在后台启动</p>
            </>
          )}
          {serviceStatus === 'error' && (
            <>
              <p className="text-red-700 font-medium">服务启动失败</p>
              <p className="text-red-600 text-sm mt-2">请检查 Python 环境是否已配置</p>
              <p className="text-gray-500 text-sm mt-4">
                需要确保已安装 Python 依赖：<br />
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  cd apps/core && pip install -r requirements.txt
                </code>
              </p>
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
          <Route path="ai-search" element={<AISearch />} />
          <Route path="services" element={<Services />} />
          <Route path="models" element={<Models />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
