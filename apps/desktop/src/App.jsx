import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Resources from "./pages/Resources";
import TaskQueue from "./pages/TaskQueue";
import Results from "./pages/Results";
import TranscriptDetail from "./pages/TranscriptDetail";
import Services from "./pages/Services";
import Models from "./pages/Models";
import Settings from "./pages/Settings";

function App() {
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
    </HashRouter>
  );
}

export default App;
