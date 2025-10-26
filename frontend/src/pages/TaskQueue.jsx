import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
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
  const { user } = useAuth()
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
      0: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800',
      1: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'
    }
    const priorityText = {
      0: '普通',
      1: '高'
    }
    return (
      <span className={priorityMap[priority] || priorityMap[0]}>
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">转录任务队列</h1>
          <p className="text-gray-600">监控和管理转录任务，实时掌握处理进度。</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" onClick={loadJobs}>
            <RefreshCw className="w-4 h-4 mr-2" />
            <span>刷新</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            创建任务
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Worker Status Card */}
      <div className={`rounded-lg p-4 mb-6 flex items-center justify-between ${
        workerStatus.is_running 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            workerStatus.is_running ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {workerStatus.is_running ? (
              <Power className="h-5 w-5 text-white" />
            ) : (
              <PowerOff className="h-5 w-5 text-white" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              转录工作进程: {workerStatus.is_running ? '运行中' : '已停止'}
            </h3>
            <p className="text-sm text-gray-600">
              {workerStatus.is_running && workerStatus.pid && `PID: ${workerStatus.pid} | `}
              处理中: {workerStatus.processing_count} | 等待中: {workerStatus.pending_count}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {user?.is_admin && (
            <>
              {!workerStatus.is_running ? (
                <button
                  type="button"
                  onClick={() => controlWorker('start')}
                  disabled={workerLoading}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="h-4 w-4 mr-2" />
                  启动 Worker
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => controlWorker('restart')}
                    disabled={workerLoading}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCw className="h-4 w-4 mr-2" />
                    重启
                  </button>
                  <button
                    type="button"
                    onClick={() => controlWorker('stop')}
                    disabled={workerLoading}
                    className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PowerOff className="h-4 w-4 mr-2" />
                    停止
                  </button>
                </>
              )}
            </>
          )}
          {!user?.is_admin && (
            <div className="text-sm text-gray-500 px-3 py-2">
              只有管理员可以控制 Worker 进程
            </div>
          )}
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">资源文件</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">优先级</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">引擎/模型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建者</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      {getFileIcon(job.media?.media_type)}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {job.media?.filename || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {job.media?.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(job.status)}
                      <span className="ml-2 text-sm text-gray-900">{getStatusText(job.status)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getPriorityBadge(job.priority)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="text-gray-900">{job.engine || 'whisper'}</div>
                      <div className="text-gray-500">{job.engine_model || 'small'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.owner?.username || 'Unknown'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(job.created_at).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      {job.status === 'failed' && (user?.is_admin || job.owner?.username === user?.username) && (
                        <button
                          onClick={() => retryJob(job.id)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="重试"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}

                      {['pending', 'processing'].includes(job.status) && (user?.is_admin || job.owner?.username === user?.username) && (
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                          title="取消"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}

                      {job.error_message && (
                        <button
                          onClick={() => alert(job.error_message)}
                          className="text-yellow-600 hover:text-yellow-900 p-1 rounded"
                          title="查看错误"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </button>
                      )}
                      
                      {!user?.is_admin && job.owner?.username !== user?.username && ['pending', 'processing', 'failed'].includes(job.status) && (
                        <div className="text-xs text-gray-400 px-2 py-1">
                          仅创建者可操作
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredJobs.length === 0 && (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无任务</h3>
              <p className="text-gray-500 mb-2">
                开始创建您的第一个转录任务
              </p>
              <p className="text-sm text-gray-400">使用右上角的"创建任务"按钮或在资源管理页面中选择文件创建任务。</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Job Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
          role="presentation"
        >
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">创建转录任务</h3>
                <p className="text-sm text-gray-600">选择资源文件并配置转录参数，系统将自动排队处理。</p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
                onClick={() => setShowCreateModal(false)}
                aria-label="关闭"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="job-resource">选择资源文件 *</label>
                {loadingResources ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">加载资源列表...</p>
                  </div>
                ) : (
                  <select
                    id="job-resource"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                  如果没有找到文件，请先到"资源管理"页面上传文件。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="job-model">模型</label>
                  <select
                    id="job-model"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="job-device">设备</label>
                  <select
                    id="job-device"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={newJob.device}
                    onChange={(e) => setNewJob({ ...newJob, device: e.target.value })}
                  >
                    <option value="auto">自动检测</option>
                    <option value="cpu">CPU</option>
                    <option value="cuda">CUDA (GPU)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="job-priority">优先级</label>
                  <select
                    id="job-priority"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={newJob.priority}
                    onChange={(e) => setNewJob({ ...newJob, priority: parseInt(e.target.value) })}
                  >
                    <option value="0">普通</option>
                    <option value="1">高</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>提示：</strong>任务创建后需要启动 Worker 进程才会开始处理，请确保 Worker 已经运行。
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => setShowCreateModal(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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