import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
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
    if (initial !== searchTerm) {
      setSearchTerm(initial);
    }
    if (!Number.isNaN(offsetParam) && offsetParam !== searchOffset) {
      setSearchOffset(Math.max(0, offsetParam));
    }
  }, [searchParams, searchTerm, searchOffset]);

  const runSearch = useCallback(
    async (term, offset) => {
      const keyword = term.trim();
      if (!keyword) {
        setSearchResults([]);
        setSearchTotal(0);
        return;
      }
      try {
        setSearchLoading(true);
        const response = await api.get("/search", {
          params: { q: keyword, limit: searchLimit, offset }
        });
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
    runSearch(searchTerm, searchOffset);
  }, [runSearch, searchOffset, searchTerm]);

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
      const content = response.data?.content || "";
      downloadBlob(`${filename}.${format}`, content);
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
      downloadBlobRaw(`echotrace_export.zip`, response.data);
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
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const highlightText = (text, term) => {
    if (!term.trim() || !text) return text;
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.split(regex).map((part, index) => {
      const isMatch = part.toLowerCase() === term.toLowerCase();
      if (!isMatch) return <span key={index}>{part}</span>;
      return (
        <mark key={index} className="bg-yellow-100 text-yellow-800 px-1 rounded">
          {part}
        </mark>
      );
    });
  };

  const updateSearchParams = (term, offset = 0) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setSearchParams({});
      return;
    }
    const next = { q: trimmed, offset: String(offset) };
    setSearchParams(next);
  };

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
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">转录结果</h1>
          <p className="mt-2 text-gray-600">搜索关键词并跳转到对应时间轴。</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadResults}>
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      <div className="form-search">
        <Search className="form-search-icon" />
        <input
          className="form-search-input"
          placeholder="搜索关键词（跨全库）"
          value={searchTerm}
          onChange={(event) => {
            const value = event.target.value;
            setSearchTerm(value);
            setSearchOffset(0);
            updateSearchParams(value, 0);
          }}
        />
      </div>

      {hasSearch ? (
        <div className="card">
          <div className="table-wrapper">
            <div className="flex items-center justify-between px-4 pt-4 text-sm text-gray-500">
              <span>
                共 {searchTotal} 条，显示 {pageStart}-{pageEnd}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const nextOffset = Math.max(0, searchOffset - searchLimit);
                    setSearchOffset(nextOffset);
                    updateSearchParams(searchTerm, nextOffset);
                  }}
                  disabled={searchOffset === 0}
                >
                  上一页
                </button>
                <span className="text-xs text-gray-400">
                  {searchPage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const nextOffset = searchOffset + searchLimit;
                    if (nextOffset >= searchTotal) return;
                    setSearchOffset(nextOffset);
                    updateSearchParams(searchTerm, nextOffset);
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
                    q: searchTerm.trim()
                  });
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link
                          className="text-blue-600 hover:text-blue-700"
                          to={`/results/${item.transcript_id}?${linkParams.toString()}`}
                        >
                          {filename}
                        </Link>
                      </td>
                      <td className="text-xs text-gray-500">
                        {highlightText(snippet, searchTerm)}
                      </td>
                      <td className="text-xs text-gray-500">
                        {item.start?.toFixed(2)}s - {item.end?.toFixed(2)}s
                      </td>
                      <td>
                        <Link
                          className="btn btn-secondary"
                          to={`/results/${item.transcript_id}?${linkParams.toString()}`}
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
                <p className="empty-state-text">稍等片刻</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">暂无匹配片段</p>
                <p className="empty-state-text">换个关键词试试。</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="card">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 pt-4">
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
                    <td className="text-xs text-gray-500">
                      {item.summary || "-"}
                    </td>
                    <td>{item.language || "-"}</td>
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
            {filtered.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">暂无转录结果</p>
                <p className="empty-state-text">完成转写任务后会出现在这里。</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default Results;
