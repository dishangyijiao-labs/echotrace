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
      const response = await axios.get('/transcripts/', { params })
      // Handle both wrapped and unwrapped responses
      const data = response.data?.data || response.data
      setResults(Array.isArray(data) ? data : data?.results || [])
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
      await axios.patch(`/transcripts/${resultId}/`, {
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
      const response = await axios.get(`/transcripts/${resultId}/download/`, {
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
        return <CheckCircle className="w-4 h-4" />
      case 'processing':
        return <Clock className="w-4 h-4" />
      case 'failed':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
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
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">转录结果</h1>
          <p className="mt-2 text-lg text-gray-600">
            查看、编辑和导出转录文本，随时掌握处理状态与历史版本。
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button type="button" className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" onClick={loadResults}>
            <RefreshCw className="w-4 h-4 mr-2" />
            <span>刷新列表</span>
          </button>
          <Link to="/resources" className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            <UploadCloud className="w-4 h-4 mr-2" />
            上传文件
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索文件名或内容..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === tab.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文件信息</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">语言</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时长</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">关联资源</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">版本</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResults.map((result) => (
                <tr key={result.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">{result.filename}</span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2">{getContentPreview(result.content)}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      result.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : result.status === 'processing'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {getStatusIcon(result.status)}
                      <span className="ml-1">{getStatusText(result.status)}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{result.language || 'zh-CN'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{result.duration ? `${Math.round(result.duration / 60)} 分钟` : '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{new Date(result.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    {result.resource ? (
                      <Link to={`/resources/${result.resource.id}`} className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800">
                        {result.resource.filename}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">无</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">v{result.version || 1}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {result.status === 'completed' && (
                        <>
                          <button
                            type="button"
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            onClick={() => startEditing(result)}
                            title="编辑"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                            onClick={() => downloadTranscript(result.id, result.filename)}
                            title="下载"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <Link
                        to={`/results/${result.id}`}
                        className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredResults.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无转录结果</h3>
              <p className="text-sm text-gray-500 mb-4">
                {searchTerm || filter !== 'all'
                  ? '没有找到匹配的结果，请调整搜索或状态筛选。'
                  : '上传音视频文件后，系统会生成对应的转录内容。'}
              </p>
              {!searchTerm && filter === 'all' && (
                <p className="text-xs text-gray-400">使用右上角的"上传文件"按钮，开始新的转录任务。</p>
              )}
            </div>
          )}
        </div>
      </div>

      {editingResult && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          role="presentation"
          onClick={cancelEditing}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">编辑转录文本</h3>
                <p className="mt-1 text-sm text-gray-500">保存后会生成新版本，原始内容仍可在版本历史中查看。</p>
              </div>
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={cancelEditing}
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="results-content">转录内容</label>
              <textarea
                id="results-content"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={18}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="编辑当前转录文本..."
              />
              <p className="mt-2 text-xs text-gray-500">提示：建议先在左侧备份原文，再进行大幅修改。</p>
            </div>

            <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                type="button"
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                onClick={cancelEditing}
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                onClick={() => saveEdit(editingResult)}
                disabled={saving || editContent.trim() === ''}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
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
