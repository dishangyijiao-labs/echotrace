import { useEffect, useState } from "react";
import { Bot, Sparkles, Search, Scissors, Database, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../lib/api";

function AISearch() {
  const { t } = useTranslation();
  const [ragStatus, setRagStatus] = useState({
    enabled: false,
    features: {}
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("keyword");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

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
      alert(t('aiSearch.syncComplete', {
        transcripts: response.data.transcripts,
        segments: response.data.segments
      }));
    } catch (error) {
      console.error("Sync failed:", error);
      alert(t('aiSearch.syncFailed') + (error.response?.data?.detail || error.message));
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
        response = await api.get("/search", {
          params: { q: searchQuery, limit: 20, offset: 0 }
        });
        const data = response.data?.data || [];
        setSearchResults(data.map(item => ({
          ...item,
          source: t('aiSearch.search.fullTextSource'),
          score: 1.0
        })));
      } else {
        response = await api.post("/search/semantic", {
        query: searchQuery,
        mode: searchMode,
        limit: 20,
      });
      setSearchResults(response.data?.data || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
      alert(t('aiSearch.searchFailed') + (error.response?.data?.detail || error.message));
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
      setAgentResponse(response.data?.response || t('aiSearch.agent.noResponse'));
    } catch (error) {
      console.error("Agent query failed:", error);
      setAgentResponse(t('aiSearch.agent.queryFailed') + (error.response?.data?.detail || error.message));
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
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold">{t('aiSearch.title')}</h1>
        </div>

        {/* RAG status indicator */}
        <div className="flex items-center gap-4">
          {ragStatus.enabled ? (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              {t('aiSearch.ragEnabled')}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {t('aiSearch.ragDisabled')}
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
              {t('aiSearch.syncing')}
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              {t('aiSearch.syncVectorDb')}
            </>
          )}
        </button>
          )}
        </div>
      </div>

      {/* Full-text mode notice */}
      {!ragStatus.enabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-800">{t('aiSearch.fullTextMode.title')}</h3>
              <p className="text-sm text-blue-700 mt-1">
                {t('aiSearch.fullTextMode.desc')}{" "}
                <strong>{t('aiSearch.fullTextMode.settingsLink')}</strong> {t('aiSearch.fullTextMode.switchSuffix')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold">
            {ragStatus.enabled ? t('aiSearch.search.titleSmart') : t('aiSearch.search.titleFulltext')}
          </h2>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ragStatus.enabled
                ? t('aiSearch.search.placeholderSmart')
                : t('aiSearch.search.placeholderFulltext')
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Search mode selection */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="keyword"
                checked={searchMode === "keyword"}
                onChange={(e) => setSearchMode(e.target.value)}
              />
              <span>{t('aiSearch.search.keyword')}</span>
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
              <span>{t('aiSearch.search.hybrid')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="semantic"
                checked={searchMode === "semantic"}
                onChange={(e) => setSearchMode(e.target.value)}
              />
              <span>{t('aiSearch.search.semantic')}</span>
            </label>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={searching}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {searching ? t('aiSearch.search.searching') : t('aiSearch.search.searchButton')}
          </button>
        </form>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-semibold text-gray-700">{t('aiSearch.search.resultCount', { count: searchResults.length })}</h3>
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
                          {t('aiSearch.search.similarity', { score: result.score?.toFixed(3) })}
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

      {/* Agent query */}
      {ragStatus.enabled && ragStatus.features?.agent_query && (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold">{t('aiSearch.agent.title')}</h2>
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
              {t('aiSearch.agent.requireLLM')}
            </span>
        </div>

        <form onSubmit={handleAgentQuery} className="space-y-4">
          <div>
            <textarea
              value={agentQuery}
              onChange={(e) => setAgentQuery(e.target.value)}
              placeholder={t('aiSearch.agent.placeholder')}
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
              <span>{t('aiSearch.agent.searchAssistant')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="clip_extractor"
                checked={agentType === "clip_extractor"}
                onChange={(e) => setAgentType(e.target.value)}
              />
              <Scissors className="w-4 h-4" />
              <span>{t('aiSearch.agent.clipAssistant')}</span>
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
                {t('aiSearch.agent.thinking')}
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                {t('aiSearch.agent.send')}
              </>
            )}
          </button>
        </form>

        {/* Agent response */}
        {agentResponse && (
          <div className="mt-6 border rounded-lg p-4 bg-purple-50">
            <h3 className="font-semibold text-purple-900 mb-2">{t('aiSearch.agent.response')}</h3>
            <div className="whitespace-pre-wrap text-gray-800">{agentResponse}</div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

export default AISearch;
