import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Folder,
  Activity
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const formatNumber = (value) => {
  if (value === null || value === undefined) return '0'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return '0'
  return numeric.toLocaleString()
}

const buildDisplayName = (user) => {
  if (!user) return '访客'
  if (user.first_name && user.first_name.trim()) {
    return user.first_name.trim()
  }
  if (user.username && user.username.trim()) {
    return user.username.trim()
  }
  if (user.email && user.email.includes('@')) {
    return user.email.split('@')[0]
  }
  return '用户'
}

function Dashboard() {
  const [stats, setStats] = useState({
    totalResources: 0,
    totalTranscripts: 0,
    pendingTasks: 0,
    completedTasks: 0,
    activeUsers: 0,
    recentActivity: []
  })
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const response = await axios.get('/dashboard/stats/')
      // Handle wrapped response {ok: true, data: {...}}
      const data = response.data?.data || response.data
      setStats(data)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      // Set default values on error
      setStats({
        totalResources: 0,
        totalTranscripts: 0,
        pendingTasks: 0,
        completedTasks: 0,
        activeUsers: 0,
        recentActivity: []
      })
    } finally {
      setLoading(false)
    }
  }

  const displayName = useMemo(() => buildDisplayName(user), [user])

  const metricCards = useMemo(
    () => [
      {
        title: '总资源数',
        value: formatNumber(stats.totalResources),
        icon: Folder,
        accent: 'is-blue',
        link: '/resources'
      },
      {
        title: '转录文档',
        value: formatNumber(stats.totalTranscripts),
        icon: FileText,
        accent: 'is-emerald',
        link: '/results'
      },
      {
        title: '待处理任务',
        value: formatNumber(stats.pendingTasks),
        icon: Clock,
        accent: 'is-amber',
        link: '/tasks'
      },
      {
        title: '已完成任务',
        value: formatNumber(stats.completedTasks),
        icon: CheckCircle,
        accent: 'is-green',
        link: '/tasks'
      }
    ],
    [stats.totalResources, stats.totalTranscripts, stats.pendingTasks, stats.completedTasks]
  )

  const quickActions = useMemo(
    () => [
      {
        title: '上传资源',
        description: '添加新的媒体文件并准备处理',
        to: '/resources',
        icon: Folder,
        accent: 'is-blue'
      },
      {
        title: '创建转录任务',
        description: '批量处理音视频并生成转录',
        to: '/tasks',
        icon: Clock,
        accent: 'is-amber'
      },
      {
        title: '查看转录结果',
        description: '编辑与导出已有的转录文本',
        to: '/results',
        icon: FileText,
        accent: 'is-emerald'
      }
    ],
    []
  )

  const taskHighlights = useMemo(
    () => [
      {
        label: '待处理任务',
        value: formatNumber(stats.pendingTasks),
        icon: AlertCircle,
        accent: 'is-warning'
      },
      {
        label: '已完成任务',
        value: formatNumber(stats.completedTasks),
        icon: CheckCircle,
        accent: 'is-success'
      },
      {
        label: '活跃用户',
        value: formatNumber(stats.activeUsers),
        icon: Users,
        accent: 'is-info'
      }
    ],
    [stats.pendingTasks, stats.completedTasks, stats.activeUsers]
  )

  if (loading) {
    return (
      <div className="dashboard-loading">
        <span className="spinner" />
      </div>
    )
  }

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div className="dashboard-hero-info">
          <div className="dashboard-hero-label">系统总览</div>
          <h1 className="dashboard-hero-title">欢迎回来，{displayName}</h1>
          <p className="dashboard-hero-desc">
            查看最新的任务进度、转录成果和团队活动。使用快捷操作能够快速完成日常流程。
          </p>
          <div className="dashboard-hero-highlight">
            <TrendingUp className="dashboard-hero-highlight-icon" />
            <div>
              <p className="dashboard-hero-highlight-title">今日概览</p>
              <p className="dashboard-hero-highlight-meta">
                {formatNumber(stats.completedTasks)} 个任务已完成，{formatNumber(stats.pendingTasks)} 个仍在排队中。
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-kpi-grid">
          {metricCards.map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.title} to={card.link} className={`dashboard-kpi ${card.accent}`}>
                <div className="dashboard-kpi-icon">
                  <Icon className="dashboard-kpi-icon-svg" />
                </div>
                <div className="dashboard-kpi-meta">
                  <span className="dashboard-kpi-label">{card.title}</span>
                  <span className="dashboard-kpi-value">{card.value}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-panel dashboard-panel--wide">
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">
              <Activity className="dashboard-panel-icon" /> 最近活动
            </h2>
            <Link to="/activity" className="dashboard-panel-link">
              查看全部
            </Link>
          </div>
          <div className="dashboard-panel-body">
            {stats.recentActivity && stats.recentActivity.length > 0 ? (
              <ul className="dashboard-activity-list">
                {stats.recentActivity.slice(0, 6).map((activity, index) => (
                  <li key={`${activity.timestamp}-${index}`} className="dashboard-activity-item">
                    <div className="dashboard-activity-marker" />
                    <div>
                      <p className="dashboard-activity-text">{activity.description}</p>
                      <p className="dashboard-activity-meta">{activity.timestamp}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="dashboard-empty">暂无最近活动</div>
            )}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">
              <Clock className="dashboard-panel-icon" /> 任务概览
            </h2>
          </div>
          <div className="dashboard-panel-body">
            <ul className="dashboard-highlight-list">
              {taskHighlights.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.label} className={`dashboard-highlight ${item.accent}`}>
                    <div className="dashboard-highlight-icon">
                      <Icon className="dashboard-highlight-icon-svg" />
                    </div>
                    <div>
                      <p className="dashboard-highlight-value">{item.value}</p>
                      <p className="dashboard-highlight-label">{item.label}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">
              <Users className="dashboard-panel-icon" /> 快速操作
            </h2>
          </div>
          <div className="dashboard-panel-body">
            <ul className="dashboard-action-list">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <li key={action.title}>
                    <Link to={action.to} className={`dashboard-action ${action.accent}`}>
                      <div className="dashboard-action-icon">
                        <Icon className="dashboard-action-icon-svg" />
                      </div>
                      <div>
                        <p className="dashboard-action-title">{action.title}</p>
                        <p className="dashboard-action-meta">{action.description}</p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
