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
    if (eventType.includes('user')) return <User className="w-5 h-5 text-blue-500" />
    if (eventType.includes('resource')) return <FileText className="w-5 h-5 text-green-500" />
    if (eventType.includes('task') || eventType.includes('transcription')) return <ActivityIcon className="w-5 h-5 text-purple-500" />
    if (eventType.includes('schedule')) return <Calendar className="w-5 h-5 text-orange-500" />
    if (eventType.includes('system')) return <RefreshCw className="w-5 h-5 text-gray-500" />
    return <ActivityIcon className="w-5 h-5 text-gray-400" />
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
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">访问受限</h3>
        <p className="text-gray-600">只有管理员可以查看系统活动日志。</p>
      </div>
    )
  }

  if (loading && !activities.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">活动日志</h1>
          <p className="text-gray-600">审计系统操作历史，支持按操作者、事件类型及时间范围过滤。</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" onClick={resetFilters}>
            <RefreshCw className="w-4 h-4 mr-2" />
            <span>重置筛选</span>
          </button>
          <button type="button" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" onClick={exportActivities}>
            <Download className="w-4 h-4 mr-2" />
            导出日志
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索描述或详细信息..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="activity-actor">操作者</label>
            <input
              id="activity-actor"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="用户名或邮箱"
              value={actorFilter}
              onChange={(event) => setActorFilter(event.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="activity-type">事件类型</label>
            <select
              id="activity-type"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="activity-start">开始日期</label>
            <input
              id="activity-start"
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={dateRange.start}
              onChange={(event) => setDateRange((prev) => ({ ...prev, start: event.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="activity-end">结束日期</label>
            <input
              id="activity-end"
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={dateRange.end}
              onChange={(event) => setDateRange((prev) => ({ ...prev, end: event.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {!timelineItems.length ? (
          <div className="text-center py-12">
            <ActivityIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无活动记录</h3>
            <p className="text-gray-500">
              {searchTerm || actorFilter || eventTypeFilter || dateRange.start || dateRange.end
                ? '没有找到匹配的记录，请调整筛选条件。'
                : '当系统中发生操作时，这里会展示详细的审计记录。'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {timelineItems.map((activity) => (
              <li key={activity.id} className="relative">
                <div className="absolute left-6 top-6 w-2 h-2 bg-blue-500 rounded-full" />
                <div className="pl-16 pr-6 py-6">
                  <header className="flex justify-between items-start mb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{formatEventType(activity.event_type)}</span>
                      <span className="text-sm text-gray-600">由 {activity.actor || '系统'}</span>
                    </div>
                    <span className="text-sm text-gray-500">{new Date(activity.timestamp).toLocaleString()}</span>
                  </header>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getEventIcon(activity.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 mb-2">{activity.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        {activity.ip_address && <span>IP: {activity.ip_address}</span>}
                        {activity.user_agent && <span className="truncate max-w-xs">{activity.user_agent}</span>}
                      </div>
                    </div>
                    {activity.details && (
                      <button
                        type="button"
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded"
                        onClick={() => toggleDetails(activity.id)}
                      >
                        {expandedActivity === activity.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  {expandedActivity === activity.id && activity.details && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">详细信息</h4>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(activity.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {pagination.totalPages > 1 && (
          <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-700">
              显示第 {((pagination.page - 1) * EVENTS_PER_PAGE) + 1} - {Math.min(pagination.page * EVENTS_PER_PAGE, pagination.totalCount)} 条，共 {pagination.totalCount} 条
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
              >
                上一页
              </button>
              <span className="text-sm text-gray-700">第 {pagination.page} / {pagination.totalPages} 页</span>
              <button
                type="button"
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
