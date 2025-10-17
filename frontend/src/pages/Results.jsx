import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  FileText,
  Edit,
  Download,
  Search,
  Eye,
  Save,
  X,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  UploadCloud
} from 'lucide-react'

const STATUS_TABS = [
  { key: 'all', label: '全部', icon: RefreshCw },
  { key: 'completed', label: '已完成', icon: CheckCircle },
  { key: 'processing', label: '处理中', icon: Clock },
  { key: 'failed', label: '失败', icon: AlertCircle }
]

const STATUS_CLASS_MAP = {
  completed: 'is-completed',
  processing: 'is-processing',
  failed: 'is-failed'
}

function Results() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [editingResult, setEditingResult] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  const loadResults = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        ...(filter !== 'all' && { status: filter }),
        ...(searchTerm && { search: searchTerm })
      }
      const response = await axios.get('/api/transcripts/', { params })
      setResults(response.data)
    } catch (error) {
      console.error('Failed to load results:', error)
    } finally {
      setLoading(false)
    }
  }, [filter, searchTerm])

  useEffect(() => {
    loadResults()
  }, [loadResults])

  const filteredResults = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    return results.filter((result) => {
      if (filter !== 'all' && result.status !== filter) return false
      if (!keyword) return true

      const filename = result.filename?.toLowerCase() || ''
      const content = result.content?.toLowerCase() || ''

      return filename.includes(keyword) || content.includes(keyword)
    })
  }, [results, filter, searchTerm])

  const startEditing = (result) => {
    setEditingResult(result.id)
    setEditContent(result.content || '')
  }

  const cancelEditing = () => {
    setEditingResult(null)
    setEditContent('')
  }

  const saveEdit = async (resultId) => {
    try {
      setSaving(true)
      await axios.patch(`/api/transcripts/${resultId}/`, {
        content: editContent
      })
      cancelEditing()
      loadResults()
    } catch (error) {
      console.error('Failed to save edit:', error)
    } finally {
      setSaving(false)
    }
  }

  const downloadTranscript = async (resultId, filename) => {
    try {
      const response = await axios.get(`/api/transcripts/${resultId}/download/`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${filename}.txt`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Failed to download transcript:', error)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="results-status-icon" />
      case 'processing':
        return <Clock className="results-status-icon" />
      case 'failed':
        return <AlertCircle className="results-status-icon" />
      default:
        return <Clock className="results-status-icon" />
    }
  }

  const getStatusText = (status) => {
    const statusMap = {
      completed: '已完成',
      processing: '处理中',
      failed: '失败'
    }
    return statusMap[status] || status
  }

  const getContentPreview = (content) => {
    if (!content) return '暂无内容'
    const trimmed = content.replace(/\s+/g, ' ').trim()
    if (trimmed.length <= 120) {
      return trimmed
    }
    return `${trimmed.slice(0, 120)}...`
  }

  if (loading) {
    return (
      <div className="results-loading">
        <span className="spinner" />
      </div>
    )
  }

  return (
    <div className="results-page">
      <div className="results-header">
        <div>
          <h1 className="results-title">转录结果</h1>
          <p className="results-subtitle">
            查看、编辑和导出转录文本，随时掌握处理状态与历史版本。
          </p>
        </div>
        <div className="results-actions">
          <button type="button" className="results-icon-button" onClick={loadResults}>
            <RefreshCw className="results-icon-button-icon" />
            <span>刷新列表</span>
          </button>
          <Link to="/resources" className="results-primary-button">
            <UploadCloud className="results-primary-button-icon" />
            上传文件
          </Link>
        </div>
      </div>

      <div className="results-toolbar">
        <div className="results-search">
          <Search className="results-search-icon" />
          <input
            type="text"
            placeholder="搜索文件名或内容..."
            className="results-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="results-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`results-tab${filter === tab.key ? ' is-active' : ''}`}
            >
              <tab.icon className="results-tab-icon" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="results-card">
        <div className="results-table-container">
          <table className="results-table">
            <thead>
              <tr>
                <th>文件信息</th>
                <th>状态</th>
                <th>语言</th>
                <th>时长</th>
                <th>创建时间</th>
                <th>关联资源</th>
                <th>版本</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result) => (
                <tr key={result.id}>
                  <td>
                    <div className="results-file">
                      <div className="results-file-name">
                        <FileText className="results-file-icon" />
                        <span>{result.filename}</span>
                      </div>
                      <p className="results-snippet">{getContentPreview(result.content)}</p>
                    </div>
                  </td>
                  <td>
                    <span className={`results-status ${STATUS_CLASS_MAP[result.status] || ''}`}>
                      {getStatusIcon(result.status)}
                      <span>{getStatusText(result.status)}</span>
                    </span>
                  </td>
                  <td>{result.language || 'zh-CN'}</td>
                  <td>{result.duration ? `${Math.round(result.duration / 60)} 分钟` : '-'}</td>
                  <td>{new Date(result.created_at).toLocaleString()}</td>
                  <td>
                    {result.resource ? (
                      <Link to={`/resources/${result.resource.id}`} className="results-resource-link">
                        {result.resource.filename}
                        <ExternalLink className="results-resource-icon" />
                      </Link>
                    ) : (
                      <span className="results-resource-empty">无</span>
                    )}
                  </td>
                  <td>
                    <span className="results-version">v{result.version || 1}</span>
                  </td>
                  <td>
                    <div className="results-row-actions">
                      {result.status === 'completed' && (
                        <>
                          <button
                            type="button"
                            className="results-row-button is-edit"
                            onClick={() => startEditing(result)}
                            title="编辑"
                          >
                            <Edit className="results-row-button-icon" />
                          </button>
                          <button
                            type="button"
                            className="results-row-button is-download"
                            onClick={() => downloadTranscript(result.id, result.filename)}
                            title="下载"
                          >
                            <Download className="results-row-button-icon" />
                          </button>
                        </>
                      )}
                      <Link
                        to={`/results/${result.id}`}
                        className="results-row-button is-view"
                        title="查看详情"
                      >
                        <Eye className="results-row-button-icon" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredResults.length === 0 && (
            <div className="results-empty">
              <FileText className="results-empty-icon" />
              <h3 className="results-empty-title">暂无转录结果</h3>
              <p className="results-empty-text">
                {searchTerm || filter !== 'all'
                  ? '没有找到匹配的结果，请调整搜索或状态筛选。'
                  : '上传音视频文件后，系统会生成对应的转录内容。'}
              </p>
              {!searchTerm && filter === 'all' && (
                <p className="results-empty-note">使用右上角的“上传文件”按钮，开始新的转录任务。</p>
              )}
            </div>
          )}
        </div>
      </div>

      {editingResult && (
        <div
          className="results-modal-overlay"
          role="presentation"
          onClick={cancelEditing}
        >
          <div
            className="results-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="results-modal-header">
              <div>
                <h3 className="results-modal-title">编辑转录文本</h3>
                <p className="results-modal-subtitle">保存后会生成新版本，原始内容仍可在版本历史中查看。</p>
              </div>
              <button
                type="button"
                className="results-modal-close"
                onClick={cancelEditing}
                aria-label="关闭"
              >
                <X className="results-modal-close-icon" />
              </button>
            </div>

            <div className="results-modal-body">
              <label className="results-field-label" htmlFor="results-content">转录内容</label>
              <textarea
                id="results-content"
                className="results-modal-textarea"
                rows={18}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="编辑当前转录文本..."
              />
              <p className="results-modal-tip">提示：建议先在左侧备份原文，再进行大幅修改。</p>
            </div>

            <div className="results-modal-footer">
              <button
                type="button"
                className="results-secondary-button"
                onClick={cancelEditing}
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                className="results-primary-button"
                onClick={() => saveEdit(editingResult)}
                disabled={saving || editContent.trim() === ''}
              >
                {saving ? (
                  <>
                    <span className="spinner-sm" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="results-primary-button-icon" />
                    保存改动
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Results
