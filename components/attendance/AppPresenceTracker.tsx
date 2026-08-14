'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { pageLabelForPath } from '@/lib/attendance/presence';

type PresenceEventType = 'heartbeat' | 'page_view' | 'interaction';

const HEARTBEAT_INTERVAL_MS = 60_000;
const INTERACTION_EVENT_INTERVAL_MS = 10 * 60_000;
const NETWORK_ACTIVITY_THROTTLE_MS = 45_000;

function deviceType() {
  if (window.innerWidth < 768) return 'mobile';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
}

function appMode() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone ? 'pwa' : 'browser';
}

export default function AppPresenceTracker() {
  const pathname = usePathname();
  const lastActivityAtRef = useRef(0);
  const lastNetworkAtRef = useRef(0);
  const lastInteractionEventAtRef = useRef(0);

  const sendPresence = useCallback(async (eventType: PresenceEventType) => {
    const now = Date.now();
    lastNetworkAtRef.current = now;

    try {
      await fetch('/api/attendance/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        keepalive: true,
        body: JSON.stringify({
          action: 'heartbeat',
          event_type: eventType,
          last_activity_at: new Date(lastActivityAtRef.current).toISOString(),
          current_path: pathname,
          current_page_label: pageLabelForPath(pathname),
          device_type: deviceType(),
          app_mode: appMode(),
          visibility: document.visibilityState,
          is_app_active: document.visibilityState === 'visible' && document.hasFocus(),
        }),
      });
    } catch {
      // Presence is an operational signal only and must never block app usage.
    }
  }, [pathname]);

  useEffect(() => {
    lastActivityAtRef.current = Date.now();
    void sendPresence('page_view');
  }, [pathname, sendPresence]);

  useEffect(() => {
    const markActivity = () => {
      const now = Date.now();
      lastActivityAtRef.current = now;

      if (now - lastNetworkAtRef.current < NETWORK_ACTIVITY_THROTTLE_MS) return;

      const shouldLogInteraction =
        now - lastInteractionEventAtRef.current >= INTERACTION_EVENT_INTERVAL_MS;
      if (shouldLogInteraction) lastInteractionEventAtRef.current = now;
      void sendPresence(shouldLogInteraction ? 'interaction' : 'heartbeat');
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') lastActivityAtRef.current = Date.now();
      void sendPresence(document.visibilityState === 'visible' ? 'interaction' : 'heartbeat');
    };
    let attendanceSyncTimer: number | null = null;
    const handleAttendanceChange = () => {
      void sendPresence('heartbeat');
      if (attendanceSyncTimer) window.clearTimeout(attendanceSyncTimer);
      attendanceSyncTimer = window.setTimeout(
        () => void sendPresence('heartbeat'),
        1_500,
      );
    };

    const eventOptions: AddEventListenerOptions = { passive: true };
    window.addEventListener('pointerdown', markActivity, eventOptions);
    window.addEventListener('keydown', markActivity);
    window.addEventListener('touchstart', markActivity, eventOptions);
    window.addEventListener('scroll', markActivity, eventOptions);
    window.addEventListener('focus', markActivity);
    window.addEventListener('blur', handleAttendanceChange);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = window.setInterval(() => void sendPresence('heartbeat'), HEARTBEAT_INTERVAL_MS);

    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('bilik_attendance_channel');
      channel.onmessage = () => void sendPresence('heartbeat');
    }

    window.addEventListener('bilik-attendance-changed', handleAttendanceChange);

    return () => {
      window.clearInterval(interval);
      if (attendanceSyncTimer) window.clearTimeout(attendanceSyncTimer);
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('touchstart', markActivity);
      window.removeEventListener('scroll', markActivity);
      window.removeEventListener('focus', markActivity);
      window.removeEventListener('blur', handleAttendanceChange);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('bilik-attendance-changed', handleAttendanceChange);
      channel?.close();
    };
  }, [sendPresence]);

  return null;
}
