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
      const response = await axios.get('/api/users/', { params })
      setUsers(response.data)
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
      await axios.post('/api/users/', newUser)
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
      await axios.patch(`/api/users/${selectedUser.id}/`, editUser)
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
      await axios.post(`/api/users/${selectedUser.id}/reset-password/`, {
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
      await axios.patch(`/api/users/${userId}/`, { is_active: !isActive })
      loadUsers()
    } catch (error) {
      console.error('Failed to toggle user status:', error)
    }
  }

  const deleteUser = async (userId) => {
    if (!window.confirm('确定要删除这个用户吗？此操作不可撤销。')) return
    try {
      await axios.delete(`/api/users/${userId}/`)
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
    <span className={`users-role ${isAdmin ? 'is-admin' : 'is-user'}`}>
      {isAdmin ? '管理员' : '普通用户'}
    </span>
  )

  const renderStatusBadge = (isActive) => (
    <span className={`users-status ${isActive ? 'is-active' : 'is-inactive'}`}>
      {isActive ? '活跃' : '禁用'}
    </span>
  )

  const renderToggleIcon = (isActive) => (
    isActive ? <Pause className="users-row-button-icon" /> : <Play className="users-row-button-icon" />
  )

  const nonAdminView = !user?.is_admin

  if (nonAdminView) {
    return (
      <div className="users-locked">
        <AlertCircle className="users-locked-icon" />
        <h3 className="users-locked-title">访问受限</h3>
        <p className="users-locked-text">只有管理员可以访问用户管理。</p>
      </div>
    )
  }

  if (loading && !users.length) {
    return (
      <div className="users-loading">
        <span className="spinner" />
      </div>
    )
  }

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h1 className="users-title">用户管理</h1>
          <p className="users-subtitle">管理账户、角色与密码，保持团队成员权限和状态同步。</p>
        </div>
        <div className="users-actions">
          <button type="button" className="users-icon-button" onClick={loadUsers}>
            <RefreshCw className="users-icon-button-icon" />
            <span>刷新列表</span>
          </button>
          <button
            type="button"
            className="users-primary-button"
            onClick={() => {
              setShowCreateModal(true)
              setNewUser(defaultNewUser)
              setShowPassword(false)
            }}
          >
            <Plus className="users-primary-button-icon" />
            创建用户
          </button>
        </div>
      </div>

      <div className="users-toolbar">
        <div className="users-search">
          <Search className="users-search-icon" />
          <input
            type="text"
            placeholder="搜索用户名、邮箱或姓名..."
            className="users-search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="users-tabs">
          {FILTER_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`users-tab${filter === item.key ? ' is-active' : ''}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="users-card">
        {!filteredUsers.length ? (
          <div className="users-empty">
            <UsersIcon className="users-empty-icon" />
            <h3 className="users-empty-title">暂无匹配的用户</h3>
            <p className="users-empty-text">
              {searchTerm || filter !== 'all'
                ? '没有找到符合条件的用户，请尝试调整搜索或筛选。'
                : '点击右上角的“创建用户”按钮，快速添加团队成员。'}
            </p>
          </div>
        ) : (
          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>用户信息</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>最后登录</th>
                  <th>注册时间</th>
                  <th className="users-table-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <div className="users-cell-main">
                        <span className="users-cell-title">{entry.username}</span>
                        {(entry.first_name || entry.last_name) && (
                          <span className="users-cell-subtitle">{entry.first_name} {entry.last_name}</span>
                        )}
                      </div>
                    </td>
                    <td>{entry.email}</td>
                    <td>{renderRoleBadge(entry.is_admin)}</td>
                    <td>{renderStatusBadge(entry.is_active)}</td>
                    <td>
                      {entry.last_login ? (
                        <div className="users-cell-stack">
                          <span>{new Date(entry.last_login).toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="users-cell-hint">从未登录</span>
                      )}
                    </td>
                    <td>{new Date(entry.date_joined).toLocaleString()}</td>
                    <td>
                      <div className="users-row-actions">
                        <button
                          type="button"
                          className="users-row-button"
                          onClick={() => openEditModal(entry)}
                          title="编辑用户"
                        >
                          <Edit className="users-row-button-icon" />
                        </button>
                        <button
                          type="button"
                          className="users-row-button"
                          onClick={() => openPasswordModal(entry)}
                          title="重置密码"
                        >
                          <Key className="users-row-button-icon" />
                        </button>
                        <button
                          type="button"
                          className="users-row-button"
                          onClick={() => toggleUserStatus(entry.id, entry.is_active)}
                          title={entry.is_active ? '禁用用户' : '激活用户'}
                        >
                          {renderToggleIcon(entry.is_active)}
                        </button>
                        <button
                          type="button"
                          className="users-row-button is-danger"
                          onClick={() => deleteUser(entry.id)}
                          title="删除用户"
                        >
                          <Trash2 className="users-row-button-icon" />
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
          className="users-modal-overlay"
          role="presentation"
          onClick={() => {
            setShowCreateModal(false)
            setNewUser(defaultNewUser)
          }}
        >
          <div
            className="users-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="users-modal-header">
              <div>
                <h3 className="users-modal-title">创建新用户</h3>
                <p className="users-modal-subtitle">填写基本信息和初始密码，稍后可以发送欢迎邮件。</p>
              </div>
              <button
                type="button"
                className="users-modal-close"
                onClick={() => {
                  setShowCreateModal(false)
                  setNewUser(defaultNewUser)
                }}
                aria-label="关闭"
              >
                <X className="users-modal-close-icon" />
              </button>
            </div>

            <div className="users-modal-body">
              <div className="users-field">
                <label className="users-field-label" htmlFor="create-username">用户名</label>
                <input
                  id="create-username"
                  type="text"
                  className="users-field-input"
                  value={newUser.username}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, username: event.target.value }))}
                  placeholder="输入用于登录的用户名"
                />
              </div>

              <div className="users-field">
                <label className="users-field-label" htmlFor="create-email">邮箱</label>
                <input
                  id="create-email"
                  type="email"
                  className="users-field-input"
                  value={newUser.email}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="输入邮箱地址"
                />
              </div>

              <div className="users-field">
                <label className="users-field-label" htmlFor="create-password">初始密码</label>
                <div className="users-password-field">
                  <input
                    id="create-password"
                    type={showPassword ? 'text' : 'password'}
                    className="users-field-input"
                    value={newUser.password}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="设置登录密码"
                  />
                  <button
                    type="button"
                    className="users-password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <div className="users-form-grid">
                <div className="users-field">
                  <label className="users-field-label" htmlFor="create-first-name">名</label>
                  <input
                    id="create-first-name"
                    type="text"
                    className="users-field-input"
                    value={newUser.first_name}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, first_name: event.target.value }))}
                    placeholder="名（可选）"
                  />
                </div>
                <div className="users-field">
                  <label className="users-field-label" htmlFor="create-last-name">姓氏</label>
                  <input
                    id="create-last-name"
                    type="text"
                    className="users-field-input"
                    value={newUser.last_name}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, last_name: event.target.value }))}
                    placeholder="姓氏（可选）"
                  />
                </div>
              </div>

              <div className="users-toggle-group">
                <label className="users-toggle">
                  <input
                    type="checkbox"
                    checked={newUser.is_admin}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, is_admin: event.target.checked }))}
                  />
                  <span>授予管理员权限</span>
                </label>
                <label className="users-toggle">
                  <input
                    type="checkbox"
                    checked={newUser.is_active}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <span>激活此账户</span>
                </label>
              </div>
            </div>

            <div className="users-modal-footer">
              <button
                type="button"
                className="users-secondary-button"
                onClick={() => setShowCreateModal(false)}
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                className="users-primary-button"
                onClick={createUser}
                disabled={saving || !newUser.username.trim() || !newUser.email.trim() || !newUser.password.trim()}
              >
                {saving ? (
                  <>
                    <span className="spinner-sm" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Save className="users-primary-button-icon" />
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
          className="users-modal-overlay"
          role="presentation"
          onClick={() => {
            setShowEditModal(false)
            setSelectedUser(null)
            setEditUser({})
          }}
        >
          <div
            className="users-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="users-modal-header">
              <div>
                <h3 className="users-modal-title">编辑用户信息</h3>
                <p className="users-modal-subtitle">更新基本信息和权限配置。</p>
              </div>
              <button
                type="button"
                className="users-modal-close"
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedUser(null)
                  setEditUser({})
                }}
                aria-label="关闭"
              >
                <X className="users-modal-close-icon" />
              </button>
            </div>

            <div className="users-modal-body">
              <div className="users-field">
                <label className="users-field-label" htmlFor="edit-username">用户名</label>
                <input
                  id="edit-username"
                  type="text"
                  className="users-field-input"
                  value={editUser.username || ''}
                  onChange={(event) => setEditUser((prev) => ({ ...prev, username: event.target.value }))}
                />
              </div>

              <div className="users-field">
                <label className="users-field-label" htmlFor="edit-email">邮箱</label>
                <input
                  id="edit-email"
                  type="email"
                  className="users-field-input"
                  value={editUser.email || ''}
                  onChange={(event) => setEditUser((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>

              <div className="users-form-grid">
                <div className="users-field">
                  <label className="users-field-label" htmlFor="edit-first-name">名</label>
                  <input
                    id="edit-first-name"
                    type="text"
                    className="users-field-input"
                    value={editUser.first_name || ''}
                    onChange={(event) => setEditUser((prev) => ({ ...prev, first_name: event.target.value }))}
                  />
                </div>
                <div className="users-field">
                  <label className="users-field-label" htmlFor="edit-last-name">姓氏</label>
                  <input
                    id="edit-last-name"
                    type="text"
                    className="users-field-input"
                    value={editUser.last_name || ''}
                    onChange={(event) => setEditUser((prev) => ({ ...prev, last_name: event.target.value }))}
                  />
                </div>
              </div>

              <div className="users-toggle-group">
                <label className="users-toggle">
                  <input
                    type="checkbox"
                    checked={editUser.is_admin || false}
                    onChange={(event) => setEditUser((prev) => ({ ...prev, is_admin: event.target.checked }))}
                  />
                  <span>管理员权限</span>
                </label>
                <label className="users-toggle">
                  <input
                    type="checkbox"
                    checked={editUser.is_active || false}
                    onChange={(event) => setEditUser((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <span>激活账户</span>
                </label>
              </div>
            </div>

            <div className="users-modal-footer">
              <button
                type="button"
                className="users-secondary-button"
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
                className="users-primary-button"
                onClick={updateUser}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-sm" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="users-primary-button-icon" />
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
          className="users-modal-overlay"
          role="presentation"
          onClick={() => {
            setShowPasswordModal(false)
            setSelectedUser(null)
            setNewPassword('')
          }}
        >
          <div
            className="users-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="users-modal-header">
              <div>
                <h3 className="users-modal-title">重置密码</h3>
                <p className="users-modal-subtitle">为 {selectedUser.username} 设置新密码。</p>
              </div>
              <button
                type="button"
                className="users-modal-close"
                onClick={() => {
                  setShowPasswordModal(false)
                  setSelectedUser(null)
                  setNewPassword('')
                }}
                aria-label="关闭"
              >
                <X className="users-modal-close-icon" />
              </button>
            </div>

            <div className="users-modal-body">
              <div className="users-field">
                <label className="users-field-label" htmlFor="reset-password">新密码</label>
                <input
                  id="reset-password"
                  type="text"
                  className="users-field-input"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="输入新密码"
                />
              </div>
            </div>

            <div className="users-modal-footer">
              <button
                type="button"
                className="users-secondary-button"
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
                className="users-primary-button"
                onClick={resetPassword}
                disabled={saving || !newPassword.trim()}
              >
                {saving ? (
                  <>
                    <span className="spinner-sm" />
                    重置中...
                  </>
                ) : (
                  <>
                    <Key className="users-primary-button-icon" />
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
