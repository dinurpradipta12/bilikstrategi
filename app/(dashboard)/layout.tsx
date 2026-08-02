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

  useEffect(() => {
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
