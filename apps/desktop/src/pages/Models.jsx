import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save, AlertTriangle, Shield, Cloud } from "lucide-react";
import { useTranslation } from "react-i18next";

const ENV_KEYS = {
  openai: "OPENAI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  doubao: "DOUBAO_API_KEY"
};

const DEFAULT_CONFIG = {
  openai: {
    type: "stdio",
    command: "mcp-openai",
    args: [],
    tool: "summarize",
    models: ["gpt-4o-mini", "gpt-4o", "o3-mini"],
    env: {}
  },
  claude: {
    type: "stdio",
    command: "mcp-claude",
    args: [],
    tool: "summarize",
    models: ["claude-3-5-sonnet", "claude-3-5-haiku"],
    env: {}
  },
  deepseek: {
    type: "stdio",
    command: "mcp-deepseek",
    args: [],
    tool: "summarize",
    models: ["deepseek-chat", "deepseek-reasoner"],
    env: {}
  },
  doubao: {
    type: "stdio",
    command: "mcp-doubao",
    args: [],
    tool: "summarize",
    models: ["doubao-pro-128k", "doubao-lite-32k"],
    env: {}
  },
  local: {
    type: "sse",
    url: "http://127.0.0.1:8080/sse",
    tool: "summarize",
    models: ["qwen2.5:7b", "llama3.1:8b"],
    env: {}
  }
};

function Models() {
  const { t } = useTranslation();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await invoke("load_mcp_config");
        setConfig({ ...DEFAULT_CONFIG, ...result });
      } catch (error) {
        console.error("Failed to load MCP config:", error);
      }
    };
    load();
  }, []);

  const updateModels = (provider, value) => {
    const models = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    setConfig((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        models
      }
    }));
  };

  const updateApiKey = (provider, value) => {
    const key = ENV_KEYS[provider];
    setConfig((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        env: key ? { ...prev[provider].env, [key]: value } : prev[provider].env
      }
    }));
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      await invoke("save_mcp_config", { config });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (error) {
      console.error("Failed to save MCP config:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('models.title')}</h1>
          <p className="mt-2 text-gray-600">{t('models.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={saveConfig} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? t('models.saving') : saved ? t('models.saved') : t('models.save')}
        </button>
      </div>

      {/* Privacy Warning Banner */}
      <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 mb-2">{t('models.privacy.warningTitle')}</h3>
            <div className="space-y-2 text-sm text-yellow-800">
              <div className="flex items-start gap-2">
                <Cloud className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>{t('models.privacy.cloudLabel')}</strong>：
                  {t('models.privacy.cloudWarning')}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>{t('models.privacy.localLabel')}</strong>：
                  {t('models.privacy.localWarning')}
                </p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-yellow-100 rounded-lg">
              <p className="text-xs text-yellow-900 font-medium">
                <strong>{t('models.privacy.importantNote')}</strong>
              </p>
              <p className="text-xs text-yellow-800 mt-1">
                {t('models.privacy.detailNote')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.keys(config).map((provider) => {
          const info = config[provider];
          const keyName = ENV_KEYS[provider];
          const keyValue = keyName ? info.env?.[keyName] || "" : "";
          const isLocal = provider === "local";
          return (
            <div
              key={provider}
              className={`card space-y-4 ${isLocal ? 'border-2 border-green-300 bg-green-50' : 'border-2 border-orange-200 bg-orange-50'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">{provider}</h2>
                    {isLocal ? (
                      <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-medium rounded-full">
                        {t('models.local')}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-orange-600 text-white text-xs font-medium rounded-full">
                        {t('models.cloud')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {info.type === "sse" ? info.url : info.command}
                  </p>
                </div>
                {!isLocal && <Cloud className="w-5 h-5 text-orange-500" />}
                {isLocal && <Shield className="w-5 h-5 text-green-600" />}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('models.modelList')}</label>
                <input
                  className="form-input"
                  value={info.models?.join(", ") || ""}
                  onChange={(event) => updateModels(provider, event.target.value)}
                  placeholder={t('models.modelPlaceholder')}
                />
              </div>
              {keyName ? (
                <div>
                  <label className="text-sm font-medium text-gray-700">{t('models.apiKey')}</label>
                  <input
                    className="form-input"
                    type="password"
                    value={keyValue}
                    onChange={(event) => updateApiKey(provider, event.target.value)}
                    placeholder={keyName}
                  />
                </div>
              ) : (
                <p className="text-xs text-gray-500">{t('models.noApiKeyNeeded')}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Models;
