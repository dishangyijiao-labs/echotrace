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
  ChevronDown,
  HardDrive
} from 'lucide-react'

const navigation = [
  { name: '仪表板', href: '/dashboard', icon: Home },
  { name: '任务队列', href: '/tasks', icon: List },
  { name: '转录结果', href: '/results', icon: FileText },
  { name: '资源管理', href: '/resources', icon: Folder },
  { name: 'NAS管理', href: '/nas', icon: HardDrive }
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
          className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
            active
              ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
          onClick={() => {
            closeSidebar()
            closeUserMenu()
          }}
        >
          <Icon className={`mr-3 flex-shrink-0 h-5 w-5 transition-colors duration-200 ${
            active ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
          }`} />
          <span>{item.name}</span>
        </Link>
      )
    })

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="text-xl font-bold text-gray-900">语迹（EchoTrace）</div>
          <button
            type="button"
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 lg:hidden"
            onClick={closeSidebar}
            aria-label="关闭导航"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 px-4 py-6 overflow-y-auto">
          <nav className="space-y-1" aria-label="主导航">
            {renderLinks(navigation)}
            {isAdmin && (
              <>
                <div className="my-6 border-t border-gray-200" role="presentation" />
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">管理员功能</p>
                <div className="mt-3 space-y-1">
                  {renderLinks(adminNavigation)}
                </div>
              </>
            )}
          </nav>
        </div>
      </aside>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          aria-label="关闭导航遮罩"
          onClick={closeSidebar}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-expanded={sidebarOpen}
              aria-label="打开导航"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-4 ml-auto">
              <div className="relative">
                <button
                  type="button"
                  className={`flex items-center space-x-3 p-2 rounded-lg text-sm bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    userMenuOpen ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                  }`}
                  onClick={toggleUserMenu}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="flex-shrink-0">
                    <UserCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                    {user?.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      aria-label="关闭用户菜单"
                      onClick={closeUserMenu}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5" role="menu">
                      <div className="py-1">
                        {isAdmin && (
                          <Link
                            to="/settings"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            role="menuitem"
                            onClick={closeUserMenu}
                          >
                            <Settings className="w-4 h-4 mr-3 text-gray-400" />
                            <span>系统设置</span>
                          </Link>
                        )}
                        <button
                          type="button"
                          className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                          role="menuitem"
                          onClick={handleSignOut}
                        >
                          <LogOut className="w-4 h-4 mr-3 text-red-400" />
                          <span>退出登录</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
