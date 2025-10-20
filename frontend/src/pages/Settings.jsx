import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import {
  Settings as SettingsIcon,
  Save,
  AlertCircle,
  CheckCircle,
  Cpu,
  HardDrive,
  Zap,
  Server,
  Shield
} from 'lucide-react'

const SETTINGS_SECTIONS = [
  {
    key: 'transcription',
    label: '转录设置',
    description: '配置模型、语言和运行策略',
    icon: Cpu
  },
  {
    key: 'storage',
    label: '存储设置',
    description: '管理NAS与本地存储策略',
    icon: HardDrive
  },
  {
    key: 'system',
    label: '系统设置',
    description: '控制全局任务和日志行为',
    icon: Zap
  },
  {
    key: 'security',
    label: '安全设置',
    description: '遵循安全最佳实践',
    icon: Shield
  }
]

function Settings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState({
    transcription: {
      default_model: 'whisper-large',
      default_language: 'zh-CN',
      device: 'auto',
      concurrency: 2,
      quality: 'high'
    },
    storage: {
      nas_enabled: false,
      nas_host: '',
      nas_path: '',
      local_storage_path: '/uploads',
      max_file_size: 100
    },
    system: {
      max_concurrent_tasks: 5,
      auto_cleanup_days: 30,
      enable_notifications: true,
      log_level: 'INFO'
    }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [activeSection, setActiveSection] = useState('transcription')

  const sectionRefs = {
    transcription: useRef(null),
    storage: useRef(null),
    system: useRef(null),
    security: useRef(null)
  }

  useEffect(() => {
    if (user?.is_admin) {
      loadSettings()
    }
  }, [user])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/settings/')
      setSettings(response.data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      await axios.post('/settings/', settings)
      setMessage({ type: 'success', text: '设置已保存' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setMessage({ type: 'error', text: '保存失败，请重试' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }))
  }

  const testNasConnection = async () => {
    try {
      const response = await axios.post('/settings/test-nas/', {
        host: settings.storage.nas_host,
        path: settings.storage.nas_path
      })
      setMessage({
        type: response.data.success ? 'success' : 'error',
        text: response.data.message
      })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'NAS连接测试失败' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  useEffect(() => {
    if (loading) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionKey = entry.target.dataset.section
            if (sectionKey) {
              setActiveSection(sectionKey)
            }
          }
        })
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )

    const observedElements = Object.values(sectionRefs)
      .map((ref) => ref.current)
      .filter(Boolean)

    observedElements.forEach((element) => observer.observe(element))

    return () => {
      observedElements.forEach((element) => observer.unobserve(element))
      observer.disconnect()
    }
  }, [loading])

  const scrollToSection = (key) => {
    const element = sectionRefs[key]?.current
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // 非管理员用户显示权限提示
  if (!user?.is_admin) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">访问受限</h3>
        <p className="mt-1 text-sm text-gray-500">
          只有管理员可以访问系统设置
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      {/* Header */}
      <header className="settings-header">
        <div className="settings-header-meta">
          <span className="settings-header-eyebrow">
            <SettingsIcon className="settings-header-icon" />
            系统控制台
          </span>
          <h1 className="settings-header-title">系统设置</h1>
          <p className="settings-header-description">
            配置模型、语言、存储与系统运行策略，确保平台稳定高效地服务团队。
          </p>
        </div>
        <div className="settings-header-actions">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? (
              <>
                <div className="spinner-sm"></div>
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                保存设置
              </>
            )}
          </button>
        </div>
      </header>

      {/* Admin Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              管理员权限
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                系统设置功能仅对管理员开放。修改这些设置将影响整个系统的运行，请谨慎操作。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div
          className={`settings-feedback rounded-md p-4 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400" />
            )}
            <div className="ml-3">
              <p
                className={`text-sm ${
                  message.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {message.text}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="settings-layout">
        <aside className="settings-sidebar" aria-label="设置导航">
          <nav className="settings-nav">
            {SETTINGS_SECTIONS.map(({ key, label, description, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`settings-nav-item${
                  activeSection === key ? ' is-active' : ''
                }`}
                onClick={() => scrollToSection(key)}
              >
                <Icon className="settings-nav-icon" />
                <span className="settings-nav-text">
                  <span className="settings-nav-title">{label}</span>
                  <span className="settings-nav-description">{description}</span>
                </span>
              </button>
            ))}
          </nav>

          <div className="settings-sidebar-card">
            <h2 className="settings-sidebar-title">保存提示</h2>
            <p className="settings-sidebar-description">
              所有更改将立即影响系统。「保存设置」后会应用到新的任务。
            </p>
            <p className="settings-sidebar-hint">
              建议在维护窗口或业务低谷时调整关键参数。
            </p>
          </div>
        </aside>

        <div className="settings-content">
          {/* Transcription Settings */}
          <section
            ref={sectionRefs.transcription}
            data-section="transcription"
            className="settings-section card"
          >
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Cpu className="h-5 w-5 mr-2" />
              转录设置
            </h3>
          </div>
          <div className="card-body space-y-4">
            <div className="form-group">
              <label className="form-label">默认模型</label>
              <select
                className="form-input"
                value={settings.transcription.default_model}
                onChange={(e) => updateSetting('transcription', 'default_model', e.target.value)}
              >
                <option value="whisper-large">Whisper Large (最高精度)</option>
                <option value="whisper-medium">Whisper Medium (平衡)</option>
                <option value="whisper-small">Whisper Small (最快速度)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">默认语言</label>
              <select
                className="form-input"
                value={settings.transcription.default_language}
                onChange={(e) => updateSetting('transcription', 'default_language', e.target.value)}
              >
                <option value="zh-CN">中文 (简体)</option>
                <option value="zh-TW">中文 (繁体)</option>
                <option value="en-US">英语</option>
                <option value="ja-JP">日语</option>
                <option value="ko-KR">韩语</option>
                <option value="auto">自动检测</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">计算设备</label>
              <select
                className="form-input"
                value={settings.transcription.device}
                onChange={(e) => updateSetting('transcription', 'device', e.target.value)}
              >
                <option value="auto">自动选择</option>
                <option value="cpu">CPU</option>
                <option value="cuda">CUDA (NVIDIA GPU)</option>
                <option value="mps">MPS (Apple Silicon)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">并发任务数</label>
              <input
                type="number"
                min="1"
                max="10"
                className="form-input"
                value={settings.transcription.concurrency}
                onChange={(e) => updateSetting('transcription', 'concurrency', parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500 mt-1">
                同时处理的转录任务数量，建议根据硬件性能调整
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">转录质量</label>
              <select
                className="form-input"
                value={settings.transcription.quality}
                onChange={(e) => updateSetting('transcription', 'quality', e.target.value)}
              >
                <option value="high">高质量 (慢)</option>
                <option value="medium">中等质量 (平衡)</option>
                <option value="fast">快速 (低质量)</option>
              </select>
            </div>
          </div>
        </section>

          {/* Storage Settings */}
          <section
            ref={sectionRefs.storage}
            data-section="storage"
            className="settings-section card"
          >
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <HardDrive className="h-5 w-5 mr-2" />
              存储设置
            </h3>
          </div>
          <div className="card-body space-y-4">
            <div className="form-group">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={settings.storage.nas_enabled}
                  onChange={(e) => updateSetting('storage', 'nas_enabled', e.target.checked)}
                />
                <span className="ml-2 text-sm text-gray-700">启用NAS存储</span>
              </label>
            </div>

            {settings.storage.nas_enabled && (
              <>
                <div className="form-group">
                  <label className="form-label">NAS主机地址</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="192.168.1.100"
                    value={settings.storage.nas_host}
                    onChange={(e) => updateSetting('storage', 'nas_host', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">NAS存储路径</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="/volume1/media"
                    value={settings.storage.nas_path}
                    onChange={(e) => updateSetting('storage', 'nas_path', e.target.value)}
                  />
                </div>

                <button
                  onClick={testNasConnection}
                  className="btn btn-secondary"
                >
                  <Server className="h-4 w-4 mr-2" />
                  测试NAS连接
                </button>
              </>
            )}

            <div className="form-group">
              <label className="form-label">本地存储路径</label>
              <input
                type="text"
                className="form-input"
                value={settings.storage.local_storage_path}
                onChange={(e) => updateSetting('storage', 'local_storage_path', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">最大文件大小 (MB)</label>
              <input
                type="number"
                min="1"
                max="1000"
                className="form-input"
                value={settings.storage.max_file_size}
                onChange={(e) => updateSetting('storage', 'max_file_size', parseInt(e.target.value))}
              />
            </div>
          </div>
        </section>

          {/* System Settings */}
          <section
            ref={sectionRefs.system}
            data-section="system"
            className="settings-section card"
          >
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Zap className="h-5 w-5 mr-2" />
              系统设置
            </h3>
          </div>
          <div className="card-body space-y-4">
            <div className="form-group">
              <label className="form-label">最大并发任务数</label>
              <input
                type="number"
                min="1"
                max="20"
                className="form-input"
                value={settings.system.max_concurrent_tasks}
                onChange={(e) => updateSetting('system', 'max_concurrent_tasks', parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500 mt-1">
                系统同时处理的最大任务数量
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">自动清理天数</label>
              <input
                type="number"
                min="1"
                max="365"
                className="form-input"
                value={settings.system.auto_cleanup_days}
                onChange={(e) => updateSetting('system', 'auto_cleanup_days', parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500 mt-1">
                自动删除多少天前的临时文件
              </p>
            </div>

            <div className="form-group">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={settings.system.enable_notifications}
                  onChange={(e) => updateSetting('system', 'enable_notifications', e.target.checked)}
                />
                <span className="ml-2 text-sm text-gray-700">启用系统通知</span>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">日志级别</label>
              <select
                className="form-input"
                value={settings.system.log_level}
                onChange={(e) => updateSetting('system', 'log_level', e.target.value)}
              >
                <option value="DEBUG">DEBUG (详细)</option>
                <option value="INFO">INFO (信息)</option>
                <option value="WARNING">WARNING (警告)</option>
                <option value="ERROR">ERROR (错误)</option>
              </select>
            </div>
          </div>
        </section>

          {/* Security Settings */}
          <section
            ref={sectionRefs.security}
            data-section="security"
            className="settings-section card"
          >
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
              安全设置
            </h3>
          </div>
            <div className="card-body space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-blue-400" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-800">
                      安全提示
                    </h4>
                    <div className="mt-2 text-sm text-blue-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>定期更新系统和依赖包</li>
                        <li>使用强密码和双因素认证</li>
                        <li>限制管理员账户数量</li>
                        <li>定期备份重要数据</li>
                        <li>监控系统日志和异常活动</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p>更多安全设置功能正在开发中...</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Settings
