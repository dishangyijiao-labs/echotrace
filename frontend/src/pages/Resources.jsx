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
      const response = await axios.post('/resources/upload/', formData, {
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
      const response = await axios.post('/jobs/', {
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
      return <FileAudio className="resources-card-icon" />
    }
    if (fileType?.startsWith('video/')) {
      return <FileVideo className="resources-card-icon" />
    }
    return <File className="resources-card-icon" />
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
      <div className="resources-loading">
        <span className="spinner" />
      </div>
    )
  }

  return (
    <div className="resources-page">
      <div className="resources-header">
        <div>
          <h1 className="resources-title">资源管理</h1>
          <p className="resources-subtitle">上传、整理和标记媒体文件，为后续的转录和搜索做好准备。</p>
        </div>
        <div className="resources-actions">
          <button type="button" className="resources-icon-button" onClick={loadResources}>
            <RefreshCw className="resources-icon-button-icon" />
            <span>刷新列表</span>
          </button>
          <button
            type="button"
            className="resources-primary-button"
            onClick={() => setShowUploadModal(true)}
          >
            <Upload className="resources-primary-button-icon" />
            上传文件
          </button>
        </div>
      </div>

      <div className="resources-toolbar">
        <div className="resources-search">
          <Search className="resources-search-icon" />
          <input
            type="text"
            placeholder="搜索文件名或标签..."
            className="resources-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="resources-tabs">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`resources-tab${filter === tab.key ? ' is-active' : ''}`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="resources-grid">
        {filteredResources.map((resource) => (
          <article key={resource.id} className="resources-card">
            <header className="resources-card-header">
              <div className="resources-card-icon-wrap">
                {getFileIcon(resource.file_type)}
              </div>
              <div>
                <h2 className="resources-card-title">{resource.filename}</h2>
                <p className="resources-card-meta">
                  {formatFileSize(resource.file_size)} · {formatDuration(resource.duration)}
                </p>
              </div>
            </header>

            <div className="resources-card-body">
              <dl className="resources-card-info">
                <div>
                  <dt>上传时间</dt>
                  <dd>{new Date(resource.created_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>状态</dt>
                  <dd>{resource.status === 'available' ? '可用' : resource.status}</dd>
                </div>
                <div>
                  <dt>标签</dt>
                  <dd>
                    <div className="resources-tags">
                      {resource.tags?.length ? (
                        resource.tags.map((tag) => (
                          <span key={tag.id} className="resources-tag">
                            <Tag className="resources-tag-icon" />
                            {tag.name}
                            <button
                              type="button"
                              className="resources-tag-remove"
                              onClick={() => removeTag(resource.id, tag.id)}
                              aria-label={`移除标签 ${tag.name}`}
                            >
                              <X className="resources-tag-remove-icon" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="resources-tag-empty">暂无标签</span>
                      )}
                    </div>
                  </dd>
                </div>
              </dl>
            </div>

            <footer className="resources-card-footer">
              <div className="resources-card-actions">
                <button
                  type="button"
                  className="resources-card-button is-primary"
                  onClick={() => openDetailModal(resource)}
                >
                  <Eye className="resources-card-button-icon" />
                  详情
                </button>
                <button
                  type="button"
                  className="resources-card-button"
                  onClick={() => deleteResource(resource.id)}
                >
                  <Trash2 className="resources-card-button-icon" />
                  删除
                </button>
              </div>
              <button
                type="button"
                className="resources-card-button"
                onClick={() => downloadResource(resource.id, resource.filename)}
              >
                <Download className="resources-card-button-icon" />
                下载
              </button>
            </footer>
          </article>
        ))}

        {!filteredResources.length && (
          <div className="resources-empty">
            <Upload className="resources-empty-icon" />
            <h3 className="resources-empty-title">暂无资源</h3>
            <p className="resources-empty-text">
              {searchTerm || filter !== 'all'
                ? '没有找到匹配的资源，请调整搜索或筛选条件。'
                : '点击右上角的“上传文件”按钮，导入音视频以供转录使用。'}
            </p>
          </div>
        )}
      </div>

      {showUploadModal && (
        <div
          className="resources-modal-overlay"
          role="presentation"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="resources-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="resources-modal-header">
              <div>
                <h3 className="resources-modal-title">上传新资源</h3>
                <p className="resources-modal-subtitle">支持批量上传音频、视频文件，系统会自动识别格式和时长。</p>
              </div>
              <button
                type="button"
                className="resources-modal-close"
                onClick={() => setShowUploadModal(false)}
                aria-label="关闭"
              >
                <X className="resources-modal-close-icon" />
              </button>
            </div>

            <div className="resources-modal-body">
              {uploadError && (
                <div className="alert alert-error" style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '0.5rem', color: '#c00' }}>
                  <AlertCircle style={{ display: 'inline-block', width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="alert alert-success" style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#efe', border: '1px solid #cfc', borderRadius: '0.5rem', color: '#090' }}>
                  <CheckCircle style={{ display: 'inline-block', width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                  {uploadSuccess}
                </div>
              )}
              <div
                className={`resources-dropzone${uploading ? ' is-uploading' : ''}`}
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}
              >
                <Upload className="resources-dropzone-icon" />
                <p className="resources-dropzone-title">点击或拖拽文件到这里上传</p>
                <p className="resources-dropzone-text">支持音频、视频等多种媒体格式，单个文件最大 2GB。</p>
                {uploading && <span className="spinner" />}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="audio/*,video/*"
                  className="resources-file-input"
                  onChange={(event) => handleFileUpload(event.target.files)}
                  disabled={uploading}
                />
              </div>
            </div>

            <div className="resources-modal-footer">
              <button
                type="button"
                className="resources-secondary-button"
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
              >
                取消
              </button>
              <button
                type="button"
                className="resources-primary-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="resources-primary-button-icon" />
                选择文件
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedResource && (
        <div
          className="resources-modal-overlay"
          role="presentation"
          onClick={closeDetailModal}
        >
          <div
            className="resources-detail-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="resources-modal-header">
              <div>
                <h3 className="resources-modal-title">资源详情</h3>
                <p className="resources-modal-subtitle">查看文件属性、标签和处理状态，支持快速下载或删除。</p>
              </div>
              <button
                type="button"
                className="resources-modal-close"
                onClick={closeDetailModal}
                aria-label="关闭"
              >
                <X className="resources-modal-close-icon" />
              </button>
            </div>

            <div className="resources-detail-body">
              <section className="resources-detail-section">
                <h4>文件信息</h4>
                <dl>
                  <div>
                    <dt>文件名</dt>
                    <dd>{selectedResource.filename}</dd>
                  </div>
                  <div>
                    <dt>文件大小</dt>
                    <dd>{formatFileSize(selectedResource.file_size)}</dd>
                  </div>
                  <div>
                    <dt>时长</dt>
                    <dd>{formatDuration(selectedResource.duration)}</dd>
                  </div>
                  <div>
                    <dt>创建时间</dt>
                    <dd>{new Date(selectedResource.created_at).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>状态</dt>
                    <dd>{selectedResource.status || 'Unknown'}</dd>
                  </div>
                </dl>
              </section>

              <section className="resources-detail-section">
                <h4>标签管理</h4>
                <div className="resources-tags">
                  {selectedResource.tags?.length ? (
                    selectedResource.tags.map((tag) => (
                      <span key={tag.id} className="resources-tag">
                        <Tag className="resources-tag-icon" />
                        {tag.name}
                        <button
                          type="button"
                          className="resources-tag-remove"
                          onClick={() => removeTag(selectedResource.id, tag.id)}
                          aria-label={`移除标签 ${tag.name}`}
                        >
                          <X className="resources-tag-remove-icon" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="resources-tag-empty">暂无标签</span>
                  )}
                </div>
                <div className="resources-tag-input">
                  <input
                    type="text"
                    className="resources-search-input"
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
                    className="resources-icon-button"
                    onClick={() => addTag(selectedResource.id, newTag)}
                  >
                    <Plus className="resources-icon-button-icon" />
                    添加标签
                  </button>
                </div>
              </section>
            </div>

            <div className="resources-modal-footer">
              <button
                type="button"
                className="resources-secondary-button"
                onClick={() => deleteResource(selectedResource.id)}
              >
                <Trash2 className="resources-primary-button-icon" />
                删除资源
              </button>
              <button
                type="button"
                className="resources-primary-button"
                onClick={() => createTranscriptionJob(selectedResource.id)}
                style={{ marginLeft: '0.5rem' }}
              >
                <Plus className="resources-primary-button-icon" />
                创建转录任务
              </button>
              <button
                type="button"
                className="resources-primary-button"
                onClick={() => downloadResource(selectedResource.id, selectedResource.filename)}
              >
                <Download className="resources-primary-button-icon" />
                下载副本
              </button>
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
