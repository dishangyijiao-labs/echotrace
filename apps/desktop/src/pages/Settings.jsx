import { useEffect, useState } from "react";
import { Sparkles, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../lib/settings";
import api from "../lib/api";

function Settings() {
  const { t } = useTranslation();
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
      setSemanticMsg({ ok: true, text: value ? t('settings.search.semanticEnabled') : t('settings.search.semanticDisabled') });
    } catch (err) {
      setSemanticMsg({ ok: false, text: err.response?.data?.message || t('settings.search.semanticFailed') });
    } finally {
      setSemanticSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="mt-2 text-gray-600">{t('settings.subtitle')}</p>
      </div>

      {/* Playback settings */}
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">{t('settings.playback.title')}</h2>
        <div>
          <label className="text-sm font-medium text-gray-700">{t('settings.playback.speed')}</label>
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
            <p className="text-sm font-medium text-gray-900">{t('settings.playback.autoPlay')}</p>
            <p className="text-xs text-gray-500">{t('settings.playback.autoPlayDesc')}</p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoPlaySegment}
            onChange={(event) => updateSetting("autoPlaySegment", event.target.checked)}
          />
        </div>

        <div className="flex items-center justify-between border rounded-xl p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">{t('settings.playback.loopSegment')}</p>
            <p className="text-xs text-gray-500">{t('settings.playback.loopSegmentDesc')}</p>
          </div>
          <input
            type="checkbox"
            checked={settings.loopSegment}
            onChange={(event) => updateSetting("loopSegment", event.target.checked)}
          />
        </div>
      </div>

      {/* Search settings */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-900">{t('settings.search.title')}</h2>
        </div>

        {semanticLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('settings.search.loading')}
          </div>
        ) : (
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('settings.search.semanticSearch')}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('settings.search.semanticDesc')}
                </p>
                {!ragAvailable && (
                  <p className="text-xs text-yellow-600 mt-1">
                    {t('settings.search.semanticUnavailable')}
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
                ? t('settings.search.statusEnabled')
                : t('settings.search.statusDisabled')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
