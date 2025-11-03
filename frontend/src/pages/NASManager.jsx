import React, { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Server,
  Plus,
  Edit,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  X,
  HardDrive,
  Wifi,
  WifiOff,
  Folder,
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  FolderOpen,
  Play
} from 'lucide-react'
import NASFileBrowser from '../components/NASFileBrowser'

function NASManager() {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState(null)
  const [testingConnection, setTestingConnection] = useState(null)
  const [message, setMessage] = useState(null)
  const [fileBrowserConnection, setFileBrowserConnection] = useState(null)
  const [scanningConnections, setScanningConnections] = useState(new Set())
  const [formData, setFormData] = useState({
    name: '',
    protocol: 'webdav',
    host: '',
    port: '',
    username: '',
    password: '',
    base_path: '/',
    is_active: true
  })

  const protocols = [
    { value: 'webdav', label: 'WebDAV' },
    { value: 'smb', label: 'SMB/CIFS' },
    { value: 'ftp', label: 'FTP' },
    { value: 'sftp', label: 'SFTP' }
  ]

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        setLoading(true)
        const response = await axios.get('/api/nas/connections/')
        setConnections(response.data.results || response.data)
      } catch (error) {
        console.error('Failed to fetch NAS connections:', error)
        showMessage('error', '获取NAS连接失败')
      } finally {
        setLoading(false)
      }
    }
    
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/nas/connections/')
      setConnections(response.data.results || response.data)
    } catch (error) {
      console.error('Failed to fetch NAS connections:', error)
      showMessage('error', '获取NAS连接失败')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingConnection) {
        await axios.put(`/api/nas/connections/${editingConnection.id}/`, formData)
        showMessage('success', 'NAS连接已更新')
      } else {
        await axios.post('/api/nas/connections/', formData)
        showMessage('success', 'NAS连接已创建')
      }
      
      setShowForm(false)
      setEditingConnection(null)
      resetForm()
      fetchConnections()
    } catch (error) {
      console.error('Failed to save NAS connection:', error)
      showMessage('error', '保存NAS连接失败')
    }
  }

  const handleEdit = (connection) => {
    setEditingConnection(connection)
    setFormData({
      name: connection.name,
      protocol: connection.protocol,
      host: connection.host,
      port: connection.port || '',
      username: connection.username,
      password: '', // 不显示密码
      base_path: connection.base_path,
      is_active: connection.is_active
    })
    setShowForm(true)
  }

  const handleDelete = async (connectionId) => {
    if (!confirm('确定要删除这个NAS连接吗？')) return
    
    try {
      await axios.delete(`/api/nas/connections/${connectionId}/`)
      showMessage('success', 'NAS连接已删除')
      fetchConnections()
    } catch (error) {
      console.error('Failed to delete NAS connection:', error)
      showMessage('error', '删除NAS连接失败')
    }
  }

  const handleTest = async (connection) => {
    try {
      setTestingConnection(connection.id)
      const response = await axios.post(`/api/nas/connections/${connection.id}/test/`)
      
      if (response.data.success) {
        showMessage('success', 'NAS连接测试成功')
      } else {
        showMessage('error', `连接测试失败: ${response.data.message}`)
      }
    } catch (error) {
      console.error('Failed to test NAS connection:', error)
      showMessage('error', 'NAS连接测试失败')
    } finally {
      setTestingConnection(null)
    }
  }

  const handleBrowseFiles = (connection) => {
    setFileBrowserConnection(connection)
  }

  const handleScanConnection = async (connection) => {
    try {
      setScanningConnections(prev => new Set([...prev, connection.id]))
      const response = await axios.post(`/api/nas/connections/${connection.id}/scan/`, {
        max_files: 1000,
        sync_files: true
      })
      
      if (response.data.success) {
        const { total_files, new_files, updated_files } = response.data.result
        showMessage('success', `扫描完成: 总计${total_files}个文件，新增${new_files}个，更新${updated_files}个`)
      } else {
        showMessage('error', `扫描失败: ${response.data.message}`)
      }
    } catch (error) {
      console.error('Failed to scan NAS connection:', error)
      showMessage('error', 'NAS扫描失败')
    } finally {
      setScanningConnections(prev => {
        const newSet = new Set(prev)
        newSet.delete(connection.id)
        return newSet
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      protocol: 'webdav',
      host: '',
      port: '',
      username: '',
      password: '',
      base_path: '/',
      is_active: true
    })
  }

  const getStatusIcon = (connection) => {
    if (connection.test_status === 'success') {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    } else if (connection.test_status === 'failed') {
      return <XCircle className="w-5 h-5 text-red-500" />
    } else {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />
    }
  }

  const getProtocolIcon = (protocol) => {
    switch (protocol) {
      case 'webdav':
        return <Server className="w-4 h-4" />
      case 'smb':
        return <HardDrive className="w-4 h-4" />
      case 'ftp':
      case 'sftp':
        return <Folder className="w-4 h-4" />
      default:
        return <Server className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">加载中...</span>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Server className="w-8 h-8 text-blue-500 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">NAS连接管理</h1>
            <p className="text-gray-600">管理您的网络存储连接</p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setEditingConnection(null)
            resetForm()
          }}
          className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加连接
        </button>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 mr-2" />
          ) : (
            <XCircle className="w-5 h-5 mr-2" />
          )}
          {message.text}
        </div>
      )}

      {/* 连接列表 */}
      <div className="bg-white rounded-lg shadow">
        {connections.length === 0 ? (
          <div className="p-8 text-center">
            <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无NAS连接</h3>
            <p className="text-gray-500 mb-4">添加您的第一个NAS连接开始使用</p>
            <button
              onClick={() => {
                setShowForm(true)
                setEditingConnection(null)
                resetForm()
              }}
              className="flex items-center mx-auto px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加连接
            </button>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    连接信息
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    协议
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最后更新
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {connections.map((connection) => (
                  <tr key={connection.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {connection.is_active ? (
                            <Wifi className="w-5 h-5 text-green-500" />
                          ) : (
                            <WifiOff className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {connection.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {connection.host}:{connection.port || '默认'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getProtocolIcon(connection.protocol)}
                        <span className="ml-2 text-sm text-gray-900 uppercase">
                          {connection.protocol}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(connection)}
                        <span className="ml-2 text-sm text-gray-900">
                          {connection.test_status === 'success' ? '正常' : 
                           connection.test_status === 'failed' ? '失败' : '未测试'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(connection.updated_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleTest(connection)}
                          disabled={testingConnection === connection.id}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                          title="测试连接"
                        >
                          {testingConnection === connection.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <TestTube className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleBrowseFiles(connection)}
                          className="text-green-600 hover:text-green-900"
                          title="浏览文件"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleScanConnection(connection)}
                          disabled={scanningConnections.has(connection.id)}
                          className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                          title="扫描文件"
                        >
                          {scanningConnections.has(connection.id) ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(connection)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(connection.id)}
                          className="text-red-600 hover:text-red-900"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 添加/编辑表单模态框 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingConnection ? '编辑NAS连接' : '添加NAS连接'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingConnection(null)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  连接名称
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  协议
                </label>
                <select
                  value={formData.protocol}
                  onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {protocols.map((protocol) => (
                    <option key={protocol.value} value={protocol.value}>
                      {protocol.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    主机地址
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="192.168.1.100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    端口
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="默认"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  用户名
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密码
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={!editingConnection}
                  placeholder={editingConnection ? "留空保持不变" : ""}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  基础路径
                </label>
                <input
                  type="text"
                  value={formData.base_path}
                  onChange={(e) => setFormData({ ...formData, base_path: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="/"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  启用连接
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingConnection(null)
                    resetForm()
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingConnection ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 文件浏览器模态框 */}
      {fileBrowserConnection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full h-full max-w-6xl max-h-[90vh] mx-4 my-4 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                文件浏览器 - {fileBrowserConnection.name}
              </h2>
              <button
                onClick={() => setFileBrowserConnection(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <NASFileBrowser
                connectionId={fileBrowserConnection.id}
                onClose={() => setFileBrowserConnection(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NASManager