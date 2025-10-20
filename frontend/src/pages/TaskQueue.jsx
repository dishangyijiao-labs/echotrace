import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Trash2,
  Eye,
  RefreshCw,
  FileAudio,
  FileVideo,
  File,
  Power,
  PowerOff,
  RotateCw
} from 'lucide-react'

function TaskQueue() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [resources, setResources] = useState([])
  const [loadingResources, setLoadingResources] = useState(false)
  const [workerStatus, setWorkerStatus] = useState({
    is_running: false,
    pid: null,
    processing_count: 0,
    pending_count: 0
  })
  const [workerLoading, setWorkerLoading] = useState(false)
  const [newJob, setNewJob] = useState({
    media_id: '',
    priority: 0,
    engine: 'whisper',
    engine_model: 'small',
    device: 'cpu'
  })

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true)
      const params = filter !== 'all' ? { status: filter } : {}
      const response = await axios.get('/jobs/', { params })
      const data = response.data?.data || response.data
      setJobs(Array.isArray(data) ? data : data?.results || [])
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
    }
  }, [filter])

  const loadResources = async () => {
    try {
      setLoadingResources(true)
      const response = await axios.get('/resources/')
      const data = response.data?.data || response.data
      setResources(Array.isArray(data) ? data : data?.results || [])
    } catch (error) {
      console.error('Failed to load resources:', error)
    } finally {
      setLoadingResources(false)
    }
  }

  const loadWorkerStatus = useCallback(async () => {
    try {
      const response = await axios.get('/jobs/worker/status')
      const data = response.data?.data || response.data
      setWorkerStatus(data)
    } catch (error) {
      console.error('Failed to load worker status:', error)
    }
  }, [])

  const controlWorker = async (action) => {
    try {
      setWorkerLoading(true)
      const response = await axios.post('/jobs/worker/control', {
        action,
        interval: 5
      })
      if (response.data?.ok) {
        alert(`Worker ${action === 'start' ? '已启动' : action === 'stop' ? '已停止' : '已重启'}`)
        loadWorkerStatus()
        loadJobs()
      } else {
        alert(response.data?.error?.message || `Failed to ${action} worker`)
      }
    } catch (error) {
      console.error(`Failed to ${action} worker:`, error)
      const errorMsg = error.response?.data?.error?.message || `操作失败`
      alert(errorMsg)
    } finally {
      setWorkerLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
    loadWorkerStatus()

    // Auto-refresh worker status every 10 seconds
    const interval = setInterval(() => {
      loadWorkerStatus()
    }, 10000)

    return () => clearInterval(interval)
  }, [loadJobs, loadWorkerStatus])

  useEffect(() => {
    if (showCreateModal) {
      loadResources()
    }
  }, [showCreateModal])

  const createJob = async () => {
    try {
      if (!newJob.media_id) {
        alert('请选择资源文件')
        return
      }
      await axios.post('/jobs/', newJob)
      setShowCreateModal(false)
      setNewJob({
        media_id: '',
        priority: 0,
        engine: 'whisper',
        engine_model: 'small',
        device: 'cpu'
      })
      loadJobs()
      alert('转录任务已创建！')
    } catch (error) {
      console.error('Failed to create job:', error)
      const errorMsg = error.response?.data?.error?.message || 
                       error.response?.data?.message || 
                       '创建任务失败'
      alert(errorMsg)
    }
  }

  const retryJob = async (jobId) => {
    try {
      await axios.post(`/jobs/${jobId}/retry`)
      loadJobs()
      alert('任务已重新创建')
    } catch (error) {
      console.error('Failed to retry job:', error)
      alert('重试失败')
    }
  }

  const cancelJob = async (jobId) => {
    try {
      await axios.post(`/jobs/${jobId}/cancel`)
      loadJobs()
      alert('任务已取消')
    } catch (error) {
      console.error('Failed to cancel job:', error)
      alert('取消失败')
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'processing':
        return <Play className="h-4 w-4 text-blue-500" />
      case 'succeeded':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'canceled':
        return <AlertCircle className="h-4 w-4 text-gray-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusText = (status) => {
    const statusMap = {
      pending: '等待中',
      processing: '处理中',
      succeeded: '已完成',
      failed: '失败',
      canceled: '已取消'
    }
    return statusMap[status] || status
  }

  const getPriorityBadge = (priority) => {
    const priorityMap = {
      0: 'badge-blue',
      1: 'badge-yellow'
    }
    const priorityText = {
      0: '普通',
      1: '高'
    }
    return (
      <span className={`badge ${priorityMap[priority] || 'badge-blue'}`}>
        {priorityText[priority] || '普通'}
      </span>
    )
  }

  const getFileIcon = (mediaType) => {
    if (mediaType === 'audio') {
      return <FileAudio className="h-4 w-4 text-blue-500" />
    }
    if (mediaType === 'video') {
      return <FileVideo className="h-4 w-4 text-purple-500" />
    }
    return <File className="h-4 w-4 text-gray-500" />
  }

  const statusTabs = [
    { key: 'all', label: '全部', icon: RefreshCw },
    { key: 'pending', label: '等待中', icon: Clock },
    { key: 'processing', label: '处理中', icon: Play },
    { key: 'succeeded', label: '已完成', icon: CheckCircle },
    { key: 'failed', label: '失败', icon: XCircle },
    { key: 'canceled', label: '已取消', icon: AlertCircle }
  ]

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true
    return job.status === filter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="task-page">
      <div className="task-header">
        <div>
          <h1 className="task-title">转录任务队列</h1>
          <p className="task-subtitle">监控和管理转录任务，实时掌握处理进度。</p>
        </div>
        <div className="task-header-actions">
          <button type="button" className="task-icon-button" onClick={loadJobs}>
            <RefreshCw className="task-icon-button-icon" />
            <span>刷新</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="task-primary-button"
          >
            <Plus className="task-primary-button-icon" />
            创建任务
          </button>
        </div>
      </div>

      <div className="task-toolbar">
        <div className="task-tabs">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`task-tab${filter === tab.key ? ' is-active' : ''}`}
            >
              <tab.icon className="task-tab-icon" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Worker Status Card */}
      <div className="task-worker-status" style={{
        background: workerStatus.is_running ? '#f0fdf4' : '#fef2f2',
        border: `1px solid ${workerStatus.is_running ? '#86efac' : '#fecaca'}`,
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: workerStatus.is_running ? '#22c55e' : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {workerStatus.is_running ? (
              <Power className="h-5 w-5 text-white" />
            ) : (
              <PowerOff className="h-5 w-5 text-white" />
            )}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
              转录工作进程: {workerStatus.is_running ? '运行中' : '已停止'}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              {workerStatus.is_running && workerStatus.pid && `PID: ${workerStatus.pid} | `}
              处理中: {workerStatus.processing_count} | 等待中: {workerStatus.pending_count}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!workerStatus.is_running ? (
            <button
              type="button"
              onClick={() => controlWorker('start')}
              disabled={workerLoading}
              className="task-primary-button"
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              <Play className="h-4 w-4" style={{ marginRight: '0.5rem' }} />
              启动 Worker
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => controlWorker('restart')}
                disabled={workerLoading}
                className="task-icon-button"
                style={{ fontSize: '0.875rem' }}
              >
                <RotateCw className="h-4 w-4" style={{ marginRight: '0.5rem' }} />
                重启
              </button>
              <button
                type="button"
                onClick={() => controlWorker('stop')}
                disabled={workerLoading}
                style={{
                  fontSize: '0.875rem',
                  padding: '0.5rem 1rem',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <PowerOff className="h-4 w-4" style={{ marginRight: '0.5rem' }} />
                停止
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tasks Table */}
      <div className="task-card">
        <div className="overflow-x-auto">
          <table className="task-table">
            <thead>
              <tr>
                <th>资源文件</th>
                <th>状态</th>
                <th>优先级</th>
                <th>引擎/模型</th>
                <th>创建者</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <div className="flex items-center space-x-2">
                      {getFileIcon(job.media?.media_type)}
                      <div>
                        <div className="font-medium text-gray-900">
                          {job.media?.filename || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {job.media?.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="task-status">
                      {getStatusIcon(job.status)}
                      <span className="ml-2">{getStatusText(job.status)}</span>
                    </div>
                  </td>
                  <td>{getPriorityBadge(job.priority)}</td>
                  <td>
                    <div className="text-sm">
                      <div>{job.engine || 'whisper'}</div>
                      <div className="text-gray-500">{job.engine_model || 'small'}</div>
                    </div>
                  </td>
                  <td>{job.owner?.username || 'Unknown'}</td>
                  <td>{new Date(job.created_at).toLocaleString()}</td>
                  <td>
                    <div className="flex space-x-2">
                      {job.status === 'failed' && (
                        <button
                          onClick={() => retryJob(job.id)}
                          className="text-blue-400 hover:text-blue-600"
                          title="重试"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}

                      {['pending', 'processing'].includes(job.status) && (
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="text-red-400 hover:text-red-600"
                          title="取消"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}

                      {job.error_message && (
                        <button
                          onClick={() => alert(job.error_message)}
                          className="text-yellow-400 hover:text-yellow-600"
                          title="查看错误"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredJobs.length === 0 && (
            <div className="task-empty">
              <Clock className="task-empty-icon" />
              <h3 className="task-empty-title">暂无任务</h3>
              <p className="task-empty-text">
                开始创建您的第一个转录任务
              </p>
              <p className="task-empty-note">使用右上角的“创建任务”按钮或在资源管理页面中选择文件创建任务。</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Job Modal */}
      {showCreateModal && (
        <div
          className="task-modal-overlay"
          onClick={() => setShowCreateModal(false)}
          role="presentation"
        >
          <div
            className="task-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="task-modal-header">
              <div>
                <h3 className="task-modal-title">创建转录任务</h3>
                <p className="task-modal-subtitle">选择资源文件并配置转录参数，系统将自动排队处理。</p>
              </div>
              <button
                type="button"
                className="task-modal-close"
                onClick={() => setShowCreateModal(false)}
                aria-label="关闭"
              >
                <XCircle className="task-modal-close-icon" />
              </button>
            </div>

            <div className="task-modal-body">
              <div className="task-field">
                <label className="task-field-label" htmlFor="job-resource">选择资源文件 *</label>
                {loadingResources ? (
                  <div className="text-center py-4">
                    <span className="spinner" />
                    <p className="text-sm text-gray-500 mt-2">加载资源列表...</p>
                  </div>
                ) : (
                  <select
                    id="job-resource"
                    className="task-field-input"
                    value={newJob.media_id}
                    onChange={(e) => setNewJob({ ...newJob, media_id: parseInt(e.target.value) })}
                  >
                    <option value="">请选择资源文件</option>
                    {resources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        [{resource.media_type}] {resource.filename} (ID: {resource.id})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  如果没有找到文件，请先到“资源管理”页面上传文件。
                </p>
              </div>

              <div className="task-form-grid">
                <div className="task-field">
                  <label className="task-field-label" htmlFor="job-model">模型</label>
                  <select
                    id="job-model"
                    className="task-field-input"
                    value={newJob.engine_model}
                    onChange={(e) => setNewJob({ ...newJob, engine_model: e.target.value })}
                  >
                    <option value="tiny">Tiny (最快，较低精度)</option>
                    <option value="base">Base (快，一般精度)</option>
                    <option value="small">Small (推荐，均衡)</option>
                    <option value="medium">Medium (慢，高精度)</option>
                    <option value="large">Large (最慢，最高精度)</option>
                  </select>
                </div>

                <div className="task-field">
                  <label className="task-field-label" htmlFor="job-device">设备</label>
                  <select
                    id="job-device"
                    className="task-field-input"
                    value={newJob.device}
                    onChange={(e) => setNewJob({ ...newJob, device: e.target.value })}
                  >
                    <option value="auto">自动检测</option>
                    <option value="cpu">CPU</option>
                    <option value="cuda">CUDA (GPU)</option>
                  </select>
                </div>

                <div className="task-field">
                  <label className="task-field-label" htmlFor="job-priority">优先级</label>
                  <select
                    id="job-priority"
                    className="task-field-input"
                    value={newJob.priority}
                    onChange={(e) => setNewJob({ ...newJob, priority: parseInt(e.target.value) })}
                  >
                    <option value="0">普通</option>
                    <option value="1">高</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
                <p className="text-sm text-blue-800">
                  <strong>提示：</strong>任务创建后需要启动 Worker 进程才会开始处理，请确保 Worker 已经运行。
                </p>
              </div>
            </div>

            <div className="task-modal-footer">
              <button
                type="button"
                className="task-secondary-button"
                onClick={() => setShowCreateModal(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="task-primary-button"
                onClick={createJob}
                disabled={!newJob.media_id}
              >
                创建任务
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskQueue