import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderPlus,
  FileAudio,
  FileVideo,
  FileText,
  RefreshCw,
  Search
} from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../lib/api";

function Resources() {
  const { t } = useTranslation();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const loadResources = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/media");
      setResources(response.data?.data || []);
    } catch (error) {
      console.error("Failed to load media:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const filteredResources = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return resources;
    return resources.filter((resource) =>
      resource.filename?.toLowerCase().includes(keyword)
    );
  }, [resources, searchTerm]);

  const handleImport = async () => {
    setMessage("");
    const selection = await open({
      multiple: true,
      filters: [
        { name: "Media", extensions: ["mp3", "wav", "m4a", "mp4", "mov", "mkv"] }
      ]
    });
    if (!selection) return;
    const paths = Array.isArray(selection) ? selection : [selection];
    if (paths.length === 0) return;

    try {
      setImporting(true);
      const response = await api.post("/media/import", { paths });
      const created = response.data?.created?.length || 0;
      setMessage(t('resources.importSuccess', { count: created }));
      loadResources();
    } catch (error) {
      console.error("Failed to import:", error);
      setMessage(t('resources.importError'));
    } finally {
      setImporting(false);
    }
  };

  const getIcon = (fileType) => {
    if (fileType?.startsWith("audio")) {
      return <FileAudio className="w-5 h-5 text-blue-500" />;
    }
    if (fileType?.startsWith("video")) {
      return <FileVideo className="w-5 h-5 text-purple-500" />;
    }
    return <FileText className="w-5 h-5 text-gray-400" />;
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
          <h1 className="text-3xl font-bold text-gray-900">{t('resources.title')}</h1>
          <p className="mt-2 text-gray-600">
            {t('resources.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadResources}
          >
            <RefreshCw className="w-4 h-4" />
            {t('resources.refresh')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleImport}
            disabled={importing}
          >
            <FolderPlus className="w-4 h-4" />
            {importing ? t('resources.importing') : t('resources.importFile')}
          </button>
        </div>
      </div>

      <div className="form-search">
        <Search className="form-search-icon" />
        <input
          className="form-search-input"
          placeholder={t('resources.searchPlaceholder')}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {message ? <div className="alert alert-info">{message}</div> : null}

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('resources.table.filename')}</th>
                <th>{t('resources.table.type')}</th>
                <th>{t('resources.table.path')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.map((resource) => (
                <tr key={resource.id}>
                  <td className="flex items-center gap-2">
                    {getIcon(resource.file_type)}
                    <span>{resource.filename}</span>
                  </td>
                  <td>{resource.file_type || "-"}</td>
                  <td className="text-xs text-gray-500">
                    {resource.path}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredResources.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">{t('resources.empty.title')}</p>
              <p className="empty-state-text">{t('resources.empty.text')}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Resources;
