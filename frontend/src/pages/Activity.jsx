import React, { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import {
  Activity as ActivityIcon,
  Search,
  Calendar,
  User,
  FileText,
  Download,
  RefreshCw,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

const EVENT_TYPES = [
  { value: '', label: '全部事件' },
  { value: 'user_login', label: '用户登录' },
  { value: 'user_logout', label: '用户登出' },
  { value: 'user_created', label: '用户创建' },
  { value: 'user_updated', label: '用户更新' },
  { value: 'user_deleted', label: '用户删除' },
  { value: 'resource_uploaded', label: '资源上传' },
  { value: 'resource_deleted', label: '资源删除' },
  { value: 'task_created', label: '任务创建' },
  { value: 'task_updated', label: '任务更新' },
  { value: 'task_completed', label: '任务完成' },
  { value: 'task_failed', label: '任务失败' },
  { value: 'transcription_started', label: '转录开始' },
  { value: 'transcription_completed', label: '转录完成' },
  { value: 'transcription_failed', label: '转录失败' },
  { value: 'result_edited', label: '结果编辑' },
  { value: 'result_downloaded', label: '结果下载' },
  { value: 'schedule_created', label: '计划创建' },
  { value: 'schedule_updated', label: '计划更新' },
  { value: 'schedule_deleted', label: '计划删除' },
  { value: 'settings_updated', label: '设置更新' },
  { value: 'system_backup', label: '系统备份' },
  { value: 'system_restore', label: '系统恢复' }
]

const EVENTS_PER_PAGE = 20

function Activity() {
  const { user } = useAuth()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [expandedActivity, setExpandedActivity] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 })

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        ...(searchTerm && { search: searchTerm }),
        ...(actorFilter && { actor: actorFilter }),
        ...(eventTypeFilter && { event_type: eventTypeFilter }),
        ...(dateRange.start && { start_date: dateRange.start }),
        ...(dateRange.end && { end_date: dateRange.end })
      }

      const response = await axios.get('/activities/', { params })
      const payload = response.data

      setActivities(payload.results || payload)

      if (payload.count !== undefined) {
        setPagination((prev) => ({
          ...prev,
          totalCount: payload.count,
          totalPages: Math.ceil(payload.count / EVENTS_PER_PAGE)
        }))
      }
    } catch (error) {
      console.error('Failed to load activities:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, searchTerm, actorFilter, eventTypeFilter, dateRange])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const exportActivities = async () => {
    try {
      const params = {
        ...(searchTerm && { search: searchTerm }),
        ...(actorFilter && { actor: actorFilter }),
        ...(eventTypeFilter && { event_type: eventTypeFilter }),
        ...(dateRange.start && { start_date: dateRange.start }),
        ...(dateRange.end && { end_date: dateRange.end }),
        export: 'csv'
      }

      const response = await axios.get('/activities/export/', {
        params,
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `activity_log_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export activities:', error)
    }
  }

  const resetFilters = () => {
    setSearchTerm('')
    setActorFilter('')
    setEventTypeFilter('')
    setDateRange({ start: '', end: '' })
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const nonAdminView = !user?.is_admin

  const timelineItems = useMemo(() => activities, [activities])

  const getEventIcon = (eventType) => {
    if (eventType.includes('user')) return <User className="activity-event-icon is-user" />
    if (eventType.includes('resource')) return <FileText className="activity-event-icon is-resource" />
    if (eventType.includes('task') || eventType.includes('transcription')) return <ActivityIcon className="activity-event-icon is-task" />
    if (eventType.includes('schedule')) return <Calendar className="activity-event-icon is-schedule" />
    if (eventType.includes('system')) return <RefreshCw className="activity-event-icon is-system" />
    return <ActivityIcon className="activity-event-icon" />
  }

  const formatEventType = (eventType) => {
    const target = EVENT_TYPES.find((item) => item.value === eventType)
    return target ? target.label : eventType
  }

  const toggleDetails = (activityId) => {
    setExpandedActivity((current) => (current === activityId ? null : activityId))
  }

  if (nonAdminView) {
    return (
      <div className="activity-locked">
        <AlertCircle className="activity-locked-icon" />
        <h3 className="activity-locked-title">访问受限</h3>
        <p className="activity-locked-text">只有管理员可以查看系统活动日志。</p>
      </div>
    )
  }

  if (loading && !activities.length) {
    return (
      <div className="activity-loading">
        <span className="spinner" />
      </div>
    )
  }

  return (
    <div className="activity-page">
      <div className="activity-header">
        <div>
          <h1 className="activity-title">活动日志</h1>
          <p className="activity-subtitle">审计系统操作历史，支持按操作者、事件类型及时间范围过滤。</p>
        </div>
        <div className="activity-actions">
          <button type="button" className="activity-icon-button" onClick={resetFilters}>
            <RefreshCw className="activity-icon-button-icon" />
            <span>重置筛选</span>
          </button>
          <button type="button" className="activity-primary-button" onClick={exportActivities}>
            <Download className="activity-primary-button-icon" />
            导出日志
          </button>
        </div>
      </div>

      <div className="activity-filters">
        <div className="activity-search">
          <Search className="activity-search-icon" />
          <input
            type="text"
            placeholder="搜索描述或详细信息..."
            className="activity-search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="activity-filter-grid">
          <div className="activity-field">
            <label className="activity-field-label" htmlFor="activity-actor">操作者</label>
            <input
              id="activity-actor"
              type="text"
              className="activity-field-input"
              placeholder="用户名或邮箱"
              value={actorFilter}
              onChange={(event) => setActorFilter(event.target.value)}
            />
          </div>

          <div className="activity-field">
            <label className="activity-field-label" htmlFor="activity-type">事件类型</label>
            <select
              id="activity-type"
              className="activity-field-input"
              value={eventTypeFilter}
              onChange={(event) => setEventTypeFilter(event.target.value)}
            >
              {EVENT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="activity-field">
            <label className="activity-field-label" htmlFor="activity-start">开始日期</label>
            <input
              id="activity-start"
              type="date"
              className="activity-field-input"
              value={dateRange.start}
              onChange={(event) => setDateRange((prev) => ({ ...prev, start: event.target.value }))}
            />
          </div>

          <div className="activity-field">
            <label className="activity-field-label" htmlFor="activity-end">结束日期</label>
            <input
              id="activity-end"
              type="date"
              className="activity-field-input"
              value={dateRange.end}
              onChange={(event) => setDateRange((prev) => ({ ...prev, end: event.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="activity-card">
        {!timelineItems.length ? (
          <div className="activity-empty">
            <ActivityIcon className="activity-empty-icon" />
            <h3 className="activity-empty-title">暂无活动记录</h3>
            <p className="activity-empty-text">
              {searchTerm || actorFilter || eventTypeFilter || dateRange.start || dateRange.end
                ? '没有找到匹配的记录，请调整筛选条件。'
                : '当系统中发生操作时，这里会展示详细的审计记录。'}
            </p>
          </div>
        ) : (
          <ul className="activity-timeline">
            {timelineItems.map((activity) => (
              <li key={activity.id} className="activity-timeline-item">
                <div className="activity-timeline-marker" />
                <div className="activity-timeline-content">
                  <header className="activity-timeline-header">
                    <div className="activity-timeline-meta">
                      <span className="activity-event-type">{formatEventType(activity.event_type)}</span>
                      <span className="activity-event-actor">由 {activity.actor || '系统'}</span>
                    </div>
                    <span className="activity-event-time">{new Date(activity.timestamp).toLocaleString()}</span>
                  </header>

                  <div className="activity-event">
                    <div className="activity-event-icon-wrap">
                      {getEventIcon(activity.event_type)}
                    </div>
                    <div className="activity-event-body">
                      <p className="activity-event-description">{activity.description}</p>
                      <div className="activity-event-meta">
                        {activity.ip_address && <span>IP: {activity.ip_address}</span>}
                        {activity.user_agent && <span className="activity-event-ua">{activity.user_agent}</span>}
                      </div>
                    </div>
                    {activity.details && (
                      <button
                        type="button"
                        className="activity-event-toggle"
                        onClick={() => toggleDetails(activity.id)}
                      >
                        {expandedActivity === activity.id ? <ChevronUp /> : <ChevronDown />}
                      </button>
                    )}
                  </div>

                  {expandedActivity === activity.id && activity.details && (
                    <div className="activity-event-details">
                      <h4>详细信息</h4>
                      <pre>{JSON.stringify(activity.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {pagination.totalPages > 1 && (
          <div className="activity-pagination">
            <span className="activity-pagination-info">
              显示第 {((pagination.page - 1) * EVENTS_PER_PAGE) + 1} - {Math.min(pagination.page * EVENTS_PER_PAGE, pagination.totalCount)} 条，共 {pagination.totalCount} 条
            </span>
            <div className="activity-pagination-controls">
              <button
                type="button"
                className="activity-icon-button"
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
              >
                上一页
              </button>
              <span className="activity-pagination-page">第 {pagination.page} / {pagination.totalPages} 页</span>
              <button
                type="button"
                className="activity-icon-button"
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Activity
