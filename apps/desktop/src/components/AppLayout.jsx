import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Folder,
  ListTodo,
  Terminal,
  KeyRound,
  SlidersHorizontal,
  FileText,
  Menu,
  X,
  Sparkles
} from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t } = useTranslation();

  const navigation = [
    { name: t('nav.dashboard'), href: "/dashboard", icon: LayoutDashboard },
    { name: t('nav.resources'), href: "/resources", icon: Folder },
    { name: t('nav.taskQueue'), href: "/tasks", icon: ListTodo },
    { name: t('nav.results'), href: "/results", icon: FileText },
    { name: "AI 搜索", href: "/ai-search", icon: Sparkles },
    { name: t('nav.services'), href: "/services", icon: Terminal },
    { name: t('nav.models'), href: "/models", icon: KeyRound },
    { name: t('nav.settings'), href: "/settings", icon: SlidersHorizontal }
  ];

  const isCurrent = (path) => location.pathname === path;

  return (
    <div className="flex h-screen bg-gray-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div>
            <div className="text-lg font-bold text-gray-900">EchoTrace</div>
            <div className="text-xs text-gray-500">Desktop MVP</div>
          </div>
          <button
            type="button"
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭导航"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="px-4 py-6 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isCurrent(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  active
                    ? "bg-blue-50 text-blue-700 border-r-2 border-blue-500"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon
                  className={`mr-3 h-5 w-5 transition-colors duration-200 ${
                    active
                      ? "text-blue-500"
                      : "text-gray-400 group-hover:text-gray-500"
                  }`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭导航遮罩"
        />
      ) : null}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="打开导航"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="ml-auto flex items-center gap-4">
              <LanguageSwitcher />
              <div className="text-sm text-gray-500">
                Local-only transcription workspace
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
