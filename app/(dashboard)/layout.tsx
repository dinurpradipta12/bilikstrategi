'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CommandMenu from '@/components/layout/CommandMenu';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';
import HolidayAccessBlock, { type HolidayAccessSnapshot } from '@/components/auth/HolidayAccessBlock';
import FloatingAttendance from '@/components/attendance/FloatingAttendance';

import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { usePathname, useRouter } from 'next/navigation';
import {
  firstAllowedPagePath,
  normalizePageAccess,
  pageKeyForPathname,
} from '@/lib/auth/page-access';
import { hasUnrestrictedPageAccess } from '@/lib/auth/app-role';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [pageAccessState, setPageAccessState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [holidayAccessState, setHolidayAccessState] = useState<'checking' | 'allowed' | 'blocked'>('checking');
  const [holidayAccess, setHolidayAccess] = useState<HolidayAccessSnapshot | null>(null);
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

    // Mobile starts in Presensi while the chat feature is paused globally.
    if (
      typeof window !== 'undefined' &&
      window.innerWidth < 768 &&
      (pathname === '/' || pathname === '/dashboard' || pathname.startsWith('/chat'))
    ) {
      router.replace('/attendance');
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
        const hasFullAccess = hasUnrestrictedPageAccess({
          appRole: role,
          isSuperuser: data.user.is_superuser,
        });
        const access = normalizePageAccess(data.user.page_access);

        if (!pageKey) {
          setPageAccessState('allowed');
          return;
        }

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
        if (!cancelled) {
          setPageAccessState('allowed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, pathname, router]);

  useEffect(() => {
    if (isAuthenticated !== true) {
      setHolidayAccessState('checking');
      setHolidayAccess(null);
      return;
    }

    let cancelled = false;

    const loadHolidayAccess = async () => {
      try {
        const response = await fetch('/api/attendance/schedule', {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (!cancelled) setHolidayAccessState('allowed');
          return;
        }

        const data = await response.json().catch(() => ({}));
        const access = data?.access;

        // Holiday enforcement stays fail-open until the schedule migration and
        // server service key are both available, preventing accidental lockout.
        if (
          cancelled ||
          data?.storage_ready !== true ||
          data?.access_control_ready !== true ||
          access?.allowed !== false
        ) {
          if (!cancelled) {
            setHolidayAccess(null);
            setHolidayAccessState('allowed');
          }
          return;
        }

        setHolidayAccess({
          date: String(access.date || ''),
          nextWorkingLabel: String(access.next_working_label || 'jadwal kerja berikutnya'),
          requestStatus: ['pending', 'approved', 'rejected'].includes(String(access.request_status))
            ? access.request_status
            : 'none',
          requestReason: access.request?.reason ? String(access.request.reason) : undefined,
        });
        setHolidayAccessState('blocked');
      } catch {
        // A temporary API or database failure must not lock out the workspace.
        if (!cancelled) {
          setHolidayAccess(null);
          setHolidayAccessState('allowed');
        }
      }
    };

    loadHolidayAccess();
    const interval = window.setInterval(loadHolidayAccess, 10000);
    window.addEventListener('focus', loadHolidayAccess);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', loadHolidayAccess);
    };
  }, [isAuthenticated]);

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

  if (
    isAuthenticated !== true ||
    pageAccessState === 'checking' ||
    holidayAccessState === 'checking'
  ) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center text-[#24324A]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#24324A]/20 border-t-[#F26B5E] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold tracking-wide">Memeriksa akses halaman...</p>
        </div>
      </div>
    );
  }

  if (holidayAccessState === 'blocked' && holidayAccess) {
    return <HolidayAccessBlock access={holidayAccess} />;
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

      {/* Presensi controls stay mounted while navigating between dashboard pages. */}
      <FloatingAttendance />

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
