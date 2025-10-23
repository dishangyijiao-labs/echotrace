import React, { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Pause,
  Play,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Settings,
  X
} from 'lucide-react'

const SCHEDULE_TYPE_OPTIONS = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' }
]

const WEEKDAY_OPTIONS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' }
]

const defaultForm = {
  name: '',
  description: '',
  schedule_type: 'daily',
  time: '09:00',
  days_of_week: [],
  is_active: true,
  settings: {
    language: 'zh-CN',
    model: 'whisper-large',
    auto_process: true
  }
}

function Scheduler() {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSchedule, setNewSchedule] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)

  const loadSchedules = useCallback(async () => {
    if (!user?.is_admin) return
    try {
      setLoading(true)
      const response = await axios.get('/schedules/')
      // Handle both wrapped and unwrapped responses
      const data = response.data?.data || response.data
      setSchedules(Array.isArray(data) ? data : data?.results || [])
    } catch (error) {
      console.error('Failed to load schedules:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.is_admin])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  const createSchedule = async () => {
    try {
      setSubmitting(true)
      await axios.post('/schedules/', newSchedule)
      setShowCreateModal(false)
      setNewSchedule(defaultForm)
      loadSchedules()
    } catch (error) {
      console.error('Failed to create schedule:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteSchedule = async (scheduleId) => {
    if (!window.confirm('确定要删除这个计划吗？')) return
    try {
      await axios.delete(`/schedules/${scheduleId}/`)
      loadSchedules()
    } catch (error) {
      console.error('Failed to delete schedule:', error)
    }
  }

  const toggleSchedule = async (scheduleId, isActive) => {
    try {
      await axios.patch(`/schedules/${scheduleId}/`, { is_active: !isActive })
      loadSchedules()
    } catch (error) {
      console.error('Failed to toggle schedule:', error)
      alert('切换计划状态失败，请重试')
    }
  }

  const handleDayToggle = (day) => {
    setNewSchedule((prev) => {
      const days = prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((item) => item !== day)
        : [...prev.days_of_week, day]
      return { ...prev, days_of_week: days }
    })
  }

  const getScheduleTypeLabel = (type) => {
    const target = SCHEDULE_TYPE_OPTIONS.find((item) => item.value === type)
    return target ? target.label : type
  }

  const getDaysLabel = (days) => {
    if (!days || !days.length) return '未选择'
    const labels = WEEKDAY_OPTIONS.reduce((acc, day) => {
      acc[day.value] = day.label
      return acc
    }, {})
    return days.map((day) => labels[day] || day).join('、')
  }

  const getToggleIcon = (isActive) => (
    isActive ? <Pause className="scheduler-row-button-icon" /> : <Play className="scheduler-row-button-icon" />
  )

  const getStatusBadge = (schedule) => {
    if (!schedule.is_active) {
      return { label: '已暂停', className: 'is-paused' }
    }

    const lastRun = schedule.last_run
    if (lastRun?.status === 'success') {
      return { label: '上次成功', className: 'is-success' }
    }
    if (lastRun?.status === 'failed') {
      return { label: '上次失败', className: 'is-failed' }
    }

    return { label: '活跃', className: 'is-active' }
  }

  const hasNoAccess = !user?.is_admin

  const schedulerRows = useMemo(() => schedules, [schedules])

  if (hasNoAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">访问受限</h3>
          <p className="text-gray-600">只有管理员可以访问调度器设置。</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-2">
          <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-3xl font-bold text-gray-900">调度器</h1>
            <p className="mt-2 text-gray-600">配置定时转录计划，按照设定时间自动处理待转录的媒体文件。</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              type="button" 
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={loadSchedules}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              <span>刷新列表</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              创建计划
            </button>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          {!schedulerRows.length ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无自动转录计划</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                创建计划后，系统将按照预设的时间和频率自动转录新上传的媒体文件。
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">计划名称</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">频率</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">执行参数</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最近运行</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {schedulerRows.map((schedule) => {
                    const status = getStatusBadge(schedule)
                    return (
                      <tr key={schedule.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{schedule.name}</div>
                            {schedule.description && (
                              <div className="text-sm text-gray-500">{schedule.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {getScheduleTypeLabel(schedule.schedule_type)}
                            </span>
                            {schedule.schedule_type === 'weekly' && (
                              <div className="text-xs text-gray-500 mt-1">{getDaysLabel(schedule.days_of_week)}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{schedule.time}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div>{schedule.settings?.language || 'zh-CN'}</div>
                            <div className="text-xs text-gray-500">{schedule.settings?.model || '默认模型'}</div>
                            <div className="text-xs text-gray-500">
                              自动执行：{schedule.settings?.auto_process ? '开启' : '关闭'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            status.className === 'is-success' ? 'bg-green-100 text-green-800' :
                            status.className === 'is-failed' ? 'bg-red-100 text-red-800' :
                            status.className === 'is-paused' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {schedule.last_run ? (
                            <div className="text-sm text-gray-900">
                              <div>{new Date(schedule.last_run.timestamp).toLocaleString()}</div>
                              <div className="text-xs text-gray-500">耗时 {schedule.last_run.duration ?? '-'} 秒</div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">尚未运行</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              onClick={() => toggleSchedule(schedule.id, schedule.is_active)}
                            >
                              {getToggleIcon(schedule.is_active)}
                              {schedule.is_active ? '暂停' : '恢复'}
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              onClick={() => deleteSchedule(schedule.id)}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          role="presentation"
          onClick={() => {
            setShowCreateModal(false)
            setNewSchedule(defaultForm)
          }}
        >
          <div
            className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 xl:w-2/5 shadow-lg rounded-md bg-white"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">创建新计划</h3>
                <p className="mt-1 text-sm text-gray-600">设定执行频率与参数，系统会在指定时间自动开始转录任务。</p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
                onClick={() => {
                  setShowCreateModal(false)
                  setNewSchedule(defaultForm)
                }}
                aria-label="关闭"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="schedule-name">计划名称</label>
                <input
                  id="schedule-name"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={newSchedule.name}
                  onChange={(event) => setNewSchedule((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="如：每日 9 点批量转录"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="schedule-description">描述</label>
                <textarea
                  id="schedule-description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  rows={3}
                  value={newSchedule.description}
                  onChange={(event) => setNewSchedule((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="补充计划目的、涉及文件范围等信息（可选）"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="schedule-type">执行频率</label>
                  <select
                    id="schedule-type"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={newSchedule.schedule_type}
                    onChange={(event) => setNewSchedule((prev) => ({
                      ...prev,
                      schedule_type: event.target.value,
                      days_of_week: event.target.value === 'weekly' ? prev.days_of_week : []
                    }))}
                  >
                    {SCHEDULE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="schedule-time">执行时间</label>
                  <input
                    id="schedule-time"
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={newSchedule.time}
                    onChange={(event) => setNewSchedule((prev) => ({ ...prev, time: event.target.value }))}
                  />
                </div>
              </div>

              {newSchedule.schedule_type === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">执行星期</label>
                  <div className="grid grid-cols-7 gap-2">
                    {WEEKDAY_OPTIONS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        className={`px-3 py-2 text-sm font-medium rounded-md border ${
                          newSchedule.days_of_week.includes(day.value)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                        onClick={() => handleDayToggle(day.value)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">执行参数</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={newSchedule.settings.language}
                    onChange={(event) => setNewSchedule((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, language: event.target.value }
                    }))}
                  >
                    <option value="zh-CN">中文</option>
                    <option value="en-US">英语</option>
                    <option value="ja-JP">日语</option>
                    <option value="ko-KR">韩语</option>
                  </select>

                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    value={newSchedule.settings.model}
                    onChange={(event) => setNewSchedule((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, model: event.target.value }
                   }))}
                  >
                    <option value="whisper-large">Whisper Large</option>
                    <option value="whisper-medium">Whisper Medium</option>
                    <option value="whisper-small">Whisper Small</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="auto-process"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={newSchedule.settings.auto_process}
                  onChange={(event) => setNewSchedule((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, auto_process: event.target.checked }
                  }))}
                />
                <label htmlFor="auto-process" className="ml-2 block text-sm text-gray-900">
                  自动处理上传的媒体文件
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-3 bg-gray-50 border-t border-gray-200 space-x-3">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                onClick={() => {
                  setShowCreateModal(false)
                  setNewSchedule(defaultForm)
                }}
                disabled={submitting}
              >
                取消
              </button>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={createSchedule}
                disabled={submitting || !newSchedule.name.trim()}
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    创建中...
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4 mr-2" />
                    创建计划
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default Scheduler
