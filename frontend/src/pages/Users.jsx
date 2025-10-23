import React, { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import {
  Users as UsersIcon,
  Plus,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  Shield,
  Key,
  AlertCircle,
  CheckCircle,
  X,
  Save,
  Eye,
  EyeOff,
  Pause,
  Play
} from 'lucide-react'

const FILTER_OPTIONS = [
  { key: 'all', label: '全部用户' },
  { key: 'admin', label: '管理员' },
  { key: 'user', label: '普通用户' },
  { key: 'active', label: '活跃' },
  { key: 'inactive', label: '禁用' }
]

const defaultNewUser = {
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  is_admin: false,
  is_active: true
}

function Users() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [newUser, setNewUser] = useState(defaultNewUser)
  const [editUser, setEditUser] = useState({})
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadUsers = useCallback(async () => {
    if (!user?.is_admin) return
    try {
      setLoading(true)
      const params = {
        ...(filter !== 'all' && { filter }),
        ...(searchTerm.trim() && { search: searchTerm.trim() })
      }
      const response = await axios.get('/users/', { params })
      // Handle both wrapped and unwrapped responses
      const data = response.data?.data || response.data
      setUsers(Array.isArray(data) ? data : data?.results || [])
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.is_admin, filter, searchTerm])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const createUser = async () => {
    try {
      setSaving(true)
      await axios.post('/users/', newUser)
      setShowCreateModal(false)
      setNewUser(defaultNewUser)
      loadUsers()
    } catch (error) {
      console.error('Failed to create user:', error)
    } finally {
      setSaving(false)
    }
  }

  const updateUser = async () => {
    try {
      setSaving(true)
      await axios.patch(`/users/${selectedUser.id}/`, editUser)
      setShowEditModal(false)
      setSelectedUser(null)
      setEditUser({})
      loadUsers()
    } catch (error) {
      console.error('Failed to update user:', error)
    } finally {
      setSaving(false)
    }
  }

  const resetPassword = async () => {
    try {
      setSaving(true)
      await axios.post(`/users/${selectedUser.id}/reset-password/`, {
        password: newPassword
      })
      setShowPasswordModal(false)
      setSelectedUser(null)
      setNewPassword('')
    } catch (error) {
      console.error('Failed to reset password:', error)
    } finally {
      setSaving(false)
    }
  }

  const toggleUserStatus = async (userId, isActive) => {
    try {
      await axios.patch(`/users/${userId}/`, { is_active: !isActive })
      loadUsers()
    } catch (error) {
      console.error('Failed to toggle user status:', error)
    }
  }

  const deleteUser = async (userId) => {
    if (!window.confirm('确定要删除这个用户吗？此操作不可撤销。')) return
    try {
      await axios.delete(`/users/${userId}/`)
      loadUsers()
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }

  const openEditModal = (userToEdit) => {
    setSelectedUser(userToEdit)
    setEditUser({
      username: userToEdit.username,
      email: userToEdit.email,
      first_name: userToEdit.first_name || '',
      last_name: userToEdit.last_name || '',
      is_admin: userToEdit.is_admin,
      is_active: userToEdit.is_active
    })
    setShowEditModal(true)
  }

  const openPasswordModal = (userToEdit) => {
    setSelectedUser(userToEdit)
    setNewPassword('')
    setShowPasswordModal(true)
  }

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    return users.filter((candidate) => {
      if (filter === 'admin' && !candidate.is_admin) return false
      if (filter === 'user' && candidate.is_admin) return false
      if (filter === 'active' && !candidate.is_active) return false
      if (filter === 'inactive' && candidate.is_active) return false

      if (!keyword) return true

      const matches = [
        candidate.username,
        candidate.email,
        candidate.first_name,
        candidate.last_name
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(keyword))

      return matches
    })
  }, [users, filter, searchTerm])

  const renderRoleBadge = (isAdmin) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
      {isAdmin ? '管理员' : '普通用户'}
    </span>
  )

  const renderStatusBadge = (isActive) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
      {isActive ? '活跃' : '禁用'}
    </span>
  )

  const renderToggleIcon = (isActive) => (
    isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />
  )

  const nonAdminView = !user?.is_admin

  if (nonAdminView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">访问受限</h3>
        <p className="text-gray-600">只有管理员可以访问用户管理。</p>
      </div>
    )
  }

  if (loading && !users.length) {
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">用户管理</h1>
          <p className="text-gray-600">管理账户、角色与密码，保持团队成员权限和状态同步。</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" onClick={loadUsers}>
            <RefreshCw className="w-4 h-4 mr-2" />
            <span>刷新列表</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={() => {
              setShowCreateModal(true)
              setNewUser(defaultNewUser)
              setNewUser(defaultNewUser)
              setShowPassword(false)
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            创建用户
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索用户名、邮箱或姓名..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {FILTER_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === item.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {!filteredUsers.length ? (
          <div className="text-center py-12">
            <UsersIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无匹配的用户</h3>
            <p className="text-gray-500">
              {searchTerm || filter !== 'all'
                ? '没有找到符合条件的用户，请尝试调整搜索或筛选。'
                : '点击右上角的"创建用户"按钮，快速添加团队成员。'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户信息</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邮箱</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后登录</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">注册时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{entry.username}</div>
                        {(entry.first_name || entry.last_name) && (
                          <div className="text-sm text-gray-500">{entry.first_name} {entry.last_name}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{renderRoleBadge(entry.is_admin)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{renderStatusBadge(entry.is_active)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.last_login ? (
                        <div>
                          <span>{new Date(entry.last_login).toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500">从未登录</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(entry.date_joined).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                          onClick={() => openEditModal(entry)}
                          title="编辑用户"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50"
                          onClick={() => openPasswordModal(entry)}
                          title="重置密码"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50"
                          onClick={() => toggleUserStatus(entry.id, entry.is_active)}
                          title={entry.is_active ? '禁用用户' : '激活用户'}
                        >
                          {renderToggleIcon(entry.is_active)}
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          onClick={() => deleteUser(entry.id)}
                          title="删除用户"
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

      {showCreateModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          role="presentation"
          onClick={() => {
            setShowCreateModal(false)
            setNewUser(defaultNewUser)
          }}
        >
          <div
            className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">创建新用户</h3>
                <p className="text-sm text-gray-500 mt-1">填写基本信息和初始密码，稍后可以发送欢迎邮件。</p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setShowCreateModal(false)
                  setNewUser(defaultNewUser)
                }}
                aria-label="关闭"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="create-username">用户名</label>
                <input
                  id="create-username"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={newUser.username}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, username: event.target.value }))}
                  placeholder="输入用于登录的用户名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="create-email">邮箱</label>
                <input
                  id="create-email"
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={newUser.email}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="输入邮箱地址"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="create-password">初始密码</label>
                <div className="relative">
                  <input
                    id="create-password"
                    type={showPassword ? 'text' : 'password'}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={newUser.password}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="设置登录密码"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="create-first-name">名</label>
                  <input
                    id="create-first-name"
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={newUser.first_name}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, first_name: event.target.value }))}
                    placeholder="名（可选）"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="create-last-name">姓氏</label>
                  <input
                    id="create-last-name"
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={newUser.last_name}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, last_name: event.target.value }))}
                    placeholder="姓氏（可选）"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    checked={newUser.is_admin}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, is_admin: event.target.checked }))}
                  />
                  <span className="ml-2 text-sm text-gray-700">授予管理员权限</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    checked={newUser.is_active}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <span className="ml-2 text-sm text-gray-700">激活此账户</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => setShowCreateModal(false)}
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                onClick={createUser}
                disabled={saving || !newUser.username.trim() || !newUser.email.trim() || !newUser.password.trim()}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    创建用户
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          role="presentation"
          onClick={() => {
            setShowEditModal(false)
            setSelectedUser(null)
            setEditUser({})
          }}
        >
          <div
            className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">编辑用户信息</h3>
                <p className="text-sm text-gray-500 mt-1">更新基本信息和权限配置。</p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedUser(null)
                  setEditUser({})
                }}
                aria-label="关闭"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-username">用户名</label>
                <input
                  id="edit-username"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={editUser.username || ''}
                  onChange={(event) => setEditUser((prev) => ({ ...prev, username: event.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-email">邮箱</label>
                <input
                  id="edit-email"
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={editUser.email || ''}
                  onChange={(event) => setEditUser((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-first-name">名</label>
                  <input
                    id="edit-first-name"
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={editUser.first_name || ''}
                    onChange={(event) => setEditUser((prev) => ({ ...prev, first_name: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-last-name">姓氏</label>
                  <input
                    id="edit-last-name"
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={editUser.last_name || ''}
                    onChange={(event) => setEditUser((prev) => ({ ...prev, last_name: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    checked={editUser.is_admin || false}
                    onChange={(event) => setEditUser((prev) => ({ ...prev, is_admin: event.target.checked }))}
                  />
                  <span className="ml-2 text-sm text-gray-700">管理员权限</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    checked={editUser.is_active || false}
                    onChange={(event) => setEditUser((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <span className="ml-2 text-sm text-gray-700">激活账户</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedUser(null)
                  setEditUser({})
                }}
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                onClick={updateUser}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    保存变更
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && selectedUser && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          role="presentation"
          onClick={() => {
            setShowPasswordModal(false)
            setSelectedUser(null)
            setNewPassword('')
          }}
        >
          <div
            className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">重置密码</h3>
                <p className="text-sm text-gray-500 mt-1">为 {selectedUser.username} 设置新密码。</p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setShowPasswordModal(false)
                  setSelectedUser(null)
                  setNewPassword('')
                }}
                aria-label="关闭"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="reset-password">新密码</label>
                <input
                  id="reset-password"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="输入新密码"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={() => {
                  setShowPasswordModal(false)
                  setSelectedUser(null)
                  setNewPassword('')
                }}
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                onClick={resetPassword}
                disabled={saving || !newPassword.trim()}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    重置中...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    确认重置
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

export default Users
