'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  ListTodo,
  GanttChartSquare,
  Users,
  Clock,
  Building2,
  FolderArchive,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  FileSpreadsheet,
  ReceiptText,
  FileText,
  FileSignature,
  Wallet,
  Target,
  BadgeCheck,
  ChartNoAxesCombined,
  Zap,
} from 'lucide-react';
import { hasUnrestrictedPageAccess, isSuperuserEmail } from '@/lib/auth/app-role';
import { DEFAULT_PAGE_ACCESS, normalizePageAccess, type PageAccessKey } from '@/lib/auth/page-access';
import { useTheme } from '@/lib/theme';
import darkExpandedLogo from '@/src/lcputihbilik.png';
import darkCollapsedLogo from '@/src/whitebilik.png';

function subscribeSidebarState(onStoreChange: () => void) {
  window.addEventListener('sidebar-toggle', onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener('sidebar-toggle', onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

function getSidebarStateSnapshot() {
  return localStorage.getItem('bilik_sidebar_collapsed') === 'true';
}

function subscribeNotificationCount(onStoreChange: () => void) {
  const handleUnreadUpdate = (event: Event) => {
    const detail = (event as CustomEvent<{ type?: string; count?: number }>).detail;
    if (detail?.type === 'notification' && typeof detail.count === 'number') {
      localStorage.setItem('bilik_notif_unread_count', String(detail.count));
      onStoreChange();
    }
  };
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === 'bilik_notif_unread_count') onStoreChange();
  };
  window.addEventListener('unread-badge-update', handleUnreadUpdate);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener('unread-badge-update', handleUnreadUpdate);
    window.removeEventListener('storage', handleStorage);
  };
}

function getNotificationCountSnapshot() {
  return Number(localStorage.getItem('bilik_notif_unread_count') || '0');
}

type SavedTeamMember = {
  email?: unknown;
  name?: unknown;
  role?: unknown;
  page_access?: unknown;
};

export default function Sidebar() {
  const pathname = usePathname();
  const { isDark } = useTheme();
  const collapsed = useSyncExternalStore(subscribeSidebarState, getSidebarStateSnapshot, () => false);
  const [userProfile, setUserProfile] = useState({
    name: 'Bilik Strategi',
    role: 'member',
    avatar: 'https://ui-avatars.com/api/?name=Bilik%20Strategi&background=24324A&color=fff',
    unrestrictedPageAccess: false,
    ownerAccount: false,
    managerAccount: false,
  });

  const notifUnread = useSyncExternalStore(subscribeNotificationCount, getNotificationCountSnapshot, () => 0);
  const [pageAccess, setPageAccess] = useState(DEFAULT_PAGE_ACCESS);
  const [openNavGroup, setOpenNavGroup] = useState<string | null>(null);

  const handleToggleCollapsed = () => {
    const nextState = !collapsed;
    if (nextState) setOpenNavGroup(null);
    localStorage.setItem('bilik_sidebar_collapsed', String(nextState));
    window.dispatchEvent(new Event('sidebar-toggle'));
  };

  const handleToggleNavGroup = (groupId: string) => {
    if (collapsed) {
      setOpenNavGroup(groupId);
      localStorage.setItem('bilik_sidebar_collapsed', 'false');
      window.dispatchEvent(new Event('sidebar-toggle'));
      return;
    }
    setOpenNavGroup((current) => current === groupId ? null : groupId);
  };

  useEffect(() => {
    async function loadClickUpProfile() {
      let username = 'Dinur Pradipta';
      let email = 'snllabsarchive@gmail.com';
      let avatar = '';
      let serverAppRole = '';
      let serverIsSuperuser = false;
      let resolvedPageAccess = normalizePageAccess(undefined);

      const savedUserStr = localStorage.getItem('bilik_current_user');
      if (savedUserStr) {
        try {
          const u = JSON.parse(savedUserStr);
          if (u.username) username = String(u.username);
          if (u.email) email = String(u.email);
          if (u.avatar) avatar = String(u.avatar);
        } catch {}
      }

      try {
        const userRes = await fetch('/api/clickup/user');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user) {
            username = String(userData.user.username || username);
            email = String(userData.user.email || email);
            serverAppRole = String(userData.user.app_role || '').toLowerCase();
            serverIsSuperuser = userData.user.is_superuser === true;
            resolvedPageAccess = normalizePageAccess(userData.user.page_access);
            if (userData.user.profilePicture) avatar = String(userData.user.profilePicture);
          }
        }
      } catch (err) {
        console.warn('[Sidebar] ClickUp profile fetch failed, using default workspace profile.', err);
      }

      const isSuperOwner = serverIsSuperuser || isSuperuserEmail(email);
      let resolvedRole = isSuperOwner ? 'Owner' : serverAppRole === 'owner' ? 'Owner' : serverAppRole === 'admin' ? 'Admin' : 'Member';

      if (!isSuperOwner && !serverAppRole) {
        const savedTeamStr = localStorage.getItem('bilik_team_members');
        if (savedTeamStr) {
          try {
            const parsed = JSON.parse(savedTeamStr);
            if (Array.isArray(parsed)) {
              const found = (parsed as SavedTeamMember[]).find(
                (member) =>
                  (member.email && String(member.email).toLowerCase().trim() === email.toLowerCase().trim()) ||
                  (member.name && String(member.name).toLowerCase().trim() === username.toLowerCase().trim())
              );
              if (found && found.role) {
                resolvedRole = String(found.role);
              }
              if (found?.page_access) {
                resolvedPageAccess = normalizePageAccess(found.page_access);
              }
            }
          } catch {}
        }
      }

      setUserProfile({
        name: username,
        role: resolvedRole,
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=24324A&color=fff`,
        unrestrictedPageAccess: hasUnrestrictedPageAccess({
          appRole: serverAppRole || resolvedRole,
          isSuperuser: isSuperOwner,
        }),
        ownerAccount: isSuperuserEmail(email),
        managerAccount: isSuperOwner || ['owner', 'admin'].includes(serverAppRole) || ['owner', 'admin'].includes(String(resolvedRole).toLowerCase()),
      });
      setPageAccess(resolvedPageAccess);
    }

    loadClickUpProfile();

    const handleStorage = () => loadClickUpProfile();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('bilik-role-updated', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bilik-role-updated', handleStorage);
    };
  }, []);

  // Keep workspace notification counts visible until the user opens them.
  useEffect(() => {
    if (pathname.startsWith('/notifications')) {
      localStorage.setItem('bilik_notif_unread_count', '0');
      window.dispatchEvent(new CustomEvent('unread-badge-update', { detail: { type: 'notification', count: 0 } }));
    }
  }, [pathname]);

  const navItems: Array<{
    key: PageAccessKey | 'finance' | 'salary_slips';
    name: string;
    href: string;
    icon: typeof LayoutDashboard;
    badge?: number;
    ownerOnly?: boolean;
    managerOnly?: boolean;
  }> = [
    { key: 'dashboard', name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { key: 'projects', name: 'Projects', href: '/projects', icon: Briefcase },
    { key: 'tasks', name: 'ClickUp Tasks', href: '/tasks', icon: CheckSquare },
    { key: 'my_tasks', name: 'My Tasks', href: '/my-tasks', icon: ListTodo },
    { key: 'timeline', name: 'Timeline', href: '/timeline', icon: GanttChartSquare },
    { key: 'team', name: 'Team Workload', href: '/team', icon: Users },
    { key: 'performance', name: 'KPI & Daily Activity', href: '/performance', icon: Target },
    { key: 'approvals', name: 'Approval Center', href: '/approvals', icon: BadgeCheck },
    { key: 'profitability', name: 'Project Profitability', href: '/profitability', icon: ChartNoAxesCombined, managerOnly: true },
    { key: 'automations', name: 'Automation Center', href: '/automations', icon: Zap, managerOnly: true },
    { key: 'attendance', name: 'Presensi Live', href: '/attendance', icon: Clock },
    { key: 'clients', name: 'Client Listing', href: '/clients', icon: Building2 },
    { key: 'assets', name: 'Asset Management', href: '/assets', icon: FolderArchive },
    { key: 'content_plan', name: 'Content Plan & Sheets', href: '/content-plan', icon: FileSpreadsheet },
    { key: 'invoices', name: 'Invoices', href: '/invoices', icon: ReceiptText },
    { key: 'finance', name: 'Finance & Budget', href: '/finance', icon: Wallet, ownerOnly: true },
    { key: 'salary_slips', name: 'Slip Gaji', href: '/salary-slips', icon: FileText, ownerOnly: true },
    { key: 'quotes', name: 'Penawaran Harga', href: '/quotes', icon: FileText },
    { key: 'agreements', name: 'Collaboration Agreement', href: '/agreements', icon: FileSignature },
    { key: 'notifications', name: 'Notifications', href: '/notifications', icon: Bell, badge: notifUnread > 0 ? notifUnread : undefined },
    { key: 'settings', name: 'Settings', href: '/settings', icon: Settings },
  ];
  const visibleNavItems = navItems.filter((item) => {
    if (item.ownerOnly) return userProfile.ownerAccount;
    if (item.managerOnly) return userProfile.managerAccount;
    return userProfile.unrestrictedPageAccess || pageAccess[item.key as PageAccessKey] !== false;
  });
  const dashboardItem = visibleNavItems.find((item) => item.key === 'dashboard');
  const navGroups = [
    {
      id: 'projects-work',
      name: 'Project & Pekerjaan',
      icon: Briefcase,
      keys: ['projects', 'tasks', 'my_tasks', 'timeline'],
    },
    {
      id: 'team-performance',
      name: 'Tim & Performa',
      icon: Users,
      keys: ['team', 'performance', 'approvals', 'attendance'],
    },
    {
      id: 'operations-documents',
      name: 'Operasional & Dokumen',
      icon: FolderArchive,
      keys: ['clients', 'assets', 'content_plan', 'invoices', 'quotes', 'agreements'],
    },
    {
      id: 'workspace',
      name: 'Workspace',
      icon: Settings,
      keys: ['notifications', 'settings'],
    },
    {
      id: 'owner-admin',
      name: 'Owner / Admin',
      icon: ShieldCheck,
      keys: ['profitability', 'automations', 'finance', 'salary_slips'],
    },
  ].map((group) => ({
    ...group,
    items: visibleNavItems.filter((item) => group.keys.includes(item.key)),
  })).filter((group) => group.items.length > 0);

  const renderNavItem = (item: typeof visibleNavItems[number], nested = false) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const Icon = item.icon;

    return (
      <Link
        key={item.name}
        href={item.href}
        className={`flex items-center rounded-lg border-l-2 border-transparent py-2.5 text-xs font-medium transition-colors ${
          isActive
            ? 'border-[#F26B5E] bg-[#FFF0ED] text-[#24324A] font-semibold dark:bg-[#472925] dark:text-[#F4F6FA]'
            : 'text-[#737680] hover:bg-[#F7F7F8] hover:text-[#202124] dark:text-[#AAB4C5] dark:hover:bg-[#282D36] dark:hover:text-[#F4F6FA]'
        } ${collapsed ? 'justify-center px-3' : nested ? 'px-3 pl-4' : 'px-3'}`}
        title={collapsed ? item.name : undefined}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#F26B5E]' : ''} ${collapsed ? '' : 'mr-3'}`} />
        {!collapsed && <span className="truncate">{item.name}</span>}
        {!collapsed && item.badge && (
          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#F26B5E] rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const renderNavGroup = (group: typeof navGroups[number]) => {
    const isOpen = openNavGroup === group.id;
    const isGroupActive = group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'));
    const GroupIcon = group.icon;
    const groupBadge = group.items.reduce((sum, item) => sum + (item.badge || 0), 0);

    return (
      <div key={group.id} className="space-y-1">
        <button
          type="button"
          onClick={() => handleToggleNavGroup(group.id)}
          aria-expanded={!collapsed && isOpen}
          aria-controls={`sidebar-group-${group.id}`}
          className={`relative flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-colors ${
            isGroupActive
              ? 'bg-[#F7F7F8] text-[#24324A] dark:bg-[#282D36] dark:text-[#F4F6FA]'
              : 'text-[#737680] hover:bg-[#F7F7F8] hover:text-[#202124] dark:text-[#AAB4C5] dark:hover:bg-[#282D36] dark:hover:text-[#F4F6FA]'
          } ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? group.name : undefined}
        >
          <GroupIcon className={`h-4 w-4 shrink-0 ${isGroupActive ? 'text-[#F26B5E]' : ''} ${collapsed ? '' : 'mr-3'}`} />
          {!collapsed && <span className="min-w-0 flex-1 truncate">{group.name}</span>}
          {!collapsed && groupBadge > 0 && <span className="mr-2 rounded-full bg-[#F26B5E] px-1.5 py-0.5 text-[10px] font-bold text-white">{groupBadge}</span>}
          {!collapsed && <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
          {collapsed && groupBadge > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#F26B5E]" />}
        </button>
        {!collapsed && isOpen && (
          <div id={`sidebar-group-${group.id}`} className="ml-5 space-y-1 border-l border-[#E8E8EC] pl-2 dark:border-[#3A414C]">
            {group.items.map((item) => renderNavItem(item, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-[#FFFFFF] border-r border-[#E8E8EC] transition-all duration-300 flex flex-col ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className={`h-16 flex items-center justify-between border-b border-[#E8E8EC] ${collapsed ? 'px-2' : 'px-4'}`}>
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isDark ? darkExpandedLogo.src : '/landscape.png'}
              alt="Bilik Strategi Workspace"
              className="h-9 max-w-[170px] object-contain"
            />
          </Link>
        ) : (
          <Link href="/dashboard" className="flex items-center justify-center p-1 rounded-lg hover:bg-[#F7F7F8] transition-colors flex-shrink-0" title="Bilik Strategi Workspace">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isDark ? darkCollapsedLogo.src : '/logobilik-hitam.png'}
              alt="Bilik Strategi Workspace"
              className="w-7 h-7 object-contain"
            />
          </Link>
        )}
        <button
          onClick={handleToggleCollapsed}
          className="p-1 rounded-md text-[#737680] hover:bg-[#F7F7F8] hover:text-[#202124] transition-colors flex-shrink-0 cursor-pointer"
          title={collapsed ? 'Perluas Sidebar' : 'Perkecil Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {dashboardItem && renderNavItem(dashboardItem)}
          {navGroups.map(renderNavGroup)}
        </div>
      </nav>

      {/* Footer Profile Box */}
      <div className="border-t border-[#E8E8EC] p-3">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={userProfile.avatar}
            alt={userProfile.name}
            className="w-8 h-8 rounded-full border border-[#E8E8EC] object-cover flex-shrink-0"
          />
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-[#202124] truncate">{userProfile.name}</span>
              <span className="text-[10px] text-[#737680] capitalize flex items-center">
                <ShieldCheck className="w-3 h-3 text-[#4F9D78] mr-1 inline" />
                {userProfile.role}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
