'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppNotification = {
  id: string;
  workspace_id: string;
  recipient_email: string;
  actor_name?: string | null;
  type: string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  entity_url?: string | null;
  is_read: boolean;
  created_at: string;
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);
const REFRESH_EVENT = 'notifications-refresh';
const AUTOMATION_RUN_KEY = 'bilik_automation_last_runner_at';
const AUTOMATION_RUN_INTERVAL = 60_000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?limit=50', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const next = Array.isArray(data.notifications) ? data.notifications : [];
      const count = Number(data.unreadCount || 0);
      setNotifications(next);
      setUnreadCount(Number.isFinite(count) ? count : next.filter((item: AppNotification) => !item.is_read).length);
      try {
        localStorage.setItem('bilik_notif_unread_count', String(count));
      } catch {}
      window.dispatchEvent(new CustomEvent('unread-badge-update', { detail: { type: 'notification', count } }));
    } catch {
      // Keep the last database snapshot visible while the next poll retries.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 10000);
    const handleRefresh = () => refresh();
    const handleFocus = () => refresh();
    const handleWorkspace = () => refresh();
    window.addEventListener(REFRESH_EVENT, handleRefresh);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('bilik-workspace-updated', handleWorkspace);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(REFRESH_EVENT, handleRefresh);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('bilik-workspace-updated', handleWorkspace);
    };
  }, [refresh]);

  useEffect(() => {
    const runDueAutomations = async () => {
      try {
        const lastRun = Number(localStorage.getItem(AUTOMATION_RUN_KEY) || '0');
        if (Date.now() - lastRun < AUTOMATION_RUN_INTERVAL - 1000) return;
        // Reserve the local runner slot before the request so multiple mounted
        // providers/tabs do not continuously hit the API. Server run keys are
        // the cross-device dedupe layer.
        localStorage.setItem(AUTOMATION_RUN_KEY, String(Date.now()));
        await fetch('/api/automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'run_due' }),
        });
      } catch {
        // Automation is optional until its migration is installed. Notification
        // polling must continue even when the runner is not ready.
      }
    };

    void runDueAutomations();
    const interval = window.setInterval(() => void runDueAutomations(), AUTOMATION_RUN_INTERVAL);
    const handleFocus = () => void runDueAutomations();
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    setUnreadCount((current) => Math.max(0, current - (notifications.some((item) => item.id === id && !item.is_read) ? 1 : 0)));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }, [notifications]);

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    }).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, refresh, markRead, markAllRead }),
    [notifications, unreadCount, loading, refresh, markRead, markAllRead]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications harus dipakai di dalam NotificationProvider');
  return context;
}
