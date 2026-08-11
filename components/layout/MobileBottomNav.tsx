'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, CheckSquare, FolderKanban, Target } from 'lucide-react';
import { DEFAULT_PAGE_ACCESS, normalizePageAccess, type PageAccessKey } from '@/lib/auth/page-access';
import ThemeToggle from '@/components/theme/ThemeToggle';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [pageAccess, setPageAccess] = useState(DEFAULT_PAGE_ACCESS);
  const [hasUnrestrictedPageAccess, setHasUnrestrictedPageAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/clickup/user', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data?.user) return;
        const role = String(data.user.app_role || '').toLowerCase();
        setHasUnrestrictedPageAccess(data.user.is_superuser === true || role === 'owner');
        setPageAccess(normalizePageAccess(data.user.page_access));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const navItems: Array<{
    id: string;
    accessKey: PageAccessKey;
    label: string;
    href: string;
    icon: typeof Clock;
    activeColor: string;
  }> = [
    {
      id: 'attendance',
      accessKey: 'attendance',
      label: 'Presensi',
      href: '/attendance',
      icon: Clock,
      activeColor: '#10B981',
    },
    {
      id: 'tasks',
      accessKey: 'tasks',
      label: 'Task',
      href: '/tasks',
      icon: CheckSquare,
      activeColor: '#7B68EE',
    },
    {
      id: 'projects',
      accessKey: 'projects',
      label: 'Project',
      href: '/projects',
      icon: FolderKanban,
      activeColor: '#3B82F6',
    },
    {
      id: 'performance',
      accessKey: 'performance',
      label: 'KPI',
      href: '/performance',
      icon: Target,
      activeColor: '#F26B5E',
    },
  ];
  const visibleNavItems = navItems.filter(
    (item) => hasUnrestrictedPageAccess || pageAccess[item.accessKey] !== false
  );

  return (
    <>
      <div className="fixed bottom-[6.25rem] right-5 z-[95] md:hidden pointer-events-auto">
        <ThemeToggle compact />
      </div>
      <div className="fixed bottom-4 left-4 right-4 z-[90] md:hidden pointer-events-auto">
        <nav className="bg-[#24324A]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl px-2 py-2 flex items-center justify-around">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
                  isActive
                    ? 'bg-white/10 text-white font-extrabold shadow-xs'
                    : 'text-[#8C9BAE] hover:text-white font-medium'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive ? 'scale-110' : ''
                    }`}
                    style={{ color: isActive ? item.activeColor : 'inherit' }}
                  />
                  {isActive && (
                    <span
                      className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full animate-pulse"
                      style={{ backgroundColor: item.activeColor }}
                    />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-1 leading-none">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
