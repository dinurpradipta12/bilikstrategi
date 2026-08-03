'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Clock, CheckSquare, FolderKanban } from 'lucide-react';
import {
  getChatUnreadTotal,
  readChatUnreadMap,
  UNREAD_BADGE_EVENT,
} from '@/lib/chat/notification-store';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    const syncUnreadCount = () => {
      setChatUnread(getChatUnreadTotal(readChatUnreadMap()));
    };

    const handleUnreadUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.type === 'chat' && typeof detail.count === 'number') {
        setChatUnread(detail.count);
        return;
      }
      syncUnreadCount();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'bilik_chat_unread_map' || event.key === 'bilik_chat_unread_count') {
        syncUnreadCount();
      }
    };

    syncUnreadCount();
    window.addEventListener(UNREAD_BADGE_EVENT, handleUnreadUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(UNREAD_BADGE_EVENT, handleUnreadUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const navItems = [
    {
      id: 'chat',
      label: 'Agency Chat',
      href: '/chat',
      icon: MessageSquare,
      activeColor: '#F26B5E',
    },
    {
      id: 'attendance',
      label: 'Presensi',
      href: '/attendance',
      icon: Clock,
      activeColor: '#10B981',
    },
    {
      id: 'tasks',
      label: 'Task',
      href: '/tasks',
      icon: CheckSquare,
      activeColor: '#7B68EE',
    },
    {
      id: 'projects',
      label: 'Project',
      href: '/projects',
      icon: FolderKanban,
      activeColor: '#3B82F6',
    },
  ];

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] md:hidden pointer-events-auto">
      <nav className="bg-[#24324A]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl px-2 py-2 flex items-center justify-around">
        {navItems.map((item) => {
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
                {item.id === 'chat' && chatUnread > 0 && (
                  <span className="absolute -top-2 -right-3 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-[#F26B5E] text-[9px] leading-none font-extrabold text-white ring-2 ring-[#24324A]">
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                )}
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
  );
}
