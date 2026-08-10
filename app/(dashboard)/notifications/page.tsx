'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, CheckCircle2, Inbox, ListChecks, FolderKanban } from 'lucide-react';
import { useNotifications } from '@/components/notifications/NotificationProvider';

function notificationIcon(type: string) {
  if (type.includes('deleted')) return <AlertTriangle className="w-4 h-4 text-[#D95858]" />;
  if (type.includes('assigned')) return <ListChecks className="w-4 h-4 text-[#7B68EE]" />;
  if (type.includes('project')) return <FolderKanban className="w-4 h-4 text-[#4F9D78]" />;
  return <Bell className="w-4 h-4 text-[#F26B5E]" />;
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Baru saja';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead, refresh } = useNotifications();

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Notification Center</h1>
          <p className="text-xs text-[#737680] mt-1">Pemberitahuan assignment dan aktivitas task/project tersimpan di database.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refresh()}
            className="px-3.5 py-2 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl text-xs font-extrabold text-[#24324A] hover:bg-[#EEF2F7] transition-all cursor-pointer shadow-2xs"
          >
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="px-3.5 py-2 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl text-xs font-extrabold text-[#24324A] hover:bg-[#EEF2F7] transition-all cursor-pointer shadow-2xs"
            >
              Tandai Semua Dibaca
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-3">
          <div className="w-6 h-6 border-2 border-[#7B68EE] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#737680] font-semibold">Memuat notifikasi...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EEF2F7] text-[#737680] flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#24324A]">Belum Ada Notifikasi</h3>
          <p className="text-xs text-[#737680] max-w-sm mx-auto">Assignment dan perubahan task/project baru akan muncul di sini untuk akun penerima.</p>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs divide-y divide-[#E8E8EC] overflow-hidden">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.entity_url || '/notifications'}
              onClick={() => {
                if (!notification.is_read) void markRead(notification.id);
              }}
              className={`p-4 flex items-start gap-4 transition-colors hover:bg-[#F7F7F8] ${notification.is_read ? 'bg-[#FFFFFF]' : 'bg-[#FFF0ED]/40'}`}
            >
              <div className="p-2.5 rounded-xl bg-[#EEF2F7] mt-0.5 flex-shrink-0">{notificationIcon(notification.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-[#202124] truncate">{notification.title}</h3>
                  <span className="text-[10px] text-[#737680] font-mono whitespace-nowrap">{formatNotificationDate(notification.created_at)}</span>
                </div>
                <p className="text-xs text-[#737680] mt-0.5 leading-relaxed">{notification.message}</p>
                {!notification.is_read && (
                  <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-[#F26B5E]"><CheckCircle2 className="w-3 h-3" /> Belum dibaca</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
