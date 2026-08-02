'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CommandMenu from '@/components/layout/CommandMenu';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. Strict Authentication Check for All Dashboard Routes
    const checkAuth = () => {
      const hasCookieLoggedIn =
        document.cookie.includes('clickup_logged_in=true') ||
        document.cookie.includes('clickup_access_token');
      const hasLocalStorageLoggedIn =
        localStorage.getItem('clickup_logged_in') === 'true' ||
        !!localStorage.getItem('bilik_current_user');

      if (!hasCookieLoggedIn && !hasLocalStorageLoggedIn) {
        setIsAuthenticated(false);
        window.location.href = '/login';
      } else {
        setIsAuthenticated(true);
      }
    };

    checkAuth();

    // 2. Sidebar Collapsed State Listener
    const checkState = () => {
      const isCollapsed = localStorage.getItem('bilik_sidebar_collapsed') === 'true';
      setSidebarCollapsed(isCollapsed);
    };

    checkState();
    window.addEventListener('sidebar-toggle', checkState);
    window.addEventListener('storage', checkState);

    return () => {
      window.removeEventListener('sidebar-toggle', checkState);
      window.removeEventListener('storage', checkState);
    };
  }, []);

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-[#24324A] flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold tracking-wide">Mengarahkan ke Halaman Login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] text-[#202124] flex">
      {/* Collapsible Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'pl-16' : 'pl-64'
        }`}
      >
        {/* Top Header Navigation */}
        <Header
          onOpenCommandMenu={() => setCommandMenuOpen(true)}
          onOpenCreateTask={() => setCreateTaskOpen(true)}
        />

        {/* Page Content Area - Responsive Fill Without Huge Empty Side Gaps */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-[1800px] mx-auto transition-all duration-300">
          {children}
        </main>
      </div>

      {/* Global Command Menu (Cmd+K) */}
      <CommandMenu
        isOpen={commandMenuOpen}
        onClose={() => setCommandMenuOpen(false)}
        onOpenCreateTask={() => setCreateTaskOpen(true)}
      />

      {/* Quick Create Task Modal */}
      <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
      />
    </div>
  );
}
