'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CommandMenu from '@/components/layout/CommandMenu';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';
import FloatingChat from '@/components/chat/FloatingChat';
import ChatNotificationSound from '@/components/chat/ChatNotificationSound';

import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { usePathname, useRouter } from 'next/navigation';
import {
  firstAllowedPagePath,
  normalizePageAccess,
  pageKeyForPathname,
} from '@/lib/auth/page-access';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pageAccessState, setPageAccessState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const pathname = usePathname();
  const router = useRouter();

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

    // 2. Mobile landing focus: if mobile screen and on home root, redirect to /chat
    if (typeof window !== 'undefined' && window.innerWidth < 768 && (pathname === '/' || pathname === '/dashboard')) {
      router.push('/chat');
    }

    // 3. Sidebar Collapsed State Listener
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
  }, [pathname, router]);

  useEffect(() => {
    if (isAuthenticated !== true) {
      setPageAccessState('checking');
      return;
    }

    const pageKey = pageKeyForPathname(pathname);
    if (!pageKey) {
      setPageAccessState('allowed');
      return;
    }

    let cancelled = false;
    setPageAccessState('checking');

    fetch('/api/clickup/user', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;

        // Keep the app usable while the optional page-access migration is not
        // deployed yet. Once the API returns access data, it becomes the source
        // of truth for members and clients.
        if (!data?.user) {
          setPageAccessState('allowed');
          return;
        }

        const role = String(data.user.app_role || '').toLowerCase();
        const hasFullAccess = data.user.is_superuser === true || role === 'owner' || role === 'admin';
        const access = normalizePageAccess(data.user.page_access);
        const allowed = hasFullAccess || access[pageKey] !== false;

        if (allowed) {
          setPageAccessState('allowed');
          return;
        }

        setPageAccessState('denied');
        const fallback = firstAllowedPagePath(access);
        if (fallback && fallback !== pathname) {
          router.replace(fallback);
        }
      })
      .catch(() => {
        if (!cancelled) setPageAccessState('allowed');
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, pathname, router]);

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

  if (isAuthenticated !== true || pageAccessState === 'checking') {
    return (
      <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center text-[#24324A]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#24324A]/20 border-t-[#F26B5E] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold tracking-wide">Memeriksa akses halaman...</p>
        </div>
      </div>
    );
  }

  if (pageAccessState === 'denied') {
    return (
      <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center text-[#24324A] p-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#FFF0ED] text-[#F26B5E] flex items-center justify-center mx-auto text-xl">!</div>
          <h1 className="text-base font-extrabold">Halaman Tidak Tersedia</h1>
          <p className="text-xs text-[#737680]">Admin Workspace menyembunyikan halaman ini untuk akun Anda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] text-[#202124] flex flex-col md:flex-row">
      {/* Collapsible Sidebar (Desktop) */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Container */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'pl-0 md:pl-16' : 'pl-0 md:pl-64'
        }`}
      >
        {/* Top Header Navigation */}
        <Header
          onOpenCommandMenu={() => setCommandMenuOpen(true)}
          onOpenCreateTask={() => setCreateTaskOpen(true)}
        />

        {/* Page Content Area - Responsive Fill */}
        <main className="flex-1 p-3 md:p-6 lg:p-8 w-full max-w-[1800px] mx-auto transition-all duration-300 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Floating Bottom Navigation for Mobile & Tablet */}
      <MobileBottomNav />

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

      <FloatingChat />
      <ChatNotificationSound />
    </div>
  );
}
