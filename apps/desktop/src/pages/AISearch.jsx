import { useEffect, useState } from "react";
import { Bot, Sparkles, Search, Scissors, Database, Loader2 } from "lucide-react";
import api from "../lib/api";

function AISearch() {
  const [ragEnabled, setRagEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // 语义搜索
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("hybrid");
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
      setRagEnabled(response.data?.enabled || false);
    } catch (error) {
      console.error("Failed to check RAG status:", error);
      setRagEnabled(false);
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

  const handleSemanticSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await api.post("/search/semantic", {
        query: searchQuery,
        mode: searchMode,
        limit: 20,
      });
      setSearchResults(response.data?.data || []);
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

  if (!ragEnabled) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">RAG 模块未启用</h2>
          <p className="text-yellow-700 mb-4">
            请先安装 RAG 依赖：
          </p>
          <pre className="bg-yellow-100 p-3 rounded text-sm">
            cd apps/core{"\n"}
            pip install -r requirements-rag.txt
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold">AI 智能搜索</h1>
        </div>
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
      </div>

      {/* 语义搜索 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold">语义搜索</h2>
        </div>
        
        <form onSubmit={handleSemanticSearch} className="space-y-4">
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="输入搜索内容（支持语义理解）..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-4">
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
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="keyword"
                checked={searchMode === "keyword"}
                onChange={(e) => setSearchMode(e.target.value)}
              />
              <span>关键词检索</span>
            </label>
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
                      <span className="ml-2 text-xs text-gray-400">
                        分数: {result.score?.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-gray-700">{result.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent 查询 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-purple-500" />
          <h2 className="text-xl font-semibold">Agent 智能助手</h2>
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
    </div>
  );
}

export default AISearch;
