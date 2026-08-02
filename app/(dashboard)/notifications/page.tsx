'use client';

import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Inbox } from 'lucide-react';
import { AgencyNotification } from '@/lib/mock/data';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AgencyNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotifications() {
      try {
        // Fetch real task status or overdue items from ClickUp API
        const res = await fetch('/api/clickup/tasks');
        if (res.ok) {
          const data = await res.json();
          const tasks = data.tasks || [];
          const notifs: AgencyNotification[] = [];

          // Generate real notifications based on real ClickUp tasks
          tasks.forEach((t: any) => {
            if (t.due_date && Number(t.due_date) < Date.now() && t.status?.status !== 'closed' && t.status?.status !== 'complete') {
              notifs.push({
                id: 'notif-' + t.id,
                user_id: 'user-1',
                type: 'task_overdue',
                title: '⚠️ Task Overdue di ClickUp',
                message: `Task "${t.name}" pada project ${t.project_name || 'Bilik Strategi'} telah melewati batas waktu deadline.`,
                entity_type: 'task',
                entity_id: t.id,
                is_read: false,
                created_at: new Date().toISOString(),
              });
            }
          });

          setNotifications(notifs);
          
          // Update real-time unread badge count
          const unreadCount = notifs.filter((n) => !n.is_read).length;
          localStorage.setItem('bilik_notif_unread_count', String(unreadCount));
          window.dispatchEvent(new CustomEvent('unread-badge-update', { detail: { type: 'notification', count: unreadCount } }));
        }
      } catch (err) {
        console.warn('[Notifications] Error fetching tasks', err);
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    localStorage.setItem('bilik_notif_unread_count', '0');
    window.dispatchEvent(new CustomEvent('unread-badge-update', { detail: { type: 'notification', count: 0 } }));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Notification Center</h1>
          <p className="text-xs text-[#737680] mt-1">Pemberitahuan aktivitas task real-time, mention komentar, dan deadline project.</p>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={markAllRead}
            className="px-3.5 py-2 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl text-xs font-extrabold text-[#24324A] hover:bg-[#EEF2F7] transition-all cursor-pointer shadow-2xs"
          >
            Tandai Semua Dibaca
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-3">
          <div className="w-6 h-6 border-2 border-[#7B68EE] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#737680] font-semibold">Memuat notifikasi ClickUp terbaru...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EEF2F7] text-[#737680] flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#24324A]">Belum Ada Notifikasi Baru</h3>
          <p className="text-xs text-[#737680] max-w-sm mx-auto">
            Semua aktivitas project dan deadline task ClickUp Anda saat ini sudah diperbarui dan tidak ada notifikasi yang tertunda.
          </p>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs divide-y divide-[#E8E8EC] overflow-hidden">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex items-start gap-4 transition-colors ${n.is_read ? 'bg-[#FFFFFF]' : 'bg-[#FFF0ED]/40'}`}
            >
              <div className="p-2.5 rounded-xl bg-[#EEF2F7] text-[#24324A] mt-0.5 flex-shrink-0">
                {n.type === 'task_overdue' ? <AlertTriangle className="w-4 h-4 text-[#D95858]" /> : <Bell className="w-4 h-4 text-[#F26B5E]" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-[#202124]">{n.title}</h3>
                  <span className="text-[10px] text-[#737680] font-mono">Real-time Sync</span>
                </div>
                <p className="text-xs text-[#737680] mt-0.5 leading-relaxed">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
