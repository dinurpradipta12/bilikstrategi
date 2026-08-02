'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, Bell, ChevronDown, LogOut, Settings } from 'lucide-react';

interface HeaderProps {
  onOpenCommandMenu: () => void;
  onOpenCreateTask: () => void;
}

export default function Header({ onOpenCommandMenu, onOpenCreateTask }: HeaderProps) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userProfile, setUserProfile] = useState({
    name: 'Bilik Strategi',
    email: '',
    role: 'owner',
    avatar: 'https://ui-avatars.com/api/?name=Bilik%20Strategi&background=24324A&color=fff',
  });

  const unreadNotifications: any[] = [];

  useEffect(() => {
    async function loadClickUpProfile() {
      let currentEmail = '';
      let currentName = 'Bilik Strategi';
      let currentAvatar = '';

      const savedUserStr = localStorage.getItem('bilik_current_user');
      if (savedUserStr) {
        try {
          const u = JSON.parse(savedUserStr);
          if (u.email) currentEmail = u.email;
          if (u.username) currentName = u.username;
          if (u.avatar) currentAvatar = u.avatar;
        } catch {}
      }

      try {
        const res = await fetch('/api/clickup/user');
        const data = await res.json();
        if (data.user) {
          currentName = data.user.username || currentName;
          currentEmail = data.user.email || currentEmail;
          if (data.user.profilePicture) currentAvatar = data.user.profilePicture;
        }
      } catch (err) {
        console.warn('[Header] ClickUp profile fetch failed, using default workspace profile.', err);
      }

      const isSuperOwner = currentEmail.toLowerCase().trim() === 'snllabsarchive@gmail.com';
      let finalRole = isSuperOwner ? 'Owner' : 'Member';

      if (!isSuperOwner) {
        const savedTeamStr = localStorage.getItem('bilik_team_members');
        if (savedTeamStr) {
          try {
            const parsed = JSON.parse(savedTeamStr);
            if (Array.isArray(parsed)) {
              const found = parsed.find(
                (m: any) =>
                  (m.email && m.email.toLowerCase().trim() === currentEmail.toLowerCase().trim()) ||
                  (m.name && m.name.toLowerCase().trim() === currentName.toLowerCase().trim())
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
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <header className="h-16 bg-[#FFFFFF] border-b border-[#E8E8EC] sticky top-0 z-20 flex items-center justify-between px-6">
      {/* Left: Workspace Selector & Search */}
      <div className="flex items-center gap-4">
        {/* Workspace Switcher */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg text-xs font-medium text-[#24324A] cursor-pointer hover:bg-[#EEF2F7] transition-colors">
          <div className="w-2 h-2 rounded-full bg-[#4F9D78]"></div>
          <span className="font-semibold">Bilik Strategi Workspace</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#737680]" />
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
            {unreadNotifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#F26B5E] rounded-full ring-2 ring-white"></span>
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
              <div className="divide-y divide-[#E8E8EC] max-h-60 overflow-y-auto">
                <div className="py-6 text-center text-[#737680]">Belum ada notifikasi.</div>
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
