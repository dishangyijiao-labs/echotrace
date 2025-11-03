import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import axios from 'axios'
import {
  Upload,
  Search,
  Eye,
  Download,
  Trash2,
  Tag,
  FileAudio,
  FileVideo,
  File,
  Plus,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

const TYPE_TABS = [
  { key: 'all', label: '全部' },
  { key: 'audio', label: '音频' },
  { key: 'video', label: '视频' }
]

function Resources() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedResource, setSelectedResource] = useState(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const fileInputRef = useRef(null)

  const loadResources = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        ...(filter !== 'all' && { type: filter }),
        ...(searchTerm && { search: searchTerm })
      }
      const response = await axios.get('/resources/', { params })
      // Handle both wrapped and unwrapped responses
      const data = response.data?.data || response.data
      setResources(Array.isArray(data) ? data : data?.results || [])
    } catch (error) {
      console.error('Failed to load resources:', error)
    } finally {
      setLoading(false)
    }
  }, [filter, searchTerm])

  useEffect(() => {
    loadResources()
  }, [loadResources])

  const filteredResources = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    return resources.filter((resource) => {
      if (filter === 'audio' && !resource.file_type?.startsWith('audio/')) return false
      if (filter === 'video' && !resource.file_type?.startsWith('video/')) return false

      if (!keyword) return true

      const filename = resource.filename?.toLowerCase() || ''
      const tags = resource.tags?.map((tag) => tag.name.toLowerCase()) || []

      return filename.includes(keyword) || tags.some((tag) => tag.includes(keyword))
    })
  }, [resources, filter, searchTerm])

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadError('')
    setUploadSuccess('')
    const formData = new FormData()

    Array.from(files).forEach((file) => {
      formData.append('files', file)
    })

    try {
      await axios.post('/resources/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      // Show success message
      const uploadedCount = files.length
      setUploadSuccess(`成功上传 ${uploadedCount} 个文件！`)
      
      // Wait a bit to show the success message, then close modal and reload
      setTimeout(() => {
        setShowUploadModal(false)
        setUploadSuccess('')
        loadResources()
      }, 1500)
    } catch (error) {
      console.error('Failed to upload files:', error)
      const errorMsg = error.response?.data?.error?.message || 
                       error.response?.data?.message || 
                       error.message || 
                       '上传失败，请重试'
      setUploadError(errorMsg)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const deleteResource = async (resourceId) => {
    if (!window.confirm('确定要删除这个资源吗？')) return

    try {
      await axios.delete(`/resources/${resourceId}/`)
      loadResources()
    } catch (error) {
      console.error('Failed to delete resource:', error)
    }
  }

  const createTranscriptionJob = async (resourceId) => {
    try {
      await axios.post('/jobs/', {
        media_id: resourceId,
        priority: 0,
        engine: 'whisper',
        engine_model: 'small',
        device: 'auto'
      })
      
      alert('转录任务已创建！请前往任务队列查看进度。')
      closeDetailModal()
    } catch (error) {
      console.error('Failed to create transcription job:', error)
      const errorMsg = error.response?.data?.error?.message || 
                       error.response?.data?.message || 
                       '创建任务失败，请重试'
      alert(errorMsg)
    }
  }

  const addTag = async (resourceId, tagName) => {
    if (!tagName.trim()) return
    try {
      await axios.post(`/resources/${resourceId}/tags/`, { name: tagName.trim() })
      setNewTag('')
      loadResources()
    } catch (error) {
      console.error('Failed to add tag:', error)
    }
  }

  const removeTag = async (resourceId, tagId) => {
    try {
      await axios.delete(`/resources/${resourceId}/tags/${tagId}/`)
      loadResources()
    } catch (error) {
      console.error('Failed to remove tag:', error)
    }
  }

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('audio/')) {
      return <FileAudio className="w-8 h-8 text-blue-600" />
    }
    if (fileType?.startsWith('video/')) {
      return <FileVideo className="w-8 h-8 text-purple-600" />
    }
    return <File className="w-8 h-8 text-gray-600" />
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '-'
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return `${hours}h ${remainingMinutes}m`
    }
    return `${minutes}m ${secs}s`
  }

  const openDetailModal = (resource) => {
    setSelectedResource(resource)
  }

  const closeDetailModal = () => {
    setSelectedResource(null)
    setNewTag('')
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
          <h1 className="text-3xl font-bold text-gray-900">资源管理</h1>
          <p className="mt-2 text-lg text-gray-600">上传、整理和标记媒体文件，为后续的转录和搜索做好准备。</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            type="button" 
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={loadResources}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            <span>刷新列表</span>
          </button>
          <button
            type="button"
            className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => setShowUploadModal(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            上传文件
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索文件名或标签..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === tab.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredResources.map((resource) => (
          <article key={resource.id} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <header className="p-6 border-b border-gray-200">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  {getFileIcon(resource.file_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{resource.filename}</h2>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(resource.file_size)} · {formatDuration(resource.duration)}
                  </p>
                </div>
              </div>
            </header>

            <div className="p-6">
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">上传时间</dt>
                  <dd className="text-sm text-gray-900">{new Date(resource.created_at).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500">状态</dt>
                  <dd className="text-sm text-gray-900">{resource.status === 'available' ? '可用' : resource.status}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-2">标签</dt>
                  <dd>
                    <div className="flex flex-wrap gap-2">
                      {resource.tags?.length ? (
                        resource.tags.map((tag) => (
                          <span key={tag.id} className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            <Tag className="w-3 h-3 mr-1" />
                            {tag.name}
                            <button
                              type="button"
                              className="ml-1 p-0.5 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-200"
                              onClick={() => removeTag(resource.id, tag.id)}
                              aria-label={`移除标签 ${tag.name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">暂无标签</span>
                      )}
                    </div>
                  </dd>
                </div>
              </dl>
            </div>

            <footer className="p-6 pt-0 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={() => openDetailModal(resource)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  详情
                </button>
                <button
                  type="button"
                  className="flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  onClick={() => deleteResource(resource.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  删除
                </button>
              </div>
              <button
                type="button"
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                onClick={() => downloadResource(resource.id, resource.filename)}
              >
                <Download className="w-4 h-4 mr-1" />
                下载
              </button>
            </footer>
          </article>
        ))}

        {!filteredResources.length && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无资源</h3>
            <p className="text-gray-500 max-w-md">
              {searchTerm || filter !== 'all'
                ? '没有找到匹配的资源，请调整搜索或筛选条件。'
                : '点击右上角的"上传文件"按钮，导入音视频以供转录使用。'}
            </p>
          </div>
        )}
      </div>

      {showUploadModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          role="presentation"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">上传新资源</h3>
                <p className="mt-1 text-sm text-gray-600">支持批量上传音频、视频文件，系统会自动识别格式和时长。</p>
              </div>
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                onClick={() => setShowUploadModal(false)}
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {uploadError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
                  <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {uploadSuccess}
                </div>
              )}
              <div
                className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors ${
                  uploading ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">点击或拖拽文件到这里上传</p>
                <p className="text-sm text-gray-600">支持音频、视频等多种媒体格式，单个文件最大 2GB。</p>
                {uploading && (
                  <div className="mt-4">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="audio/*,video/*"
                  className="hidden"
                  onChange={(event) => handleFileUpload(event.target.files)}
                  disabled={uploading}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                type="button"
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
              >
                取消
              </button>
              <button
                type="button"
                className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                选择文件
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedResource && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          role="presentation"
          onClick={closeDetailModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">资源详情</h3>
                <p className="mt-1 text-sm text-gray-600">查看文件属性、标签和处理状态，支持快速下载或删除。</p>
              </div>
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                onClick={closeDetailModal}
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <section>
                <h4 className="text-base font-semibold text-gray-900 mb-4">文件信息</h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">文件名</dt>
                    <dd className="mt-1 text-sm text-gray-900">{selectedResource.filename}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">文件大小</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatFileSize(selectedResource.file_size)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">时长</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDuration(selectedResource.duration)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">创建时间</dt>
                    <dd className="mt-1 text-sm text-gray-900">{new Date(selectedResource.created_at).toLocaleString()}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">状态</dt>
                    <dd className="mt-1 text-sm text-gray-900">{selectedResource.status || 'Unknown'}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h4 className="text-base font-semibold text-gray-900 mb-4">标签管理</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedResource.tags?.length ? (
                    selectedResource.tags.map((tag) => (
                      <span key={tag.id} className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag.name}
                        <button
                          type="button"
                          className="ml-1 p-0.5 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-200"
                          onClick={() => removeTag(selectedResource.id, tag.id)}
                          aria-label={`移除标签 ${tag.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">暂无标签</span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="输入标签名称后回车添加"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag(selectedResource.id, newTag)
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="flex items-center px-3 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    onClick={() => addTag(selectedResource.id, newTag)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    添加标签
                  </button>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <button
                type="button"
                className="flex items-center px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                onClick={() => deleteResource(selectedResource.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                删除资源
              </button>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  className="flex items-center px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  onClick={() => createTranscriptionJob(selectedResource.id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建转录任务
                </button>
                <button
                  type="button"
                  className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={() => downloadResource(selectedResource.id, selectedResource.filename)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  下载副本
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const downloadResource = async (resourceId, filename) => {
  try {
    const response = await axios.get(`/resources/${resourceId}/download/`, {
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename || `resource-${resourceId}`)
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    console.error('Failed to download resource:', error)
  }
}

export default Resources
