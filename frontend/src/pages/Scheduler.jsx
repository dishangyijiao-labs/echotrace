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
      <div className="scheduler-locked">
        <AlertCircle className="scheduler-locked-icon" />
        <h3 className="scheduler-locked-title">访问受限</h3>
        <p className="scheduler-locked-text">只有管理员可以访问调度器设置。</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="scheduler-loading">
        <span className="spinner" />
      </div>
    )
  }

  return (
    <div className="scheduler-page">
      <div className="scheduler-header">
        <div>
          <h1 className="scheduler-title">调度器</h1>
          <p className="scheduler-subtitle">配置定时转录计划，按照设定时间自动处理待转录的媒体文件。</p>
        </div>
        <div className="scheduler-actions">
          <button type="button" className="scheduler-icon-button" onClick={loadSchedules}>
            <RefreshCw className="scheduler-icon-button-icon" />
            <span>刷新列表</span>
          </button>
          <button
            type="button"
            className="scheduler-primary-button"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="scheduler-primary-button-icon" />
            创建计划
          </button>
        </div>
      </div>

      <div className="scheduler-card">
        {!schedulerRows.length ? (
          <div className="scheduler-empty">
            <Calendar className="scheduler-empty-icon" />
            <h3 className="scheduler-empty-title">暂无自动转录计划</h3>
            <p className="scheduler-empty-text">
              创建计划后，系统将按照预设的时间和频率自动转录新上传的媒体文件。
            </p>
          </div>
        ) : (
          <div className="scheduler-table-wrapper">
            <table className="scheduler-table">
              <thead>
                <tr>
                  <th>计划名称</th>
                  <th>频率</th>
                  <th>时间</th>
                  <th>执行参数</th>
                  <th>状态</th>
                  <th>最近运行</th>
                  <th className="scheduler-table-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {schedulerRows.map((schedule) => {
                  const status = getStatusBadge(schedule)
                  return (
                    <tr key={schedule.id}>
                      <td>
                        <div className="scheduler-cell-main">
                          <span className="scheduler-cell-title">{schedule.name}</span>
                          {schedule.description && (
                            <p className="scheduler-cell-subtitle">{schedule.description}</p>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="scheduler-cell-stack">
                          <span>{getScheduleTypeLabel(schedule.schedule_type)}</span>
                          {schedule.schedule_type === 'weekly' && (
                            <span className="scheduler-cell-hint">{getDaysLabel(schedule.days_of_week)}</span>
                          )}
                        </div>
                      </td>
                      <td>{schedule.time}</td>
                      <td>
                        <div className="scheduler-cell-stack">
                          <span>{schedule.settings?.language || 'zh-CN'}</span>
                          <span className="scheduler-cell-hint">{schedule.settings?.model || '默认模型'}</span>
                          <span className="scheduler-cell-hint">
                            自动执行：{schedule.settings?.auto_process ? '开启' : '关闭'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`scheduler-status ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td>
                        {schedule.last_run ? (
                          <div className="scheduler-cell-stack">
                            <span>{new Date(schedule.last_run.timestamp).toLocaleString()}</span>
                            <span className="scheduler-cell-hint">耗时 {schedule.last_run.duration ?? '-'} 秒</span>
                          </div>
                        ) : (
                          <span className="scheduler-cell-hint">尚未运行</span>
                        )}
                      </td>
                      <td>
                        <div className="scheduler-row-actions">
                          <button
                            type="button"
                            className="scheduler-row-button"
                            onClick={() => toggleSchedule(schedule.id, schedule.is_active)}
                          >
                            {getToggleIcon(schedule.is_active)}
                            {schedule.is_active ? '暂停' : '恢复'}
                          </button>
                          <button
                            type="button"
                            className="scheduler-row-button is-danger"
                            onClick={() => deleteSchedule(schedule.id)}
                          >
                            <Trash2 className="scheduler-row-button-icon" />
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
          className="scheduler-modal-overlay"
          role="presentation"
          onClick={() => {
            setShowCreateModal(false)
            setNewSchedule(defaultForm)
          }}
        >
          <div
            className="scheduler-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="scheduler-modal-header">
              <div>
                <h3 className="scheduler-modal-title">创建新计划</h3>
                <p className="scheduler-modal-subtitle">设定执行频率与参数，系统会在指定时间自动开始转录任务。</p>
              </div>
              <button
                type="button"
                className="scheduler-modal-close"
                onClick={() => {
                  setShowCreateModal(false)
                  setNewSchedule(defaultForm)
                }}
                aria-label="关闭"
              >
                <X className="scheduler-modal-close-icon" />
              </button>
            </div>

            <div className="scheduler-modal-body">
              <div className="scheduler-field">
                <label className="scheduler-field-label" htmlFor="schedule-name">计划名称</label>
                <input
                  id="schedule-name"
                  type="text"
                  className="scheduler-field-input"
                  value={newSchedule.name}
                  onChange={(event) => setNewSchedule((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="如：每日 9 点批量转录"
                />
              </div>

              <div className="scheduler-field">
                <label className="scheduler-field-label" htmlFor="schedule-description">描述</label>
                <textarea
                  id="schedule-description"
                  className="scheduler-field-input scheduler-field-textarea"
                  rows={3}
                  value={newSchedule.description}
                  onChange={(event) => setNewSchedule((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="补充计划目的、涉及文件范围等信息（可选）"
                />
              </div>

              <div className="scheduler-form-grid">
                <div className="scheduler-field">
                  <label className="scheduler-field-label" htmlFor="schedule-type">执行频率</label>
                  <select
                    id="schedule-type"
                    className="scheduler-field-input"
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

                <div className="scheduler-field">
                  <label className="scheduler-field-label" htmlFor="schedule-time">执行时间</label>
                  <input
                    id="schedule-time"
                    type="time"
                    className="scheduler-field-input"
                    value={newSchedule.time}
                    onChange={(event) => setNewSchedule((prev) => ({ ...prev, time: event.target.value }))}
                  />
                </div>
              </div>

              {newSchedule.schedule_type === 'weekly' && (
                <div className="scheduler-field">
                  <label className="scheduler-field-label">执行星期</label>
                  <div className="scheduler-weekday-grid">
                    {WEEKDAY_OPTIONS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        className={`scheduler-weekday${newSchedule.days_of_week.includes(day.value) ? ' is-selected' : ''}`}
                        onClick={() => handleDayToggle(day.value)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="scheduler-field">
                <label className="scheduler-field-label">执行参数</label>
                <div className="scheduler-form-grid">
                  <select
                    className="scheduler-field-input"
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
                    className="scheduler-field-input"
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

              <label className="scheduler-toggle">
                <input
                  type="checkbox"
                  checked={newSchedule.settings.auto_process}
                  onChange={(event) => setNewSchedule((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, auto_process: event.target.checked }
                  }))}
                />
                <span>自动处理上传的媒体文件</span>
              </label>
            </div>

            <div className="scheduler-modal-footer">
              <button
                type="button"
                className="scheduler-secondary-button"
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
                className="scheduler-primary-button"
                onClick={createSchedule}
                disabled={submitting || !newSchedule.name.trim()}
              >
                {submitting ? (
                  <>
                    <span className="spinner-sm" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Settings className="scheduler-primary-button-icon" />
                    创建计划
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

export default Scheduler
