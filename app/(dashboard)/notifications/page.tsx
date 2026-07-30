'use client';

import React, { useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, MessageSquare, Clock } from 'lucide-react';
import { MOCK_NOTIFICATIONS, AgencyNotification } from '@/lib/mock/data';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AgencyNotification[]>(MOCK_NOTIFICATIONS);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Notification Center</h1>
          <p className="text-xs text-[#737680] mt-1">Pemberitahuan aktivitas task, mention komentar, dan deadline project.</p>
        </div>
        <button
          onClick={markAllRead}
          className="px-3 py-1.5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl text-xs font-semibold text-[#24324A] hover:bg-[#EEF2F7]"
        >
          Tandai Semua Dibaca
        </button>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs divide-y divide-[#E8E8EC] overflow-hidden">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`p-4 flex items-start gap-4 transition-colors ${n.is_read ? 'bg-[#FFFFFF]' : 'bg-[#FFF0ED]/40'}`}
          >
            <div className="p-2 rounded-xl bg-[#EEF2F7] text-[#24324A] mt-0.5">
              {n.type === 'task_overdue' ? <AlertTriangle className="w-4 h-4 text-[#D95858]" /> : <Bell className="w-4 h-4 text-[#F26B5E]" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#202124]">{n.title}</h3>
                <span className="text-[10px] text-[#737680]">30m yang lalu</span>
              </div>
              <p className="text-xs text-[#737680] mt-0.5">{n.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
