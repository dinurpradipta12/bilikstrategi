'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CommandMenu from '@/components/layout/CommandMenu';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F7F8] text-[#202124] flex">
      {/* Collapsible Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 pl-64 transition-all duration-300">
        {/* Top Header Navigation */}
        <Header
          onOpenCommandMenu={() => setCommandMenuOpen(true)}
          onOpenCreateTask={() => setCreateTaskOpen(true)}
        />

        {/* Page Content Area */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
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
