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
  Pause,
  Trash2,
  Eye,
  RefreshCw
} from 'lucide-react'

function TaskQueue() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTask, setNewTask] = useState({
    name: '',
    description: '',
    resources: [],
    settings: {
      language: 'zh-CN',
      model: 'whisper-large',
      priority: 'normal'
    }
  })

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true)
      const params = filter !== 'all' ? { status: filter } : {}
      const response = await axios.get('/api/tasks/', { params })
      setTasks(response.data)
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const createTask = async () => {
    try {
      await axios.post('/api/tasks/', newTask)
      setShowCreateModal(false)
      setNewTask({
        name: '',
        description: '',
        resources: [],
        settings: {
          language: 'zh-CN',
          model: 'whisper-large',
          priority: 'normal'
        }
      })
      loadTasks()
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  const updateTaskStatus = async (taskId, action) => {
    try {
      await axios.post(`/api/tasks/${taskId}/${action}/`)
      loadTasks()
    } catch (error) {
      console.error(`Failed to ${action} task:`, error)
    }
  }

  const deleteTask = async (taskId) => {
    if (window.confirm('确定要删除这个任务吗？')) {
      try {
        await axios.delete(`/api/tasks/${taskId}/`)
        loadTasks()
      } catch (error) {
        console.error('Failed to delete task:', error)
      }
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'running':
        return <Play className="h-4 w-4 text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'paused':
        return <Pause className="h-4 w-4 text-gray-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusText = (status) => {
    const statusMap = {
      pending: '等待中',
      running: '运行中',
      completed: '已完成',
      failed: '失败',
      paused: '已暂停'
    }
    return statusMap[status] || status
  }

  const getPriorityBadge = (priority) => {
    const priorityMap = {
      low: 'badge-gray',
      normal: 'badge-blue',
      high: 'badge-yellow',
      urgent: 'badge-red'
    }
    const priorityText = {
      low: '低',
      normal: '普通',
      high: '高',
      urgent: '紧急'
    }
    return (
      <span className={`badge ${priorityMap[priority]}`}>
        {priorityText[priority]}
      </span>
    )
  }

  const statusTabs = [
    { key: 'all', label: '全部', icon: RefreshCw },
    { key: 'pending', label: '等待中', icon: Clock },
    { key: 'running', label: '运行中', icon: Play },
    { key: 'completed', label: '已完成', icon: CheckCircle },
    { key: 'failed', label: '失败', icon: XCircle },
    { key: 'paused', label: '已暂停', icon: Pause }
  ]

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true
    return task.status === filter
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
          <h1 className="task-title">任务队列</h1>
          <p className="task-subtitle">监控和管理批量转录任务，实时掌握处理进度。</p>
        </div>
        <div className="task-header-actions">
          <button type="button" className="task-icon-button" onClick={loadTasks}>
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

      {/* Tasks Table */}
      <div className="task-card">
        <div className="overflow-x-auto">
          <table className="task-table">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>状态</th>
                <th>优先级</th>
                <th>进度</th>
                <th>创建者</th>
                <th>创建时间</th>
                <th>关联资源</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div>
                      <div className="font-medium text-gray-900">{task.name}</div>
                      {task.description && (
                        <div className="text-sm text-gray-500">{task.description}</div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="task-status">
                      {getStatusIcon(task.status)}
                      <span className="ml-2">{getStatusText(task.status)}</span>
                    </div>
                  </td>
                  <td>{getPriorityBadge(task.priority)}</td>
                  <td>
                    <div className="task-progress">
                      <div
                        className="task-progress-bar"
                        style={{ width: `${task.progress || 0}%` }}
                      ></div>
                    </div>
                    <div className="task-progress-meta">
                      {task.progress || 0}%
                    </div>
                  </td>
                  <td>{task.created_by?.username || 'Unknown'}</td>
                  <td>{new Date(task.created_at).toLocaleString()}</td>
                  <td>
                    {task.resource_count > 0 ? (
                      <Link
                        to={`/resources?task=${task.id}`}
                        className="text-emerald-600 hover:text-emerald-500"
                      >
                        {task.resource_count} 个文件
                      </Link>
                    ) : (
                      <span className="text-gray-400">无</span>
                    )}
                  </td>
                  <td>
                    <div className="flex space-x-2">
                      <Link
                        to={`/tasks/${task.id}`}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>

                      {task.status === 'pending' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'start')}
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      )}

                      {task.status === 'running' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'pause')}
                          className="text-yellow-400 hover:text-yellow-600"
                        >
                          <Pause className="h-4 w-4" />
                        </button>
                      )}

                      {task.status === 'paused' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'resume')}
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      )}

                      {['pending', 'paused', 'failed'].includes(task.status) && (
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTasks.length === 0 && (
            <div className="task-empty">
              <Clock className="task-empty-icon" />
              <h3 className="task-empty-title">暂无任务</h3>
              <p className="task-empty-text">
                开始创建您的第一个转录任务
              </p>
              <p className="task-empty-note">使用右上角的“创建任务”按钮开始新的转录任务。</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
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
                <h3 className="task-modal-title">创建新任务</h3>
                <p className="task-modal-subtitle">配置任务参数并提交后，系统将自动排队处理。</p>
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
                <label className="task-field-label" htmlFor="task-name">任务名称</label>
                <input
                  id="task-name"
                  type="text"
                  className="task-field-input"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  placeholder="如：会议录音批量转录"
                />
              </div>

              <div className="task-field">
                <label className="task-field-label" htmlFor="task-description">描述</label>
                <textarea
                  id="task-description"
                  className="task-field-input task-field-textarea"
                  rows={3}
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="补充任务背景信息，帮助团队理解此任务目标（可选）"
                />
              </div>

              <div className="task-form-grid">
                <div className="task-field">
                  <label className="task-field-label" htmlFor="task-language">语言</label>
                  <select
                    id="task-language"
                    className="task-field-input"
                    value={newTask.settings.language}
                    onChange={(e) => setNewTask({
                      ...newTask,
                      settings: { ...newTask.settings, language: e.target.value }
                    })}
                  >
                    <option value="zh-CN">中文</option>
                    <option value="en-US">英语</option>
                    <option value="ja-JP">日语</option>
                    <option value="ko-KR">韩语</option>
                  </select>
                </div>

                <div className="task-field">
                  <label className="task-field-label" htmlFor="task-model">模型</label>
                  <select
                    id="task-model"
                    className="task-field-input"
                    value={newTask.settings.model}
                    onChange={(e) => setNewTask({
                      ...newTask,
                      settings: { ...newTask.settings, model: e.target.value }
                    })}
                  >
                    <option value="whisper-large">Whisper Large</option>
                    <option value="whisper-medium">Whisper Medium</option>
                    <option value="whisper-small">Whisper Small</option>
                  </select>
                </div>

                <div className="task-field">
                  <label className="task-field-label" htmlFor="task-priority">优先级</label>
                  <select
                    id="task-priority"
                    className="task-field-input"
                    value={newTask.settings.priority}
                    onChange={(e) => setNewTask({
                      ...newTask,
                      settings: { ...newTask.settings, priority: e.target.value }
                    })}
                  >
                    <option value="low">低</option>
                    <option value="normal">普通</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                  </select>
                </div>

                <div className="task-field">
                  <label className="task-field-label" htmlFor="task-resources">资源 ID 列表</label>
                  <textarea
                    id="task-resources"
                    className="task-field-input task-field-textarea"
                    rows={3}
                    value={newTask.resources.join('\n')}
                    onChange={(e) => setNewTask({
                      ...newTask,
                      resources: e.target.value
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                    })}
                    placeholder="可选：一行一个资源 ID，用于指定要处理的文件"
                  />
                </div>
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
                onClick={createTask}
                disabled={!newTask.name.trim()}
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