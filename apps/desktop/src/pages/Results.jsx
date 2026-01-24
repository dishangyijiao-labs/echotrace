import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
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

function Results() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
          <p className="mt-2 text-gray-600">查看转写文本、时间轴与导出。</p>
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
          placeholder="搜索文件名或内容"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
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
    </div>
  );
}

export default Results;
