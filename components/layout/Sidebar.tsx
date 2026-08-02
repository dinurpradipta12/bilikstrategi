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
} from 'lucide-react';
import { MOCK_USERS } from '@/lib/mock/data';

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [userProfile, setUserProfile] = useState({
    name: MOCK_USERS[0].full_name,
    role: 'owner',
    avatar: MOCK_USERS[0].avatar_url,
  });

  const [chatUnread, setChatUnread] = useState<number>(0);
  const [notifUnread, setNotifUnread] = useState<number>(0);

  useEffect(() => {
    async function loadClickUpProfile() {
      let username = 'Dinur Pradipta';
      let email = 'snllabsarchive@gmail.com';
      let avatar = '';

      const savedUserStr = localStorage.getItem('bilik_current_user');
      if (savedUserStr) {
        try {
          const u = JSON.parse(savedUserStr);
          if (u.username) username = u.username;
          if (u.email) email = u.email;
          if (u.avatar) avatar = u.avatar;
        } catch {}
      }

      try {
        const userRes = await fetch('/api/clickup/user');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user) {
            username = userData.user.username || username;
            email = userData.user.email || email;
            if (userData.user.profilePicture) avatar = userData.user.profilePicture;
          }
        }
      } catch (err) {
        console.warn('[Sidebar] ClickUp profile fetch failed, using default workspace profile.', err);
      }

      const isSuperOwner = email.toLowerCase().trim() === 'snllabsarchive@gmail.com';
      let resolvedRole = isSuperOwner ? 'Owner' : 'Member';

      if (!isSuperOwner) {
        const savedTeamStr = localStorage.getItem('bilik_team_members');
        if (savedTeamStr) {
          try {
            const parsed = JSON.parse(savedTeamStr);
            if (Array.isArray(parsed)) {
              const found = parsed.find(
                (m: any) =>
                  (m.email && m.email.toLowerCase().trim() === email.toLowerCase().trim()) ||
                  (m.name && m.name.toLowerCase().trim() === username.toLowerCase().trim())
              );
              if (found && found.role) {
                resolvedRole = found.role;
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
    }

    loadClickUpProfile();

    const handleStorage = () => loadClickUpProfile();
    window.addEventListener('storage', handleStorage);

    // Check if badges were previously read/cleared by user
    const isChatRead = localStorage.getItem('bilik_chat_read') === 'true';
    const isNotifRead = localStorage.getItem('bilik_notif_read') === 'true';

    setChatUnread(isChatRead ? 0 : 3);
    setNotifUnread(isNotifRead ? 0 : 2);

    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Clear unread badge immediately when user visits the respective page
  useEffect(() => {
    if (pathname.startsWith('/chat')) {
      setChatUnread(0);
      localStorage.setItem('bilik_chat_read', 'true');
    }
    if (pathname.startsWith('/notifications')) {
      setNotifUnread(0);
      localStorage.setItem('bilik_notif_read', 'true');
    }
  }, [pathname]);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: Briefcase },
    { name: 'ClickUp Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'My Tasks', href: '/my-tasks', icon: ListTodo },
    { name: 'Timeline', href: '/timeline', icon: GanttChartSquare },
    { name: 'Team Workload', href: '/team', icon: Users },
    { name: 'Presensi Live', href: '/attendance', icon: Clock },
    { name: 'Client Listing', href: '/clients', icon: Building2 },
    { name: 'Asset Management', href: '/assets', icon: FolderArchive },
    { name: 'Content Plan & Sheets', href: '/content-plan', icon: FileSpreadsheet },
    { name: 'Agency Chat', href: '/chat', icon: MessageSquare, badge: chatUnread > 0 ? chatUnread : undefined },
    { name: 'Notifications', href: '/notifications', icon: Bell, badge: notifUnread > 0 ? notifUnread : undefined },
    { name: 'Activity Log', href: '/activity-logs', icon: History },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

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
              src="/landscape.png"
              alt="Bilik Strategi Workspace"
              className="h-9 max-w-[170px] object-contain"
            />
          </Link>
        ) : (
          <Link href="/dashboard" className="flex items-center justify-center p-1 rounded-lg hover:bg-[#F7F7F8] transition-colors flex-shrink-0" title="Bilik Strategi Workspace">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logobilik-hitam.png"
              alt="Bilik Strategi Workspace"
              className="w-7 h-7 object-contain"
            />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-[#737680] hover:bg-[#F7F7F8] hover:text-[#202124] transition-colors flex-shrink-0"
          title={collapsed ? 'Perluas Sidebar' : 'Perkecil Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#EEF2F7] text-[#24324A] font-semibold shadow-2xs'
                  : 'text-[#737680] hover:bg-[#F7F7F8] hover:text-[#202124]'
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
      <div className="p-3 border-t border-[#E8E8EC] bg-[#F7F7F8]">
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
