import { useEffect, useState } from "react";
import { Sparkles, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../lib/settings";
import api from "../lib/api";

function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [ragAvailable, setRagAvailable] = useState(false);
  const [semanticEnabled, setSemanticEnabled] = useState(false);
  const [semanticLoading, setSemanticLoading] = useState(true);
  const [semanticSaving, setSemanticSaving] = useState(false);
  const [semanticMsg, setSemanticMsg] = useState(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    Promise.all([api.get("/rag/status"), api.get("/settings")])
      .then(([ragRes, settingsRes]) => {
        setRagAvailable(ragRes.data?.available ?? false);
        setSemanticEnabled(settingsRes.data?.data?.semantic_search_enabled ?? false);
      })
      .catch(() => {})
      .finally(() => setSemanticLoading(false));
  }, []);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSemantic = async (value) => {
    setSemanticSaving(true);
    setSemanticMsg(null);
    try {
      const res = await api.patch("/settings", { semantic_search_enabled: value });
      setSemanticEnabled(res.data?.data?.semantic_search_enabled ?? value);
      setSemanticMsg({ ok: true, text: value ? "语义搜索已启用" : "已切换为全文搜索" });
    } catch (err) {
      setSemanticMsg({ ok: false, text: err.response?.data?.message || "设置失败，请重试" });
    } finally {
      setSemanticSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">设置</h1>
        <p className="mt-2 text-gray-600">控制播放、搜索等功能行为。</p>
      </div>

      {/* 播放设置 */}
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">播放设置</h2>
        <div>
          <label className="text-sm font-medium text-gray-700">播放速度</label>
          <div className="mt-2 flex items-center gap-4">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.playbackRate}
              onChange={(event) =>
                updateSetting("playbackRate", Number(event.target.value))
              }
              className="w-64"
            />
            <span className="text-sm text-gray-600">
              {settings.playbackRate.toFixed(1)}x
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border rounded-xl p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">点击分段自动播放</p>
            <p className="text-xs text-gray-500">跳转到时间轴后立即播放</p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoPlaySegment}
            onChange={(event) => updateSetting("autoPlaySegment", event.target.checked)}
          />
        </div>

        <div className="flex items-center justify-between border rounded-xl p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">循环当前分段</p>
            <p className="text-xs text-gray-500">播放到分段结尾后自动回放</p>
          </div>
          <input
            type="checkbox"
            checked={settings.loopSegment}
            onChange={(event) => updateSetting("loopSegment", event.target.checked)}
          />
        </div>
      </div>

      {/* 搜索设置 */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-900">搜索设置</h2>
        </div>

        {semanticLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中…
          </div>
        ) : (
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">语义搜索</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  理解近义词与相关概念，搜索更智能。需要本地嵌入模型（首次使用会自动下载）。
                </p>
                {!ragAvailable && (
                  <p className="text-xs text-yellow-600 mt-1">
                    当前环境未安装语义搜索依赖，请联系开发者或查看文档。
                  </p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={semanticEnabled}
                disabled={!ragAvailable || semanticSaving}
                onClick={() => toggleSemantic(!semanticEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                  semanticEnabled ? "bg-purple-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                    semanticEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {semanticMsg && (
              <div className={`flex items-center gap-2 text-xs ${semanticMsg.ok ? "text-green-600" : "text-red-500"}`}>
                {semanticMsg.ok
                  ? <CheckCircle className="w-3.5 h-3.5" />
                  : <AlertCircle className="w-3.5 h-3.5" />
                }
                {semanticMsg.text}
              </div>
            )}

            <p className="text-xs text-gray-400">
              {semanticEnabled
                ? "当前：语义搜索已启用，可在「智能搜索」页面使用混合检索。"
                : "当前：全文搜索模式（精确匹配关键词）。"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
