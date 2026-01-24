import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save, AlertTriangle, Shield, Cloud } from "lucide-react";

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

      {/* Privacy Warning Banner */}
      <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 mb-2">⚠️ 隐私风险警告</h3>
            <div className="space-y-2 text-sm text-yellow-800">
              <div className="flex items-start gap-2">
                <Cloud className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>云端服务（OpenAI/Claude/DeepSeek/Doubao）</strong>：
                  使用这些服务进行 AI 分析时，您的转录文本会被上传到第三方服务器。
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>本地服务（Local）</strong>：
                  需要自行部署 Ollama 等本地 LLM 服务，数据不离开设备，但性能和质量有限。
                </p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-yellow-100 rounded-lg">
              <p className="text-xs text-yellow-900 font-medium">
                🚨 <strong>仅在处理非敏感内容时使用云端服务</strong>
              </p>
              <p className="text-xs text-yellow-800 mt-1">
                律师、医生、企业机密内容应避免使用云端 AI 分析，或仅使用本地 LLM。
                转录功能始终在本地进行，不受此影响。
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
                        本地
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-orange-600 text-white text-xs font-medium rounded-full">
                        云端
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
