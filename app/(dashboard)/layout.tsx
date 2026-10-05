'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CommandMenu from '@/components/layout/CommandMenu';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';
import HolidayAccessBlock, { type HolidayAccessSnapshot } from '@/components/auth/HolidayAccessBlock';
import FloatingAttendance from '@/components/attendance/FloatingAttendance';
import AppPresenceTracker from '@/components/attendance/AppPresenceTracker';

import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { usePathname, useRouter } from 'next/navigation';
import {
  firstAllowedPagePath,
  normalizePageAccess,
  pageKeyForPathname,
} from '@/lib/auth/page-access';
import { hasUnrestrictedPageAccess } from '@/lib/auth/app-role';
import { useBranding } from '@/components/branding/BrandingProvider';
import { teamModuleForPage } from '@/lib/branding/types';

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
  const { branding } = useBranding();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.user) throw new Error('Sesi tidak ditemukan.');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.user.must_change_password && pathname !== '/change-password') {
          router.replace('/change-password');
          return;
        }
        setIsAuthenticated(true);
      })
      .catch(() => {
        if (cancelled) return;
        setIsAuthenticated(false);
        router.replace('/login');
      });

    // 3. Sidebar Collapsed State Listener
    const checkState = () => {
      const isCollapsed = localStorage.getItem('bilik_sidebar_collapsed') === 'true';
      setSidebarCollapsed(isCollapsed);
    };

    checkState();
    window.addEventListener('sidebar-toggle', checkState);
    window.addEventListener('storage', checkState);

    return () => {
      cancelled = true;
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

    fetch('/api/native/user', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;

        if (!data?.user) {
          setPageAccessState('denied');
          router.replace('/login');
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

        const moduleKey = teamModuleForPage(pageKey);
        const moduleEnabled = !moduleKey || branding.modules_enabled[moduleKey] !== false;
        const ownerOnly = pageKey === 'finance' || pageKey === 'salary_slips' || pageKey === 'profitability';
        const allowed = moduleEnabled && (!ownerOnly || role === 'owner')
          && (hasFullAccess || access[pageKey] !== false);

        if (allowed) {
          setPageAccessState('allowed');
          return;
        }

        setPageAccessState('denied');
        const fallback = firstAllowedPagePath({
          ...access,
          ...Object.fromEntries(Object.keys(access).map((key) => {
            const keyForModule = teamModuleForPage(key);
            return [key, access[key as keyof typeof access] && (!keyForModule || branding.modules_enabled[keyForModule] !== false)];
          })),
        });
        if (fallback && fallback !== pathname) {
          router.replace(fallback);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPageAccessState('denied');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, pathname, router, branding.modules_enabled]);

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
    <div data-app-shell className="min-h-screen bg-[#F7F7F8] text-[#202124] flex flex-col md:flex-row">
      {/* Collapsible Sidebar (Desktop) */}
      <div data-sidebar-layer className="hidden md:block">
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
      {branding.modules_enabled.attendance && <AppPresenceTracker />}
      {branding.modules_enabled.attendance && <FloatingAttendance />}

      {/* Global Command Menu (Cmd+K) */}
      <CommandMenu
        isOpen={commandMenuOpen}
        onClose={() => setCommandMenuOpen(false)}
        onOpenCreateTask={() => setCreateTaskOpen(true)}
      />

      {/* Quick Create Task Modal */}
      {branding.modules_enabled.tasks && <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
      />}

    </div>
  );
}
