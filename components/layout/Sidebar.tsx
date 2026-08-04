'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  ListTodo,
  GanttChartSquare,
  CalendarDays,
  Users,
  Clock,
  Building2,
  FolderArchive,
  MessageSquare,
  Bell,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
  ReceiptText,
} from 'lucide-react';
import { isSuperuserEmail } from '@/lib/auth/app-role';
import { DEFAULT_PAGE_ACCESS, normalizePageAccess, type PageAccessKey } from '@/lib/auth/page-access';
import { useTheme } from '@/lib/theme';
import darkExpandedLogo from '@/src/lcputihbilik.png';
import darkCollapsedLogo from '@/src/whitebilik.png';

export default function Sidebar() {
  const pathname = usePathname();
  const { isDark } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [userProfile, setUserProfile] = useState({
    name: 'Bilik Strategi',
    role: 'owner',
    avatar: 'https://ui-avatars.com/api/?name=Bilik%20Strategi&background=24324A&color=fff',
  });

  const [chatUnread, setChatUnread] = useState<number>(0);
  const [notifUnread, setNotifUnread] = useState<number>(0);
  const [pageAccess, setPageAccess] = useState(DEFAULT_PAGE_ACCESS);

  useEffect(() => {
    const isCollapsedSaved = localStorage.getItem('bilik_sidebar_collapsed') === 'true';
    setCollapsed(isCollapsedSaved);
  }, []);

  const handleToggleCollapsed = () => {
    const nextState = !collapsed;
    setCollapsed(nextState);
    localStorage.setItem('bilik_sidebar_collapsed', String(nextState));
    window.dispatchEvent(new Event('sidebar-toggle'));
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
              const found = parsed.find(
                (m: any) =>
                  (m.email && String(m.email).toLowerCase().trim() === email.toLowerCase().trim()) ||
                  (m.name && String(m.name).toLowerCase().trim() === username.toLowerCase().trim())
              );
              if (found && found.role) {
                resolvedRole = found.role;
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
      });
      setPageAccess(
        resolvedRole === 'Owner' || resolvedRole === 'Admin'
          ? normalizePageAccess(undefined)
          : resolvedPageAccess
      );
    }

    loadClickUpProfile();

    const handleStorage = () => loadClickUpProfile();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('bilik-role-updated', handleStorage);

    // Read real-time unread badge counts (defaults to 0 when no unread messages/notifs exist)
    const savedChatUnread = Number(localStorage.getItem('bilik_chat_unread_count') || '0');
    const savedNotifUnread = Number(localStorage.getItem('bilik_notif_unread_count') || '0');

    setChatUnread(savedChatUnread);
    setNotifUnread(savedNotifUnread);

    const handleUnreadUpdate = (e: any) => {
      if (e.detail?.type === 'chat' && typeof e.detail?.count === 'number') {
        setChatUnread(e.detail.count);
        localStorage.setItem('bilik_chat_unread_count', String(e.detail.count));
      }
      if (e.detail?.type === 'notification' && typeof e.detail?.count === 'number') {
        setNotifUnread(e.detail.count);
        localStorage.setItem('bilik_notif_unread_count', String(e.detail.count));
      }
    };

    window.addEventListener('unread-badge-update', handleUnreadUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bilik-role-updated', handleStorage);
      window.removeEventListener('unread-badge-update', handleUnreadUpdate);
    };
  }, []);

  // Keep chat unread counts visible until the user opens the specific channel.
  useEffect(() => {
    if (pathname.startsWith('/notifications')) {
      setNotifUnread(0);
      localStorage.setItem('bilik_notif_unread_count', '0');
    }
  }, [pathname]);

  const navItems: Array<{
    key: PageAccessKey;
    name: string;
    href: string;
    icon: typeof LayoutDashboard;
    badge?: number;
  }> = [
    { key: 'dashboard', name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { key: 'projects', name: 'Projects', href: '/projects', icon: Briefcase },
    { key: 'tasks', name: 'ClickUp Tasks', href: '/tasks', icon: CheckSquare },
    { key: 'my_tasks', name: 'My Tasks', href: '/my-tasks', icon: ListTodo },
    { key: 'timeline', name: 'Timeline', href: '/timeline', icon: GanttChartSquare },
    { key: 'team', name: 'Team Workload', href: '/team', icon: Users },
    { key: 'attendance', name: 'Presensi Live', href: '/attendance', icon: Clock },
    { key: 'clients', name: 'Client Listing', href: '/clients', icon: Building2 },
    { key: 'assets', name: 'Asset Management', href: '/assets', icon: FolderArchive },
    { key: 'content_plan', name: 'Content Plan & Sheets', href: '/content-plan', icon: FileSpreadsheet },
    { key: 'invoices', name: 'Invoices', href: '/invoices', icon: ReceiptText },
    { key: 'chat', name: 'Agency Chat', href: '/chat', icon: MessageSquare, badge: chatUnread > 0 ? chatUnread : undefined },
    { key: 'notifications', name: 'Notifications', href: '/notifications', icon: Bell, badge: notifUnread > 0 ? notifUnread : undefined },
    { key: 'activity_logs', name: 'Activity Log', href: '/activity-logs', icon: History },
    { key: 'settings', name: 'Settings', href: '/settings', icon: Settings },
  ];
  const visibleNavItems = navItems.filter(
    (item) => userProfile.role === 'Owner' || userProfile.role === 'Admin' || pageAccess[item.key]
  );

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
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center border-l-2 border-transparent px-3 py-2.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-[#F26B5E] text-[#24324A] font-semibold'
                  : 'text-[#737680] hover:text-[#202124]'
              } ${collapsed ? 'justify-center' : ''}`}
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
        })}
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
