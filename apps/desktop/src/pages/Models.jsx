import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save } from "lucide-react";

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
          <h1 className="text-3xl font-bold text-gray-900">模型与密钥</h1>
          <p className="mt-2 text-gray-600">配置 MCP Provider 的模型列表与 API Key。</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={saveConfig} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? "保存中..." : saved ? "已保存" : "保存配置"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.keys(config).map((provider) => {
          const info = config[provider];
          const keyName = ENV_KEYS[provider];
          const keyValue = keyName ? info.env?.[keyName] || "" : "";
          return (
            <div key={provider} className="card space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{provider}</h2>
                <p className="text-xs text-gray-500">
                  {info.type === "sse" ? info.url : info.command}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">模型列表</label>
                <input
                  className="form-input"
                  value={info.models?.join(", ") || ""}
                  onChange={(event) => updateModels(provider, event.target.value)}
                  placeholder="用英文逗号分隔"
                />
              </div>
              {keyName ? (
                <div>
                  <label className="text-sm font-medium text-gray-700">API Key</label>
                  <input
                    className="form-input"
                    type="password"
                    value={keyValue}
                    onChange={(event) => updateApiKey(provider, event.target.value)}
                    placeholder={keyName}
                  />
                </div>
              ) : (
                <p className="text-xs text-gray-500">该 Provider 不需要 API Key。</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Models;
