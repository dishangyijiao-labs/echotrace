import React, { useState, useEffect, useRef, useMemo } from 'react'
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

  const transcriptionRef = useRef(null)
  const storageRef = useRef(null)
  const systemRef = useRef(null)
  const securityRef = useRef(null)

  const sectionRefs = useMemo(() => ({
    transcription: transcriptionRef,
    storage: storageRef,
    system: systemRef,
    security: securityRef
  }), [])

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
  }, [loading, sectionRefs])

  const scrollToSection = (key) => {
    const element = sectionRefs[key]?.current
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // 非管理员用户显示权限提示
  if (!user?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">访问受限</h3>
        <p className="mt-1 text-sm text-gray-500">
          只有管理员可以访问系统设置
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <SettingsIcon className="w-4 h-4 mr-2" />
            系统控制台
          </div>
          <h1 className="text-3xl font-bold text-gray-900">系统设置</h1>
          <p className="mt-2 text-lg text-gray-600">
            配置模型、语言、存储与系统运行策略，确保平台稳定高效地服务团队。
          </p>
        </div>
        <div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存设置
              </>
            )}
          </button>
        </div>
      </header>

      {/* Admin Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
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
          className={`rounded-lg p-4 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
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

      <div className="flex gap-8">
        <aside className="w-64 flex-shrink-0" aria-label="设置导航">
          <nav className="space-y-2">
            {SETTINGS_SECTIONS.map(({ key, label, description, icon: Icon }) => ( // eslint-disable-line no-unused-vars
              <button
                key={key}
                type="button"
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  activeSection === key 
                    ? 'bg-blue-50 border-blue-200 text-blue-900' 
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => scrollToSection(key)}
              >
                <div className="flex items-start space-x-3">
                  <Icon className={`w-5 h-5 mt-0.5 ${
                    activeSection === key ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-sm text-gray-500 mt-1">{description}</div>
                  </div>
                </div>
              </button>
            ))}
          </nav>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-sm font-medium text-gray-900 mb-2">保存提示</h2>
            <p className="text-sm text-gray-600 mb-3">
              所有更改将立即影响系统。「保存设置」后会应用到新的任务。
            </p>
            <p className="text-xs text-gray-500">
              建议在维护窗口或业务低谷时调整关键参数。
            </p>
          </div>
        </aside>

        <div className="flex-1 space-y-8">
          {/* Transcription Settings */}
          <section
            ref={sectionRefs.transcription}
            data-section="transcription"
            className="bg-white rounded-lg border border-gray-200 shadow-sm"
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Cpu className="w-5 h-5 mr-2 text-blue-600" />
                转录设置
              </h3>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">默认模型</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={settings.transcription.default_model}
                  onChange={(e) => updateSetting('transcription', 'default_model', e.target.value)}
                >
                  <option value="whisper-large">Whisper Large (最高精度)</option>
                  <option value="whisper-medium">Whisper Medium (平衡)</option>
                  <option value="whisper-small">Whisper Small (最快速度)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">默认语言</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">计算设备</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={settings.transcription.device}
                  onChange={(e) => updateSetting('transcription', 'device', e.target.value)}
                >
                  <option value="auto">自动选择</option>
                  <option value="cpu">CPU</option>
                  <option value="cuda">CUDA (NVIDIA GPU)</option>
                  <option value="mps">MPS (Apple Silicon)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">并发任务数</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={settings.transcription.concurrency}
                  onChange={(e) => updateSetting('transcription', 'concurrency', parseInt(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  同时处理的转录任务数量，建议根据硬件性能调整
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">转录质量</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="bg-white rounded-lg border border-gray-200 shadow-sm"
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <HardDrive className="w-5 h-5 mr-2 text-green-600" />
                存储设置
              </h3>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={settings.storage.nas_enabled}
                    onChange={(e) => updateSetting('storage', 'nas_enabled', e.target.checked)}
                  />
                  <span className="ml-2 text-sm text-gray-700">启用NAS存储</span>
                </label>
              </div>

              {settings.storage.nas_enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">NAS主机地址</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="192.168.1.100"
                      value={settings.storage.nas_host}
                      onChange={(e) => updateSetting('storage', 'nas_host', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">NAS存储路径</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="/volume1/media"
                      value={settings.storage.nas_path}
                      onChange={(e) => updateSetting('storage', 'nas_path', e.target.value)}
                    />
                  </div>

                  <button
                    onClick={testNasConnection}
                    className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Server className="w-4 h-4 mr-2" />
                    测试NAS连接
                  </button>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">本地存储路径</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={settings.storage.local_storage_path}
                  onChange={(e) => updateSetting('storage', 'local_storage_path', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">最大文件大小 (MB)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="bg-white rounded-lg border border-gray-200 shadow-sm"
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-yellow-600" />
                系统设置
              </h3>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">最大并发任务数</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={settings.system.max_concurrent_tasks}
                  onChange={(e) => updateSetting('system', 'max_concurrent_tasks', parseInt(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  系统同时处理的最大任务数量
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">自动清理天数</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={settings.system.auto_cleanup_days}
                  onChange={(e) => updateSetting('system', 'auto_cleanup_days', parseInt(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  自动删除多少天前的临时文件
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={settings.system.enable_notifications}
                    onChange={(e) => updateSetting('system', 'enable_notifications', e.target.checked)}
                  />
                  <span className="ml-2 text-sm text-gray-700">启用系统通知</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">日志级别</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="bg-white rounded-lg border border-gray-200 shadow-sm"
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-purple-600" />
                安全设置
              </h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
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
