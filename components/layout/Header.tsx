'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, Bell, ChevronDown, LogOut, Settings, Hash, MessageSquare } from 'lucide-react';

import SyncUpButton from '@/components/syncup/SyncUpButton';
import {
  CHAT_NOTIFICATION_EVENT,
  getChatUnreadTotal,
  readChatNotifications,
  readChatUnreadMap,
  type ChatNotification,
  UNREAD_BADGE_EVENT,
} from '@/lib/chat/notification-store';
import ChatSoundToggle from '@/components/chat/ChatSoundToggle';
import { isSuperuserEmail } from '@/lib/auth/app-role';

interface HeaderProps {
  onOpenCommandMenu: () => void;
  onOpenCreateTask: () => void;
}

type AppWorkspace = {
  id: string;
  name: string;
  slug?: string;
};

export default function Header({ onOpenCommandMenu, onOpenCreateTask }: HeaderProps) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<AppWorkspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<AppWorkspace>({
    id: 'bilik-strategi',
    name: 'Bilik Strategi Workspace',
    slug: 'bilik-strategi',
  });
  const [userProfile, setUserProfile] = useState({
    name: 'Bilik Strategi',
    email: '',
    role: 'owner',
    avatar: 'https://ui-avatars.com/api/?name=Bilik%20Strategi&background=24324A&color=fff',
  });
  // Keep the server render identical to the first browser render. Browser-only
  // unread state is loaded in the effect below after hydration.
  const [chatUnread, setChatUnread] = useState(0);
  const [activityUnread, setActivityUnread] = useState(0);
  const [chatNotifications, setChatNotifications] = useState<ChatNotification[]>([]);

  const totalNotificationUnread = chatUnread + activityUnread;

  const openChatNotification = (notification: ChatNotification) => {
    localStorage.setItem('bilik_chat_open_channel', notification.channelId);
    window.dispatchEvent(new CustomEvent('bilik-open-chat-channel', {
      detail: { channelId: notification.channelId },
    }));
    setNotificationOpen(false);
  };

  useEffect(() => {
    setChatUnread(getChatUnreadTotal(readChatUnreadMap()));
    const storedActivityUnread = Number(localStorage.getItem('bilik_notif_unread_count') || '0');
    setActivityUnread(Number.isFinite(storedActivityUnread) ? storedActivityUnread : 0);
    setChatNotifications(readChatNotifications());

    const handleUnreadUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.type === 'chat' && typeof detail.count === 'number') {
        setChatUnread(detail.count);
      }
      if (detail?.type === 'notification' && typeof detail.count === 'number') {
        setActivityUnread(detail.count);
      }
    };

    const handleChatNotifications = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (Array.isArray(detail?.notifications)) {
        setChatNotifications(detail.notifications);
      }
      if (typeof detail?.count === 'number') {
        setChatUnread(detail.count);
      }
    };

    window.addEventListener(UNREAD_BADGE_EVENT, handleUnreadUpdate);
    window.addEventListener(CHAT_NOTIFICATION_EVENT, handleChatNotifications);
    return () => {
      window.removeEventListener(UNREAD_BADGE_EVENT, handleUnreadUpdate);
      window.removeEventListener(CHAT_NOTIFICATION_EVENT, handleChatNotifications);
    };
  }, []);

  const loadWorkspaces = async () => {
    try {
      const res = await fetch('/api/app/workspaces', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil workspace');
      const list: AppWorkspace[] = data.workspaces || [];
      const currentId = data.current_workspace_id || 'bilik-strategi';
      setWorkspaces(list);
      setActiveWorkspace(list.find((item) => item.id === currentId) || list[0] || activeWorkspace);
    } catch (err) {
      console.warn('[Header] Workspace fetch failed, using default workspace.', err);
    }
  };

  const selectWorkspace = async (workspace: AppWorkspace) => {
    setWorkspaceDropdownOpen(false);
    setActiveWorkspace(workspace);
    try {
      const res = await fetch('/api/app/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspace.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal memilih workspace');
      }
      window.dispatchEvent(new Event('bilik-workspace-updated'));
    } catch (err) {
      console.warn('[Header] Workspace switch failed:', err);
    }
  };

  useEffect(() => {
    async function loadClickUpProfile() {
      let currentEmail = '';
      let currentName = 'Bilik Strategi';
      let currentAvatar = '';
      let serverAppRole = '';
      let serverIsSuperuser = false;

      const savedUserStr = localStorage.getItem('bilik_current_user');
      if (savedUserStr) {
        try {
          const u = JSON.parse(savedUserStr);
          if (u.email) currentEmail = String(u.email);
          if (u.username) currentName = String(u.username);
          if (u.avatar) currentAvatar = String(u.avatar);
        } catch {}
      }

      try {
        const res = await fetch('/api/clickup/user');
        const data = await res.json();
        if (data.user) {
          currentName = String(data.user.username || currentName);
          currentEmail = String(data.user.email || currentEmail);
          serverAppRole = String(data.user.app_role || '').toLowerCase();
          serverIsSuperuser = data.user.is_superuser === true;
          if (data.user.profilePicture) currentAvatar = String(data.user.profilePicture);
        }
      } catch (err) {
        console.warn('[Header] ClickUp profile fetch failed, using default workspace profile.', err);
      }

      const isSuperOwner = serverIsSuperuser || isSuperuserEmail(currentEmail);
      let finalRole = isSuperOwner ? 'Owner' : serverAppRole === 'owner' ? 'Owner' : serverAppRole === 'admin' ? 'Admin' : 'Member';

      if (!isSuperOwner && !serverAppRole) {
        const savedTeamStr = localStorage.getItem('bilik_team_members');
        if (savedTeamStr) {
          try {
            const parsed = JSON.parse(savedTeamStr);
            if (Array.isArray(parsed)) {
              const found = parsed.find(
                (m: any) =>
                  (m.email && String(m.email).toLowerCase().trim() === currentEmail.toLowerCase().trim()) ||
                  (m.name && String(m.name).toLowerCase().trim() === currentName.toLowerCase().trim())
              );
              if (found && found.role) {
                finalRole = found.role;
              }
            }
          } catch {}
        }
      }

      setUserProfile({
        name: currentName,
        email: currentEmail,
        role: finalRole,
        avatar: currentAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentName)}&background=24324A&color=fff`,
      });
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

  useEffect(() => {
    loadWorkspaces();
    window.addEventListener('bilik-workspace-updated', loadWorkspaces);
    return () => window.removeEventListener('bilik-workspace-updated', loadWorkspaces);
  }, []);

  return (
    <header className="hidden md:flex h-16 bg-[#FFFFFF] border-b border-[#E8E8EC] sticky top-0 z-20 items-center justify-between px-6">
      {/* Left: Workspace Selector & Search */}
      <div className="flex items-center gap-4">
        {/* Workspace Switcher */}
        <div className="relative">
          <button
            onClick={() => setWorkspaceDropdownOpen((open) => !open)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg text-xs font-medium text-[#24324A] cursor-pointer hover:bg-[#EEF2F7] transition-colors max-w-64"
          >
            <div className="w-2 h-2 rounded-full bg-[#4F9D78] flex-shrink-0"></div>
            <span className="font-semibold truncate">{activeWorkspace.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#737680] flex-shrink-0" />
          </button>

          {workspaceDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-xl p-2 z-50 text-xs animate-fade-in">
              <div className="px-2 py-2 text-[10px] font-bold text-[#737680] uppercase tracking-wider">Workspace Aplikasi</div>
              <div className="max-h-64 overflow-y-auto">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => selectWorkspace(workspace)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      activeWorkspace.id === workspace.id
                        ? 'bg-[#EEF8F3] text-[#24324A]'
                        : 'text-[#737680] hover:bg-[#F7F7F8] hover:text-[#202124]'
                    }`}
                  >
                    <span className="block font-semibold truncate">{workspace.name}</span>
                    <span className="block text-[10px] font-mono truncate">{workspace.slug || workspace.id}</span>
                  </button>
                ))}
              </div>
              <Link
                href="/settings"
                onClick={() => setWorkspaceDropdownOpen(false)}
                className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-[#F26B5E] hover:bg-[#FFF0ED] font-semibold"
              >
                <Settings className="w-3.5 h-3.5" />
                Kelola Workspace
              </Link>
            </div>
          )}
        </div>

        {/* Global Search Bar */}
        <button
          onClick={onOpenCommandMenu}
          className="flex items-center gap-3 px-3 py-1.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg text-xs text-[#737680] hover:border-[#24324A] transition-colors w-64 md:w-80 justify-between"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#737680]" />
            <span>Cari task, project, client...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-[#737680] bg-[#FFFFFF] border border-[#E8E8EC] rounded">
            ⌘K
          </kbd>
        </button>

      </div>

      {/* Right: Quick Create, Notifications, Profile */}
      <div className="flex items-center gap-3">
        {/* Start SyncUp Voice/Video Call Button */}
        <SyncUpButton variant="header" />

        {/* Quick Create Task */}
        <button
          onClick={onOpenCreateTask}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#24324A] text-white text-xs font-semibold rounded-lg hover:bg-[#1A2536] transition-colors shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5 text-[#F26B5E]" />
          <span>Create Task</span>
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="p-2 rounded-lg text-[#737680] hover:bg-[#F7F7F8] hover:text-[#202124] transition-colors relative"
            title="Notifikasi"
          >
            <Bell className="w-4 h-4" />
            {totalNotificationUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center bg-[#F26B5E] text-white text-[9px] font-extrabold rounded-full ring-2 ring-white">
                {totalNotificationUnread > 99 ? '99+' : totalNotificationUnread}
              </span>
            )}
          </button>

          {/* Quick Notification Dropdown */}
          {notificationOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-xl p-3 z-50 text-xs animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-[#E8E8EC] font-semibold text-[#24324A]">
                <span>Notifikasi Terbaru</span>
                <Link href="/notifications" onClick={() => setNotificationOpen(false)} className="text-[#F26B5E] hover:underline text-[11px]">
                  Lihat Semua
                </Link>
              </div>
              <div className="divide-y divide-[#E8E8EC] max-h-72 overflow-y-auto">
                {chatNotifications.length === 0 && activityUnread === 0 ? (
                  <div className="py-6 text-center text-[#737680]">Belum ada notifikasi.</div>
                ) : (
                  <>
                    {chatNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => openChatNotification(notification)}
                        className="w-full flex items-start gap-2.5 py-3 text-left hover:bg-[#F7F7F8] transition-colors"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={notification.senderAvatar}
                          alt={notification.senderName}
                          className="w-8 h-8 rounded-full object-cover border border-[#E8E8EC] flex-shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-[#24324A]">
                            <MessageSquare className="w-3 h-3 text-[#F26B5E] flex-shrink-0" />
                            <span className="truncate">{notification.senderName}</span>
                          </span>
                          <span className="flex items-center gap-1 mt-0.5 text-[10px] text-[#737680]">
                            <Hash className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate">{notification.channelName}</span>
                          </span>
                          <span className="block mt-1 text-[11px] text-[#202124] line-clamp-2">{notification.text}</span>
                        </span>
                      </button>
                    ))}
                    {activityUnread > 0 && (
                      <Link
                        href="/notifications"
                        onClick={() => setNotificationOpen(false)}
                        className="flex items-center gap-2 py-3 text-[11px] font-semibold text-[#24324A] hover:text-[#F26B5E]"
                      >
                        <Bell className="w-3.5 h-3.5 text-[#F26B5E]" />
                        {activityUnread} aktivitas task/project belum dibaca
                      </Link>
                    )}
                  </>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-[#E8E8EC]">
                <ChatSoundToggle />
              </div>
            </div>
          )}
        </div>

        {/* Profile Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#F7F7F8] transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={userProfile.avatar}
              alt={userProfile.name}
              className="w-8 h-8 rounded-full object-cover border border-[#E8E8EC]"
            />
            <ChevronDown className="w-3.5 h-3.5 text-[#737680]" />
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-xl py-2 z-50 text-xs animate-fade-in">
              <div className="px-4 py-2 border-b border-[#E8E8EC]">
                <p className="font-semibold text-[#202124]">{userProfile.name}</p>
                <p className="text-[11px] text-[#737680] truncate">{userProfile.email}</p>
                <span className="mt-1 inline-block px-2 py-0.5 bg-[#EEF2F7] text-[#24324A] font-bold text-[10px] rounded uppercase">
                  {userProfile.role}
                </span>
              </div>
              <Link
                href="/settings"
                onClick={() => setProfileDropdownOpen(false)}
                className="flex items-center px-4 py-2 text-[#737680] hover:bg-[#F7F7F8] hover:text-[#202124]"
              >
                <Settings className="w-3.5 h-3.5 mr-2" />
                Pengaturan Workspace
              </Link>
              <a
                href="/api/auth/logout"
                onClick={() => setProfileDropdownOpen(false)}
                className="flex items-center px-4 py-2 text-[#D95858] hover:bg-[#FFF0ED] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Keluar (Logout)
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
