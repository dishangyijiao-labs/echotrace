import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
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
  const [results, setResults] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchExporting, setBatchExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const searchLimit = 20;

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
    if (initial !== searchTerm) setSearchTerm(initial);
    if (!Number.isNaN(offsetParam) && offsetParam !== searchOffset)
      setSearchOffset(Math.max(0, offsetParam));
  }, [searchParams, searchTerm, searchOffset]);

  const runSearch = useCallback(
    async (term, offset, activeFilters) => {
      const keyword = term.trim();
      if (!keyword) {
        setSearchResults([]);
        setSearchTotal(0);
        return;
      }
      try {
        setSearchLoading(true);
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
      } catch (error) {
        console.error("Failed to search:", error);
        setSearchResults([]);
        setSearchTotal(0);
      } finally {
        setSearchLoading(false);
      }
    },
    [searchLimit]
  );

  useEffect(() => {
    runSearch(searchTerm, searchOffset, filters);
  }, [runSearch, searchOffset, searchTerm, filters]);

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

  const updateSearchParams = (term, offset = 0) => {
    const trimmed = term.trim();
    setSearchParams(trimmed ? { q: trimmed, offset: String(offset) } : {});
  };

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
          <h1 className="text-3xl font-bold text-gray-900">转录结果</h1>
          <p className="mt-1 text-gray-500 text-sm">搜索关键词并跳转到对应时间轴。</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadResults}>
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* Search bar + filter toggle */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="form-search flex-1">
            <Search className="form-search-icon" />
            <input
              className="form-search-input"
              placeholder="搜索关键词（跨全库）"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchOffset(0);
                updateSearchParams(e.target.value, 0);
              }}
            />
          </div>
          <button
            type="button"
            className={`btn flex items-center gap-1.5 ${showFilters || filterCount > 0 ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            筛选
            {filterCount > 0 && (
              <span className="bg-white text-blue-600 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="card border-blue-100 bg-blue-50/40 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Date range */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">开始日期</label>
                <input
                  type="date"
                  className="form-input text-sm"
                  value={filters.date_from}
                  onChange={(e) => setFilter("date_from", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">结束日期</label>
                <input
                  type="date"
                  className="form-input text-sm"
                  value={filters.date_to}
                  onChange={(e) => setFilter("date_to", e.target.value)}
                />
              </div>

              {/* File type */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">文件类型</label>
                <select
                  className="form-input text-sm"
                  value={filters.file_type}
                  onChange={(e) => setFilter("file_type", e.target.value)}
                >
                  <option value="">全部</option>
                  <option value="video">视频</option>
                  <option value="audio">音频</option>
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">最短时长（秒）</label>
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
                <label className="text-xs font-medium text-gray-500 mb-1 block">最长时长（秒）</label>
                <input
                  type="number"
                  min="0"
                  placeholder="不限"
                  className="form-input text-sm"
                  value={filters.duration_max}
                  onChange={(e) => setFilter("duration_max", e.target.value)}
                />
              </div>

              {/* Language */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">语言代码</label>
                <input
                  type="text"
                  placeholder="如 zh、en、ja"
                  className="form-input text-sm"
                  value={filters.language}
                  onChange={(e) => setFilter("language", e.target.value)}
                />
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-4 pt-1 border-t border-blue-100">
              <span className="text-xs font-medium text-gray-500">排序方式</span>
              {[
                { value: "relevance", label: "相关度" },
                { value: "date", label: "时间" },
                { value: "duration", label: "时长" },
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
                  清除筛选
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
              <span>共 {searchTotal} 条，显示 {pageStart}–{pageEnd}</span>
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
                  上一页
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
                  下一页
                </button>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>片段</th>
                  <th>时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((item) => {
                  const filename = item.filename || `#${item.transcript_id}`;
                  const snippet = item.snippet || item.text || "";
                  const linkParams = new URLSearchParams({
                    segment: String(item.id),
                    q: searchTerm.trim(),
                  });
                  return (
                    <tr key={item.id}>
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
                        {item.start?.toFixed(1)}s – {item.end?.toFixed(1)}s
                      </td>
                      <td>
                        <Link
                          className="btn btn-secondary"
                          to={`/results/${item.transcript_id}?${linkParams}`}
                        >
                          定位
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {searchLoading ? (
              <div className="empty-state">
                <p className="empty-state-title">搜索中...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">暂无匹配片段</p>
                <p className="empty-state-text">换个关键词，或调整筛选条件试试。</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        // Browse mode
        <div className="card">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <span className="text-sm text-gray-600">已选 {selectedIds.size} 项</span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={batchExporting}
                onClick={() => handleBatchExport("txt")}
              >
                <Download className="w-4 h-4" />
                批量导出 TXT
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={batchExporting}
                onClick={() => handleBatchExport("srt")}
              >
                <Download className="w-4 h-4" />
                批量导出 SRT
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
                  <th>文件名</th>
                  <th>摘要</th>
                  <th>语言</th>
                  <th>操作</th>
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
                      {item.summary || "—"}
                    </td>
                    <td className="text-xs">{item.language || "—"}</td>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-title">暂无转录结果</p>
                <p className="empty-state-text">完成转写任务后会出现在这里。</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Results;
