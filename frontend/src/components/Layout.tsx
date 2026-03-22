import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          {!collapsed && (
            <span className="font-display text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
              IDS Phase Editor
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          <Link
            to="/"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              location.pathname === '/'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
            </svg>
            {!collapsed && <span>Projects</span>}
          </Link>
        </nav>

        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          {!collapsed && (
            <p className="text-xs text-gray-400 dark:text-gray-600">openBIM Hackathon 2026</p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
