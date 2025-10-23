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
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <section className="space-y-6">
        <div className="space-y-6">
          <div className="text-sm font-medium text-blue-600 uppercase tracking-wide">系统总览</div>
          <h1 className="text-3xl font-bold text-gray-900">欢迎回来，{displayName}</h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            查看最新的任务进度、转录成果和团队活动。使用快捷操作能够快速完成日常流程。
          </p>
          <div className="flex items-start space-x-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <TrendingUp className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-900">今日概览</p>
              <p className="text-blue-700">
                {formatNumber(stats.completedTasks)} 个任务已完成，{formatNumber(stats.pendingTasks)} 个仍在排队中。
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metricCards.map((card) => {
            const Icon = card.icon
            const colorClasses = {
              'is-blue': 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-900',
              'is-emerald': 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-900',
              'is-amber': 'bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-900',
              'is-green': 'bg-green-50 border-green-200 hover:bg-green-100 text-green-900'
            }
            const iconColorClasses = {
              'is-blue': 'text-blue-600',
              'is-emerald': 'text-emerald-600',
              'is-amber': 'text-amber-600',
              'is-green': 'text-green-600'
            }
            return (
              <Link 
                key={card.title} 
                to={card.link} 
                className={`block p-6 rounded-lg border-2 transition-colors duration-200 ${colorClasses[card.accent]}`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-lg bg-white ${iconColorClasses[card.accent]}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-medium opacity-75">{card.title}</div>
                    <div className="text-2xl font-bold">{card.value}</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="flex items-center text-lg font-semibold text-gray-900">
              <Activity className="w-5 h-5 mr-2 text-gray-600" /> 最近活动
            </h2>
            <Link to="/activity" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              查看全部
            </Link>
          </div>
          <div className="p-6">
            {stats.recentActivity && stats.recentActivity.length > 0 ? (
              <ul className="space-y-4">
                {stats.recentActivity.slice(0, 6).map((activity, index) => (
                  <li key={`${activity.timestamp}-${index}`} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-medium">{activity.description}</p>
                      <p className="text-sm text-gray-500">{activity.timestamp}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8 text-gray-500">暂无最近活动</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="flex items-center text-lg font-semibold text-gray-900">
                <Clock className="w-5 h-5 mr-2 text-gray-600" /> 任务概览
              </h2>
            </div>
            <div className="p-6">
              <ul className="space-y-4">
                {taskHighlights.map((item) => {
                  const Icon = item.icon
                  const colorClasses = {
                    'is-warning': 'text-amber-600 bg-amber-50',
                    'is-success': 'text-green-600 bg-green-50',
                    'is-info': 'text-blue-600 bg-blue-50'
                  }
                  return (
                    <li key={item.label} className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${colorClasses[item.accent]}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xl font-bold text-gray-900">{item.value}</p>
                        <p className="text-sm text-gray-600">{item.label}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="flex items-center text-lg font-semibold text-gray-900">
                <Users className="w-5 h-5 mr-2 text-gray-600" /> 快速操作
              </h2>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  const colorClasses = {
                    'is-blue': 'text-blue-600 bg-blue-50 hover:bg-blue-100',
                    'is-amber': 'text-amber-600 bg-amber-50 hover:bg-amber-100',
                    'is-emerald': 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                  }
                  return (
                    <li key={action.title}>
                      <Link 
                        to={action.to} 
                        className={`block p-4 rounded-lg border border-gray-200 transition-colors duration-200 hover:border-gray-300 ${colorClasses[action.accent]}`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-white rounded-lg">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900">{action.title}</p>
                            <p className="text-sm text-gray-600">{action.description}</p>
                          </div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
