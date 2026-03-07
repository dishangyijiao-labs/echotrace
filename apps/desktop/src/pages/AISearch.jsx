import { useEffect, useState } from "react";
import { Bot, Sparkles, Search, Scissors, Database, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import api from "../lib/api";

function AISearch() {
  const [ragStatus, setRagStatus] = useState({
    enabled: false,
    features: {}
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // 搜索状态
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("keyword"); // 默认关键词搜索
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // Agent 查询
  const [agentQuery, setAgentQuery] = useState("");
  const [agentType, setAgentType] = useState("search");
  const [agentResponse, setAgentResponse] = useState("");
  const [agentRunning, setAgentRunning] = useState(false);

  useEffect(() => {
    checkRagStatus();
  }, []);

  const checkRagStatus = async () => {
    try {
      const response = await api.get("/rag/status");
      const data = response.data || {};
      setRagStatus({
        enabled: data.enabled || false,
        features: data.features || {}
      });
      // 如果 RAG 启用，默认使用混合检索
      if (data.enabled) {
        setSearchMode("hybrid");
      }
    } catch (error) {
      console.error("Failed to check RAG status:", error);
      setRagStatus({ enabled: false, features: {} });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const response = await api.post("/rag/sync-all", null, {
        params: { embedding_provider: "local" }
      });
      alert(
        `同步完成！\n` +
        `处理转录: ${response.data.transcripts} 个\n` +
        `索引分段: ${response.data.segments} 个`
      );
    } catch (error) {
      console.error("Sync failed:", error);
      alert("同步失败：" + (error.response?.data?.detail || error.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      let response;
      
      if (searchMode === "keyword" || !ragStatus.enabled) {
        // 全文搜索（不需要 RAG）
        response = await api.get("/search", {
          params: { q: searchQuery, limit: 20, offset: 0 }
        });
        // 转换数据格式
        const data = response.data?.data || [];
        setSearchResults(data.map(item => ({
          ...item,
          source: "全文搜索",
          score: 1.0
        })));
      } else {
        // 语义/混合搜索（需要 RAG）
        response = await api.post("/search/semantic", {
        query: searchQuery,
        mode: searchMode,
        limit: 20,
      });
      setSearchResults(response.data?.data || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
      alert("搜索失败：" + (error.response?.data?.detail || error.message));
    } finally {
      setSearching(false);
    }
  };

  const handleAgentQuery = async (e) => {
    e.preventDefault();
    if (!agentQuery.trim()) return;

    setAgentRunning(true);
    setAgentResponse("");
    try {
      const response = await api.post("/agent/query", {
        query: agentQuery,
        agent_type: agentType,
      });
      setAgentResponse(response.data?.response || "无响应");
    } catch (error) {
      console.error("Agent query failed:", error);
      setAgentResponse("查询失败：" + (error.response?.data?.detail || error.message));
    } finally {
      setAgentRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold">智能搜索</h1>
        </div>
        
        {/* RAG 状态指示器 */}
        <div className="flex items-center gap-4">
          {ragStatus.enabled ? (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              语义搜索已启用
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              仅全文搜索
            </div>
          )}
          
          {ragStatus.enabled && (
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {syncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              同步中...
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              同步向量库
            </>
          )}
        </button>
          )}
        </div>
      </div>

      {/* 搜索功能说明 */}
      {!ragStatus.enabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-800">当前使用全文搜索模式</h3>
              <p className="text-sm text-blue-700 mt-1">
                全文搜索可精确匹配关键词，适合大多数场景。
                如需启用语义搜索（理解近义词、相似概念），请前往{" "}
                <strong>设置 → 搜索设置</strong> 开启「语义搜索」开关。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 搜索 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold">
            {ragStatus.enabled ? "智能搜索" : "全文搜索"}
          </h2>
        </div>
        
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ragStatus.enabled 
                ? "输入搜索内容（支持语义理解）..." 
                : "输入关键词搜索..."
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* 搜索模式选择 - 只有 RAG 启用时才显示语义选项 */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="keyword"
                checked={searchMode === "keyword"}
                onChange={(e) => setSearchMode(e.target.value)}
              />
              <span>关键词搜索</span>
            </label>
            
            {ragStatus.enabled && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="hybrid"
                    checked={searchMode === "hybrid"}
                    onChange={(e) => setSearchMode(e.target.value)}
                  />
              <span>混合检索（推荐）</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="semantic"
                checked={searchMode === "semantic"}
                onChange={(e) => setSearchMode(e.target.value)}
              />
              <span>语义检索</span>
            </label>
              </>
            )}
          </div>
          
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {searching ? "搜索中..." : "搜索"}
          </button>
        </form>

        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-semibold text-gray-700">搜索结果 ({searchResults.length})</h3>
            {searchResults.map((result, idx) => (
              <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{result.filename}</div>
                    <div className="text-sm text-gray-500">
                      {result.start?.toFixed(1)}s - {result.end?.toFixed(1)}s
                      <span className="ml-3 text-xs px-2 py-1 rounded bg-gray-200">
                        {result.source}
                      </span>
                      {result.score < 1 && (
                      <span className="ml-2 text-xs text-gray-400">
                          相似度: {result.score?.toFixed(3)}
                      </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-gray-700">{result.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent 查询 - 只有 RAG 启用时显示 */}
      {ragStatus.enabled && ragStatus.features?.agent_query && (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold">AI 智能助手</h2>
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
              需要配置 LLM API
            </span>
        </div>
        
        <form onSubmit={handleAgentQuery} className="space-y-4">
          <div>
            <textarea
              value={agentQuery}
              onChange={(e) => setAgentQuery(e.target.value)}
              placeholder="向 AI 助手提问（例如：找出所有关于产品设计的片段，并建议如何剪辑成短视频）"
              rows={3}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="search"
                checked={agentType === "search"}
                onChange={(e) => setAgentType(e.target.value)}
              />
              <Search className="w-4 h-4" />
              <span>搜索助手</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="clip_extractor"
                checked={agentType === "clip_extractor"}
                onChange={(e) => setAgentType(e.target.value)}
              />
              <Scissors className="w-4 h-4" />
              <span>剪辑建议助手</span>
            </label>
          </div>
          
          <button
            type="submit"
            disabled={agentRunning}
            className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
          >
            {agentRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 思考中...
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                发送
              </>
            )}
          </button>
        </form>

        {/* Agent 响应 */}
        {agentResponse && (
          <div className="mt-6 border rounded-lg p-4 bg-purple-50">
            <h3 className="font-semibold text-purple-900 mb-2">AI 助手回复：</h3>
            <div className="whitespace-pre-wrap text-gray-800">{agentResponse}</div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

export default AISearch;
