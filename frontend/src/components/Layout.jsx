import React, { useState, useMemo } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Home,
  List,
  FileText,
  Folder,
  Clock,
  Settings,
  Users,
  ClipboardList,
  Menu,
  X,
  UserCircle,
  LogOut,
  ChevronDown
} from 'lucide-react'

const navigation = [
  { name: '仪表板', href: '/dashboard', icon: Home },
  { name: '任务队列', href: '/tasks', icon: List },
  { name: '转录结果', href: '/results', icon: FileText },
  { name: '资源管理', href: '/resources', icon: Folder }
]

const adminNavigation = [
  { name: '用户管理', href: '/users', icon: Users },
  { name: '调度器', href: '/scheduler', icon: Clock },
  { name: '系统设置', href: '/settings', icon: Settings },
  { name: '活动日志', href: '/activity', icon: ClipboardList }
]

const getDisplayName = (user) => {
  if (!user) return '访客'
  if (user.first_name && user.first_name.trim().length > 0) {
    return user.first_name.trim()
  }
  if (user.username && user.username.trim().length > 0) {
    return user.username.trim()
  }
  if (user.email && user.email.includes('@')) {
    return user.email.split('@')[0]
  }
  return '用户'
}

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { user, signOut, isAdmin } = useAuth()
  const location = useLocation()

  const displayName = useMemo(() => getDisplayName(user), [user])

  const handleSignOut = (e) => {
    e.preventDefault()
    e.stopPropagation()
    closeUserMenu()
    signOut()
    // 使用 setTimeout 确保 signOut 完成
    setTimeout(() => {
      window.location.href = '/signin'
    }, 100)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  const toggleUserMenu = () => {
    setUserMenuOpen((prev) => !prev)
  }

  const closeUserMenu = () => {
    setUserMenuOpen(false)
  }

  const isCurrentPath = (path) => location.pathname === path

  const renderLinks = (items) =>
    items.map((item) => {
      const Icon = item.icon
      const active = isCurrentPath(item.href)
      return (
        <Link
          key={item.name}
          to={item.href}
          className={`app-nav-link${active ? ' is-active' : ''}`}
          onClick={() => {
            closeSidebar()
            closeUserMenu()
          }}
        >
          <Icon className="app-nav-icon" />
          <span>{item.name}</span>
        </Link>
      )
    })

  return (
    <div className="app-shell">
      <aside className={`app-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <div className="app-sidebar-header">
          <div className="app-sidebar-title">语迹（EchoTrace）</div>
          <button
            type="button"
            className="app-sidebar-close"
            onClick={closeSidebar}
            aria-label="关闭导航"
          >
            <X className="app-sidebar-close-icon" />
          </button>
        </div>
        <div className="app-sidebar-body">
          <nav className="app-nav" aria-label="主导航">
            {renderLinks(navigation)}
            {isAdmin && (
              <>
                <div className="app-nav-divider" role="presentation" />
                <p className="app-nav-heading">管理员功能</p>
                {renderLinks(adminNavigation)}
              </>
            )}
          </nav>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="app-sidebar-overlay"
          aria-label="关闭导航遮罩"
          onClick={closeSidebar}
        />
      )}

      <div className="app-main">
        <header className="app-header">
          <button
            type="button"
            className="app-header-menu"
            onClick={() => setSidebarOpen(true)}
            aria-expanded={sidebarOpen}
            aria-label="打开导航"
          >
            <Menu className="app-header-menu-icon" />
          </button>

          <div className="app-header-right">
            <button
              type="button"
              className={`app-header-user-trigger${userMenuOpen ? ' is-open' : ''}`}
              onClick={toggleUserMenu}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <div className="app-header-avatar">
                <UserCircle className="app-header-avatar-icon" />
              </div>
              <div className="app-header-user-meta">
                <span className="app-header-name">{displayName}</span>
                {user?.email && <span className="app-header-meta">{user.email}</span>}
              </div>
              <ChevronDown className="app-header-trigger-icon" />
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="app-user-menu-overlay"
                  aria-label="关闭用户菜单"
                  onClick={closeUserMenu}
                />
                <div className="app-user-menu" role="menu">
                  <div className="app-user-menu-actions">
                    {isAdmin && (
                      <Link
                        to="/settings"
                        className="app-user-menu-item"
                        role="menuitem"
                        onClick={closeUserMenu}
                      >
                        <Settings className="app-user-menu-item-icon" />
                        <span>系统设置</span>
                      </Link>
                    )}
                    <button
                      type="button"
                      className="app-user-menu-item is-danger"
                      role="menuitem"
                      onClick={handleSignOut}
                    >
                      <LogOut className="app-user-menu-item-icon" />
                      <span>退出登录</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="app-content">
          <div className="app-content-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
