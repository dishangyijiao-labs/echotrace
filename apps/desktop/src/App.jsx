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

  useEffect(() => {
    checkModelStatus();
  }, []);

  const checkModelStatus = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8787/models/base');
      const data = await response.json();
      setModelReady(data.downloaded === true);
    } catch (err) {
      // If API is not available, assume setup needed
      setModelReady(false);
    }
  };

  // Show loading while checking
  if (modelReady === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">检查系统状态...</p>
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
