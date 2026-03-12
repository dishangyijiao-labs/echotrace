import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Database, Download, Loader2, RefreshCw, Search, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ask } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import api from "../lib/api";

function downloadBlob(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadBlobRaw(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const EMPTY_FILTERS = {
  date_from: "",
  date_to: "",
  duration_min: "",
  duration_max: "",
  language: "",
  file_type: "",
  sort_by: "relevance",
};

function activeFilterCount(filters) {
  return Object.entries(filters).filter(
    ([k, v]) => v && !(k === "sort_by" && v === "relevance")
  ).length;
}

function Results() {
  const { t } = useTranslation();
  const [results, setResults] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [inputValue, setInputValue] = useState(""); // display value (updates freely)
  const [searchTerm, setSearchTerm] = useState(""); // committed value (triggers search)
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchExporting, setBatchExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const searchLimit = 20;

  // IME composition guard
  const composingRef = useRef(false);

  // Semantic search state
  const [searchMode, setSearchMode] = useState("keyword"); // keyword | hybrid | semantic
  const [ragEnabled, setRagEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    api.get("/rag/status").then((res) => {
      const enabled = res.data?.enabled || false;
      setRagEnabled(enabled);
      if (enabled) setSearchMode("hybrid");
    }).catch(() => {});
  }, []);

  const loadResults = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/transcripts");
      setResults(response.data?.data || []);
    } catch (error) {
      console.error("Failed to load transcripts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  useEffect(() => {
    const initial = searchParams.get("q") || "";
    const offsetParam = Number(searchParams.get("offset") || 0);
    if (initial !== searchTerm) {
      setSearchTerm(initial);
      setInputValue(initial);
    }
    if (!Number.isNaN(offsetParam) && offsetParam !== searchOffset)
      setSearchOffset(Math.max(0, offsetParam));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const runSearch = useCallback(
    async (term, offset, activeFilters, mode) => {
      const keyword = term.trim();
      if (!keyword) {
        setSearchResults([]);
        setSearchTotal(0);
        return;
      }
      try {
        setSearchLoading(true);

        // Use semantic/hybrid endpoint when RAG is enabled and mode is not keyword
        if (ragEnabled && mode !== "keyword") {
          const response = await api.post("/search/semantic", {
            query: keyword,
            mode,
            limit: searchLimit,
          });
          const data = (response.data?.data || []).map((item) => ({
            ...item,
            id: item.segment_id,
            snippet: item.text,
          }));
          setSearchResults(data);
          setSearchTotal(response.data?.total || data.length);
        } else {
          const params = { q: keyword, limit: searchLimit, offset };
          if (activeFilters.date_from) params.date_from = activeFilters.date_from;
          if (activeFilters.date_to) params.date_to = activeFilters.date_to;
          if (activeFilters.duration_min !== "") params.duration_min = Number(activeFilters.duration_min);
          if (activeFilters.duration_max !== "") params.duration_max = Number(activeFilters.duration_max);
          if (activeFilters.language) params.language = activeFilters.language;
          if (activeFilters.file_type) params.file_type = activeFilters.file_type;
          if (activeFilters.sort_by && activeFilters.sort_by !== "relevance")
            params.sort_by = activeFilters.sort_by;
          const response = await api.get("/search", { params });
          setSearchResults(response.data?.data || []);
          setSearchTotal(response.data?.total || 0);
        }
      } catch (error) {
        console.error("Failed to search:", error);
        setSearchResults([]);
        setSearchTotal(0);
      } finally {
        setSearchLoading(false);
      }
    },
    [searchLimit, ragEnabled]
  );

  useEffect(() => {
    runSearch(searchTerm, searchOffset, filters, searchMode);
  }, [runSearch, searchOffset, searchTerm, filters, searchMode]);

  const filtered = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return results;
    return results.filter((item) => {
      const name = item.filename?.toLowerCase() || "";
      const content = item.content?.toLowerCase() || "";
      return name.includes(keyword) || content.includes(keyword);
    });
  }, [results, searchTerm]);

  const handleExport = async (id, filename, format) => {
    try {
      const response = await api.get(`/export/${id}`, { params: { format } });
      downloadBlob(`${filename}.${format}`, response.data?.content || "");
    } catch (error) {
      console.error("Failed to export:", error);
    }
  };

  const handleBatchExport = async (format) => {
    if (selectedIds.size === 0) return;
    try {
      setBatchExporting(true);
      const response = await api.post(
        "/export/batch",
        { transcript_ids: [...selectedIds], format },
        { responseType: "blob" }
      );
      downloadBlobRaw("echotrace_export.zip", response.data);
    } catch (error) {
      console.error("Failed to batch export:", error);
    } finally {
      setBatchExporting(false);
    }
  };

  const deleteTranscript = async (item) => {
    const confirmed = await ask(t('results.delete.confirmMessage', { filename: item.filename }), {
      title: t('results.delete.confirmTitle'),
      kind: "warning",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/transcripts/${item.id}`);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
      loadResults();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const batchDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await ask(t('results.delete.batchConfirmMessage', { count: selectedIds.size }), {
      title: t('results.delete.batchConfirmTitle'),
      kind: "warning",
    });
    if (!confirmed) return;
    try {
      await Promise.all([...selectedIds].map((id) => api.delete(`/transcripts/${id}`)));
      setSelectedIds(new Set());
      loadResults();
    } catch (error) {
      console.error("Batch delete failed:", error);
    }
  };

  const handleSyncVectorDb = async () => {
    setSyncing(true);
    try {
      const response = await api.post("/rag/sync-all", null, {
        params: { embedding_provider: "local" },
      });
      alert(t('results.sync.complete', {
        transcripts: response.data.transcripts,
        segments: response.data.segments,
      }));
    } catch (error) {
      console.error("Sync failed:", error);
      alert(t('results.sync.failed') + (error.response?.data?.detail || error.message));
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.size === filtered.length
        ? new Set()
        : new Set(filtered.map((r) => r.id))
    );
  };

  const highlightText = (text, term) => {
    if (!term.trim() || !text) return text;
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.split(regex).map((part, index) =>
      part.toLowerCase() === term.toLowerCase() ? (
        <mark key={index} className="bg-yellow-100 text-yellow-800 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  const updateTimerRef = useRef(null);
  const updateSearchParams = useCallback((term, offset = 0) => {
    clearTimeout(updateTimerRef.current);
    updateTimerRef.current = setTimeout(() => {
      const trimmed = term.trim();
      setSearchParams(trimmed ? { q: trimmed, offset: String(offset) } : {});
    }, 300);
  }, [setSearchParams]);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSearchOffset(0);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchOffset(0);
  };

  const filterCount = activeFilterCount(filters);
  const hasSearch = searchTerm.trim().length > 0;
  const searchPage = Math.floor(searchOffset / searchLimit) + 1;
  const totalPages = Math.max(1, Math.ceil(searchTotal / searchLimit));
  const pageStart = searchTotal === 0 ? 0 : searchOffset + 1;
  const pageEnd = Math.min(searchOffset + searchLimit, searchTotal);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('results.title')}</h1>
          <p className="mt-1 text-gray-500 text-sm">{t('results.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {ragEnabled && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={syncing}
              onClick={handleSyncVectorDb}
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {syncing ? t('results.sync.syncing') : t('results.sync.button')}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={loadResults}>
            <RefreshCw className="w-4 h-4" />
            {t('results.refresh')}
          </button>
        </div>
      </div>

      {/* Search bar + mode toggle + filter toggle */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="form-search flex-1">
            <Search className="form-search-icon" />
            <input
              className="form-search-input"
              placeholder={t('results.searchPlaceholder')}
              value={inputValue}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={(e) => {
                composingRef.current = false;
                const val = e.target.value;
                setInputValue(val);
                setSearchTerm(val);
                setSearchOffset(0);
                updateSearchParams(val, 0);
              }}
              onChange={(e) => {
                const val = e.target.value;
                setInputValue(val);
                if (!composingRef.current) {
                  setSearchTerm(val);
                  setSearchOffset(0);
                  updateSearchParams(val, 0);
                }
              }}
            />
          </div>
          <button
            type="button"
            className={`btn flex items-center gap-1.5 ${showFilters || filterCount > 0 ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {t('results.filter')}
            {filterCount > 0 && (
              <span className="bg-white text-blue-600 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {/* Search mode selector */}
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="searchMode"
              value="keyword"
              checked={searchMode === "keyword"}
              onChange={(e) => setSearchMode(e.target.value)}
              className="text-blue-600"
            />
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-700">{t('results.searchMode.keyword')}</span>
          </label>
          {ragEnabled && (
            <>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="searchMode"
                  value="hybrid"
                  checked={searchMode === "hybrid"}
                  onChange={(e) => setSearchMode(e.target.value)}
                  className="text-blue-600"
                />
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-gray-700">{t('results.searchMode.hybrid')}</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="searchMode"
                  value="semantic"
                  checked={searchMode === "semantic"}
                  onChange={(e) => setSearchMode(e.target.value)}
                  className="text-blue-600"
                />
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-gray-700">{t('results.searchMode.semantic')}</span>
              </label>
            </>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="card border-blue-100 bg-blue-50/40 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Date range */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('results.filters.dateFrom')}</label>
                <input
                  type="date"
                  className="form-input text-sm"
                  value={filters.date_from}
                  onChange={(e) => setFilter("date_from", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('results.filters.dateTo')}</label>
                <input
                  type="date"
                  className="form-input text-sm"
                  value={filters.date_to}
                  onChange={(e) => setFilter("date_to", e.target.value)}
                />
              </div>

              {/* File type */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('results.filters.fileType')}</label>
                <select
                  className="form-input text-sm"
                  value={filters.file_type}
                  onChange={(e) => setFilter("file_type", e.target.value)}
                >
                  <option value="">{t('results.filters.all')}</option>
                  <option value="video">{t('results.filters.video')}</option>
                  <option value="audio">{t('results.filters.audio')}</option>
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('results.filters.durationMin')}</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="form-input text-sm"
                  value={filters.duration_min}
                  onChange={(e) => setFilter("duration_min", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('results.filters.durationMax')}</label>
                <input
                  type="number"
                  min="0"
                  placeholder={t('results.filters.durationMaxPlaceholder')}
                  className="form-input text-sm"
                  value={filters.duration_max}
                  onChange={(e) => setFilter("duration_max", e.target.value)}
                />
              </div>

              {/* Language */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('results.filters.languageCode')}</label>
                <input
                  type="text"
                  placeholder={t('results.filters.languagePlaceholder')}
                  className="form-input text-sm"
                  value={filters.language}
                  onChange={(e) => setFilter("language", e.target.value)}
                />
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-4 pt-1 border-t border-blue-100">
              <span className="text-xs font-medium text-gray-500">{t('results.filters.sortBy')}</span>
              {[
                { value: "relevance", label: t('results.filters.relevance') },
                { value: "date", label: t('results.filters.date') },
                { value: "duration", label: t('results.filters.duration') },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    filters.sort_by === opt.value
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                  onClick={() => setFilter("sort_by", opt.value)}
                >
                  {opt.label}
                </button>
              ))}
              {filterCount > 0 && (
                <button
                  type="button"
                  className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
                  onClick={clearFilters}
                >
                  <X className="w-3 h-3" />
                  {t('results.filters.clearFilters')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search results */}
      {hasSearch ? (
        <div className="card">
          <div className="table-wrapper">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 text-sm text-gray-500">
              <span>{t('results.searchResults.total', { total: searchTotal, start: pageStart, end: pageEnd })}</span>
              {searchMode === "keyword" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const next = Math.max(0, searchOffset - searchLimit);
                      setSearchOffset(next);
                      updateSearchParams(searchTerm, next);
                    }}
                    disabled={searchOffset === 0}
                  >
                    {t('results.searchResults.prevPage')}
                  </button>
                  <span className="text-xs text-gray-400">{searchPage} / {totalPages}</span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const next = searchOffset + searchLimit;
                      if (next >= searchTotal) return;
                      setSearchOffset(next);
                      updateSearchParams(searchTerm, next);
                    }}
                    disabled={searchOffset + searchLimit >= searchTotal}
                  >
                    {t('results.searchResults.nextPage')}
                  </button>
                </div>
              )}
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('results.table.filename')}</th>
                  <th>{t('results.table.segment')}</th>
                  <th>{t('results.table.time')}</th>
                  {searchMode !== "keyword" && <th>{t('results.table.source')}</th>}
                  <th>{t('results.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((item) => {
                  const filename = item.filename || `#${item.transcript_id}`;
                  const snippet = item.snippet || item.text || "";
                  const linkParams = new URLSearchParams({
                    segment: String(item.id || item.segment_id),
                    q: searchTerm.trim(),
                  });
                  return (
                    <tr key={`${item.transcript_id}-${item.id || item.segment_id}`}>
                      <td>
                        <Link
                          className="text-blue-600 hover:text-blue-700 text-sm"
                          to={`/results/${item.transcript_id}?${linkParams}`}
                        >
                          {filename}
                        </Link>
                      </td>
                      <td className="text-xs text-gray-500 max-w-sm">
                        {highlightText(snippet, searchTerm)}
                      </td>
                      <td className="text-xs text-gray-400 whitespace-nowrap">
                        {item.start?.toFixed(1)}s - {item.end?.toFixed(1)}s
                      </td>
                      {searchMode !== "keyword" && (
                        <td>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            item.source === "semantic"
                              ? "bg-purple-100 text-purple-600"
                              : "bg-blue-100 text-blue-600"
                          }`}>
                            {item.source === "semantic" ? t('results.searchMode.semantic') : t('results.searchMode.keyword')}
                          </span>
                        </td>
                      )}
                      <td>
                        <Link
                          className="btn btn-secondary"
                          to={`/results/${item.transcript_id}?${linkParams}`}
                        >
                          {t('results.searchResults.locate')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {searchLoading ? (
              <div className="empty-state">
                <p className="empty-state-title">{t('results.searchResults.searching')}</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">{t('results.searchResults.noMatch')}</p>
                <p className="empty-state-text">{t('results.searchResults.noMatchHint')}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        // Browse mode
        <div className="card">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <span className="text-sm text-gray-600">{t('results.batch.selected', { count: selectedIds.size })}</span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={batchExporting}
                onClick={() => handleBatchExport("txt")}
              >
                <Download className="w-4 h-4" />
                {t('results.batch.exportTxt')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={batchExporting}
                onClick={() => handleBatchExport("srt")}
              >
                <Download className="w-4 h-4" />
                {t('results.batch.exportSrt')}
              </button>
              <button
                type="button"
                className="btn btn-secondary text-red-600 hover:bg-red-50"
                onClick={batchDelete}
              >
                <Trash2 className="w-4 h-4" />
                {t('results.batch.batchDelete')}
              </button>
            </div>
          )}
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>{t('results.table.filename')}</th>
                  <th>{t('results.table.summary')}</th>
                  <th>{t('results.table.language')}</th>
                  <th>{t('results.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td>
                      <Link
                        className="text-blue-600 hover:text-blue-700"
                        to={`/results/${item.id}`}
                      >
                        {item.filename}
                      </Link>
                    </td>
                    <td className="text-xs text-gray-500 max-w-xs truncate">
                      {item.summary || "\u2014"}
                    </td>
                    <td className="text-xs">{item.language || "\u2014"}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleExport(item.id, item.filename, "txt")}
                        >
                          <Download className="w-4 h-4" />
                          TXT
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleExport(item.id, item.filename, "srt")}
                        >
                          <Download className="w-4 h-4" />
                          SRT
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary text-red-500 hover:bg-red-50"
                          onClick={() => deleteTranscript(item)}
                          title={t('results.delete.buttonTitle')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-title">{t('results.empty.title')}</p>
                <p className="empty-state-text">{t('results.empty.text')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Results;
