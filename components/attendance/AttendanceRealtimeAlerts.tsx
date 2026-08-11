'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LogIn, LogOut, Pause, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  type AttendanceSoundType,
  playAttendanceNotificationSound,
  unlockAttendanceNotificationSound,
} from '@/lib/attendance/notification-sound';

export const ATTENDANCE_ALERT_EVENT = 'bilik-attendance-realtime-alert';

type AttendanceAlert = {
  id: string;
  type: AttendanceSoundType;
  userName: string;
  userAvatar: string;
  projectName: string;
  occurredAt: string;
};

type ActiveSessionRow = Record<string, unknown> & {
  user_name?: string;
  user_avatar?: string;
  selected_project?: string;
  check_in_timestamp?: number | string;
  is_paused?: boolean;
  paused_at?: string | null;
  updated_at?: string;
};

type ViewerIdentity = {
  name: string;
  email: string;
};

const ALERT_STYLES = {
  checkin: {
    label: 'Check-in',
    message: 'mulai bekerja',
    Icon: LogIn,
    iconClass: 'bg-[#E7F6EE] text-[#378563] dark:bg-[#234438] dark:text-[#8ED2B1]',
    accentClass: 'bg-[#4F9D78]',
  },
  pause: {
    label: 'Pause',
    message: 'menjeda pekerjaan',
    Icon: Pause,
    iconClass: 'bg-[#FFF4D9] text-[#B7791F] dark:bg-[#4A3B20] dark:text-[#F2C96D]',
    accentClass: 'bg-[#E6A23C]',
  },
  checkout: {
    label: 'Check-out',
    message: 'selesai bekerja',
    Icon: LogOut,
    iconClass: 'bg-[#FFE9E6] text-[#D95858] dark:bg-[#4D2B2C] dark:text-[#F29A91]',
    accentClass: 'bg-[#F26B5E]',
  },
} as const;

function normalizeIdentity(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}

function eventFingerprint(type: AttendanceSoundType, row: ActiveSessionRow, commitTimestamp = '') {
  const user = normalizeIdentity(row.user_name);
  const marker = type === 'pause'
    ? stringValue(row.paused_at) || stringValue(row.updated_at) || commitTimestamp
    : String(row.check_in_timestamp || row.updated_at || commitTimestamp);
  return `${type}:${user}:${marker}`;
}

export default function AttendanceRealtimeAlerts() {
  const pathname = usePathname();
  const [viewer, setViewer] = useState<ViewerIdentity | null>(null);
  const [alerts, setAlerts] = useState<AttendanceAlert[]>([]);
  const seenEventsRef = useRef(new Set<string>());
  const dismissTimersRef = useRef(new Map<string, number>());

  useEffect(() => {
    const unlock = () => unlockAttendanceNotificationSound();
    const interactionEvents = ['pointerdown', 'keydown', 'touchstart'] as const;
    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, unlock, { passive: true });
    });

    return () => {
      interactionEvents.forEach((eventName) => window.removeEventListener(eventName, unlock));
    };
  }, []);

  useEffect(() => {
    if (pathname === '/login') {
      setViewer(null);
      return;
    }

    const controller = new AbortController();
    fetch('/api/clickup/user', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.user) return;
        setViewer({
          name: stringValue(data.user.username || data.user.name),
          email: stringValue(data.user.email).toLowerCase(),
        });
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [pathname]);

  const dismissAlert = useCallback((id: string) => {
    const timer = dismissTimersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    dismissTimersRef.current.delete(id);
    setAlerts((current) => current.filter((alert) => alert.id !== id));
  }, []);

  const receiveAlert = useCallback((alert: AttendanceAlert) => {
    if (!alert.userName || !viewer?.name) return;
    if (normalizeIdentity(alert.userName) === normalizeIdentity(viewer.name)) return;
    if (seenEventsRef.current.has(alert.id)) return;

    seenEventsRef.current.add(alert.id);
    if (seenEventsRef.current.size > 150) {
      const oldest = seenEventsRef.current.values().next().value;
      if (oldest) seenEventsRef.current.delete(oldest);
    }

    playAttendanceNotificationSound(alert.type);
    setAlerts((current) => [alert, ...current].slice(0, 3));

    const timer = window.setTimeout(() => dismissAlert(alert.id), 5200);
    dismissTimersRef.current.set(alert.id, timer);
  }, [dismissAlert, viewer]);

  useEffect(() => {
    const handleLocalAlert = (event: Event) => {
      const detail = (event as CustomEvent<AttendanceAlert>).detail;
      if (detail?.id && detail?.type) receiveAlert(detail);
    };
    window.addEventListener(ATTENDANCE_ALERT_EVENT, handleLocalAlert);
    return () => window.removeEventListener(ATTENDANCE_ALERT_EVENT, handleLocalAlert);
  }, [receiveAlert]);

  useEffect(() => {
    if (!viewer?.name || pathname === '/login' || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`global-attendance-alerts-${normalizeIdentity(viewer.email || viewer.name)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_sessions' },
        (payload) => {
          const eventType = payload.eventType;
          const currentRow = (payload.new || {}) as ActiveSessionRow;
          const previousRow = (payload.old || {}) as ActiveSessionRow;
          let type: AttendanceSoundType | null = null;
          let sourceRow = currentRow;

          if (eventType === 'INSERT') {
            type = 'checkin';
          } else if (eventType === 'DELETE') {
            type = 'checkout';
            sourceRow = previousRow;
          } else if (eventType === 'UPDATE' && currentRow.is_paused === true) {
            // Repeated writes of an already-paused row should not ring twice when
            // REPLICA IDENTITY FULL is available.
            if (previousRow.is_paused === true) return;
            type = 'pause';
          }

          if (!type) return;
          const userName = stringValue(sourceRow.user_name);
          if (!userName) return;

          receiveAlert({
            id: eventFingerprint(
              type,
              sourceRow,
              stringValue((payload as typeof payload & { commit_timestamp?: string }).commit_timestamp)
            ),
            type,
            userName,
            userAvatar: stringValue(sourceRow.user_avatar),
            projectName: stringValue(sourceRow.selected_project) || 'Bilik Strategi Workspace',
            occurredAt: new Date().toISOString(),
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pathname, receiveAlert, viewer]);

  useEffect(() => () => {
    dismissTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    dismissTimersRef.current.clear();
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[250] flex flex-col items-center gap-2 px-3"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      aria-live="polite"
      aria-label="Aktivitas presensi terbaru"
    >
      {alerts.map((alert) => {
        const style = ALERT_STYLES[alert.type];
        const AlertIcon = style.Icon;
        const time = new Intl.DateTimeFormat('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(alert.occurredAt));

        return (
          <div
            key={alert.id}
            data-attendance-alert={alert.type}
            className="pointer-events-auto relative flex w-[calc(100vw-1.5rem)] max-w-[420px] items-center gap-3 overflow-hidden rounded-2xl border border-[#E0E5EC] bg-white px-3.5 py-3 shadow-[0_14px_40px_rgba(36,50,74,0.18)] dark:border-[#394250] dark:bg-[#20252D]"
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${style.accentClass}`} />
            <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-extrabold ${style.iconClass}`}>
              {alert.userAvatar ? (
                <>
                  <span>{initials(alert.userName)}</span>
                  <img
                    src={alert.userAvatar}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                </>
              ) : (
                <AlertIcon className="h-5 w-5" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">
                  {alert.userName}
                </p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${style.iconClass}`}>
                  {style.label}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-[#5E6675] dark:text-[#AAB2BF]">
                {style.message} · {alert.projectName}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#9A9FAA] dark:text-[#7F8998]">{time}</p>
            </div>

            <button
              type="button"
              onClick={() => dismissAlert(alert.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#8B919C] transition hover:bg-[#F2F4F7] hover:text-[#24324A] dark:hover:bg-[#303742] dark:hover:text-white"
              aria-label="Tutup notifikasi presensi"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
