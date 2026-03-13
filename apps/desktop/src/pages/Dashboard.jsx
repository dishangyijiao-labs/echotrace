import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FileText, Folder, Shield, HardDrive,
  Upload, Search, CheckCircle, Loader2, AlertCircle,
  ArrowRight, Download, Play
} from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";

const MEDIA_EXTENSIONS = new Set(["mp3", "wav", "m4a", "mp4", "mov", "mkv", "avi", "webm", "flac", "ogg"]);

function isMediaFile(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  return MEDIA_EXTENSIONS.has(ext);
}

function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ mediaCount: 0, transcriptCount: 0, activeJobs: 0, doneJobs: 0 });
  const [activeJobs, setActiveJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickSearch, setQuickSearch] = useState("");
  const [services, setServices] = useState({ core_running: false, worker_running: false });
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [modelReady, setModelReady] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => localStorage.getItem("echotrace_onboarding_done") === "1"
  );
  const unlistenRef = useRef(null);

  const loadData = useCallback(async (withLoading = true) => {
    try {
      if (withLoading) setLoading(true);
      const [mediaRes, jobRes, transcriptRes, status, modelsRes] = await Promise.all([
        api.get("/media"),
        api.get("/jobs"),
        api.get("/transcripts"),
        invoke("process_status"),
        api.get("/models").catch(() => ({ data: { models: [] } })),
      ]);
      const models = modelsRes.data?.models || [];
      setModelReady(models.some((m) => m.downloaded));
      const jobs = jobRes.data?.data || [];
      const running = jobs.filter((j) => j.status === "running" || j.status === "queued");
      const done = jobs.filter((j) => j.status === "done");
      setStats({
        mediaCount: mediaRes.data?.data?.length || 0,
        transcriptCount: transcriptRes.data?.data?.length || 0,
        activeJobs: running.length,
        doneJobs: done.length,
      });
      setActiveJobs(running.slice(0, 3));
      setServices(status);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      if (withLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(false), 5000);

    // Tauri native file drag-drop
    const setupDragDrop = async () => {
      try {
        const win = getCurrentWebviewWindow();
        unlistenRef.current = await win.onDragDropEvent((event) => {
          if (event.payload.type === "over") {
            setDragOver(true);
          } else if (event.payload.type === "leave" || event.payload.type === "cancel") {
            setDragOver(false);
          } else if (event.payload.type === "drop") {
            setDragOver(false);
            const paths = (event.payload.paths || []).filter(isMediaFile);
            if (paths.length > 0) importPaths(paths);
          }
        });
      } catch (e) {
        console.warn("DragDrop setup failed:", e);
      }
    };
    setupDragDrop();

    return () => {
      clearInterval(interval);
      unlistenRef.current?.();
    };
  }, [loadData]);

  const importPaths = async (paths) => {
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await api.post("/media/import", { paths });
      const created = res.data?.created?.length || 0;
      setImportMsg({ type: "success", text: t('dashboard.import.successMessage', { count: created }) });
      loadData(false);
    } catch {
      setImportMsg({ type: "error", text: t('dashboard.import.errorMessage') });
    } finally {
      setImporting(false);
    }
  };

  const handleClickImport = async () => {
    const selection = await open({
      multiple: true,
      filters: [{ name: "Media", extensions: [...MEDIA_EXTENSIONS] }],
    });
    if (!selection) return;
    const paths = Array.isArray(selection) ? selection : [selection];
    if (paths.length > 0) importPaths(paths);
  };

  const controlService = async (action) => {
    try {
      await invoke(action);
      const status = await invoke("process_status");
      setServices(status);
    } catch (error) {
      console.error("Failed to control service:", error);
    }
  };

  const queueSummary = useMemo(() => {
    if (stats.activeJobs === 0) return null;
    return t('dashboard.queue.summary', { count: stats.activeJobs });
  }, [stats.activeJobs, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero search */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">{t('dashboard.hero.title')}</h1>
        <p className="text-blue-100 mb-5 text-base">{t('dashboard.hero.subtitle')}</p>
        <div className="bg-white rounded-xl p-2 flex items-center gap-2 shadow-lg">
          <Search className="w-5 h-5 text-gray-400 ml-2 shrink-0" />
          <input
            type="text"
            placeholder={t('dashboard.hero.searchPlaceholder')}
            className="flex-1 px-3 py-2.5 text-gray-900 bg-transparent focus:outline-none text-base"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && quickSearch.trim())
                navigate(`/results?q=${encodeURIComponent(quickSearch.trim())}`);
            }}
          />
          <button
            className="btn btn-primary px-5 py-2.5"
            type="button"
            onClick={() => {
              if (quickSearch.trim())
                navigate(`/results?q=${encodeURIComponent(quickSearch.trim())}`);
            }}
          >
            {t('dashboard.hero.searchButton')}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-colors" onClick={() => navigate("/resources")}>
            <div className="text-2xl font-bold">{stats.mediaCount}</div>
            <div className="text-xs text-blue-100 mt-0.5">{t('dashboard.stats.mediaCount')}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-colors" onClick={() => navigate("/results")}>
            <div className="text-2xl font-bold">{stats.transcriptCount}</div>
            <div className="text-xs text-blue-100 mt-0.5">{t('dashboard.stats.searchableContent')}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-colors" onClick={() => navigate("/tasks")}>
            <div className="text-2xl font-bold">
              {stats.activeJobs > 0 ? stats.activeJobs : <CheckCircle className="w-6 h-6 mx-auto" />}
            </div>
            <div className="text-xs text-blue-100 mt-0.5">
              {stats.activeJobs > 0 ? t('dashboard.stats.transcribing') : t('dashboard.stats.queueIdle')}
            </div>
          </div>
        </div>
      </div>

      {/* Active queue status */}
      {queueSummary && (
        <div className="card border-blue-200 bg-blue-50 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm font-medium text-blue-800">{queueSummary}</span>
            <button
              type="button"
              className="ml-auto text-xs text-blue-600 hover:underline"
              onClick={() => navigate("/tasks")}
            >
              {t('dashboard.queue.viewDetails')}
            </button>
          </div>
          {activeJobs.map((job) => {
            const pct = Math.round((job.progress || 0) * 100);
            return (
              <div key={job.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-blue-700">
                  <span>{t('dashboard.queue.taskLabel', { id: job.id, model: job.model })}</span>
                  <span>{job.status === "queued" ? t('dashboard.queue.queued') : `${pct}%`}</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Onboarding guide — shown until all 3 steps done or dismissed */}
      {!onboardingDismissed && !(modelReady && stats.mediaCount > 0 && stats.transcriptCount > 0) && (
        <OnboardingGuide
          modelReady={modelReady}
          hasMedia={stats.mediaCount > 0}
          hasTranscript={stats.transcriptCount > 0}
          onDismiss={() => {
            localStorage.setItem("echotrace_onboarding_done", "1");
            setOnboardingDismissed(true);
          }}
          onImport={handleClickImport}
          onNavigate={navigate}
        />
      )}

      {/* Drag-drop import zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50"
        }`}
        onClick={handleClickImport}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          // Fallback for non-Tauri drops (dev mode browser)
          const files = Array.from(e.dataTransfer.files);
          const paths = files.map((f) => f.path).filter(Boolean).filter(isMediaFile);
          if (paths.length > 0) importPaths(paths);
        }}
      >
        {importing ? (
          <div className="flex flex-col items-center gap-2 text-blue-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">{t('dashboard.import.importing')}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Upload className={`w-8 h-8 ${dragOver ? "text-blue-400" : ""}`} />
            <p className="text-sm font-medium text-gray-600">
              {dragOver ? t('dashboard.import.dropHere') : t('dashboard.import.dragOrClick')}
            </p>
            <p className="text-xs text-gray-400">{t('dashboard.import.supportedFormats')}</p>
          </div>
        )}
      </div>

      {importMsg && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${
          importMsg.type === "success"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {importMsg.type === "success"
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />
          }
          <span>{importMsg.text}</span>
          {importMsg.type === "success" && (
            <button
              type="button"
              className="ml-auto text-xs font-medium underline"
              onClick={() => navigate("/tasks")}
            >
              {t('dashboard.import.goToQueue')}
            </button>
          )}
        </div>
      )}

      {/* Stats + Service */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card border-blue-200 bg-blue-50/50 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/resources")}>
          <Folder className="w-8 h-8 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">{t('dashboard.statsCards.resourceFiles')}</p>
            <p className="text-2xl font-semibold text-gray-900">{stats.mediaCount}</p>
          </div>
        </div>
        <div className="card border-emerald-200 bg-emerald-50/50 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/results")}>
          <FileText className="w-8 h-8 text-emerald-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">{t('dashboard.statsCards.transcriptionResults')}</p>
            <p className="text-2xl font-semibold text-gray-900">{stats.transcriptCount}</p>
          </div>
        </div>
        <div className="card border-gray-200 bg-gray-50/50 flex items-center gap-4">
          <Shield className="w-6 h-6 text-gray-400 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">{t('dashboard.statsCards.privacyProtection')}</p>
            <p className="text-sm font-medium text-gray-700">{t('dashboard.statsCards.localProcessing')}</p>
          </div>
          <HardDrive className="w-5 h-5 text-gray-300 ml-auto shrink-0" />
        </div>
      </div>

      {/* Services */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('dashboard.services.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { key: "core", label: "Core API", running: services.core_running, start: "start_core", stop: "stop_core" },
            { key: "worker", label: "Worker", running: services.worker_running, start: "start_worker", stop: "stop_worker" },
          ].map((svc) => (
            <div key={svc.key} className="flex items-center justify-between border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${svc.running ? "bg-green-400" : "bg-gray-300"}`} />
                <span className="text-sm text-gray-700">{svc.label}</span>
                <span className="text-xs text-gray-400">{svc.running ? t('dashboard.services.running') : t('dashboard.services.stopped')}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary text-xs py-1 px-3"
                onClick={() => controlService(svc.running ? svc.stop : svc.start)}
              >
                {svc.running ? t('dashboard.services.stop') : t('dashboard.services.start')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OnboardingGuide({ modelReady, hasMedia, hasTranscript, onDismiss, onImport, onNavigate }) {
  const { t } = useTranslation();
  const steps = [
    {
      num: 1,
      label: t('dashboard.onboarding.step1.label'),
      desc: t('dashboard.onboarding.step1.desc'),
      done: modelReady,
      action: { label: t('dashboard.onboarding.step1.action'), icon: Download, fn: () => onNavigate("/models") },
    },
    {
      num: 2,
      label: t('dashboard.onboarding.step2.label'),
      desc: t('dashboard.onboarding.step2.desc'),
      done: hasMedia,
      action: { label: t('dashboard.onboarding.step2.action'), icon: Upload, fn: onImport },
    },
    {
      num: 3,
      label: t('dashboard.onboarding.step3.label'),
      desc: t('dashboard.onboarding.step3.desc'),
      done: hasTranscript,
      action: { label: t('dashboard.onboarding.step3.action'), icon: Play, fn: () => onNavigate("/tasks") },
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const currentStep = steps.find((s) => !s.done);

  return (
    <div className="card border-indigo-100 bg-gradient-to-br from-indigo-50 to-white space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t('dashboard.onboarding.title')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.onboarding.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-indigo-600 font-medium">{t('dashboard.onboarding.progress', { done: doneCount })}</span>
          <button
            type="button"
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={onDismiss}
          >
            {t('dashboard.onboarding.dismiss')}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-indigo-100 rounded-full h-1.5">
        <div
          className="bg-indigo-500 h-1.5 rounded-full transition-all"
          style={{ width: `${(doneCount / 3) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {steps.map((step) => {
          const Icon = step.action.icon;
          const isActive = currentStep?.num === step.num;
          return (
            <div
              key={step.num}
              className={`rounded-xl border p-4 space-y-2 transition-colors ${
                step.done
                  ? "border-green-200 bg-green-50"
                  : isActive
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-gray-100 bg-gray-50 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                {step.done ? (
                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                ) : (
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                    isActive ? "border-indigo-500 text-indigo-500" : "border-gray-300 text-gray-400"
                  }`}>
                    {step.num}
                  </span>
                )}
                <span className={`text-sm font-medium ${step.done ? "text-green-700 line-through" : "text-gray-800"}`}>
                  {step.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              {!step.done && isActive && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 mt-1"
                  onClick={step.action.fn}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {step.action.label}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Dashboard;
