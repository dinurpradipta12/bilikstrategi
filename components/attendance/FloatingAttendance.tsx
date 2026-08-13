'use client';

import Link from 'next/link';
import {
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  Pause,
  Play,
  Square,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

type Viewer = {
  name: string;
  avatar: string;
  email: string;
};

type ActiveAttendance = {
  user_name: string;
  user_avatar?: string;
  checkInTime: string;
  checkInTimestamp: number;
  isPaused: boolean;
  pausedAt: string | null;
  accumulatedSeconds: number;
  selectedProject: string;
  notesInput: string;
};

type AttendanceAction = 'checkin' | 'pause' | 'resume' | 'checkout';

const DEFAULT_PROJECT = 'Bilik Strategi Workspace';
const ATTENDANCE_EVENT = 'bilik-attendance-changed';

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeIdentity(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function belongsToViewer(session: ActiveAttendance, viewerName: string) {
  const sessionName = normalizeIdentity(session.user_name);
  const currentName = normalizeIdentity(viewerName);

  return sessionName === currentName || (
    sessionName.length > 3 &&
    currentName.length > 3 &&
    (sessionName.includes(currentName) || currentName.includes(sessionName))
  );
}

function normalizeSession(value: Record<string, unknown>): ActiveAttendance {
  return {
    user_name: text(value.user_name),
    user_avatar: text(value.user_avatar),
    checkInTime: text(value.checkInTime || value.check_in_time),
    checkInTimestamp: Number(value.checkInTimestamp || value.check_in_timestamp || 0),
    isPaused: value.isPaused === true || value.is_paused === true,
    pausedAt: text(value.pausedAt || value.paused_at) || null,
    accumulatedSeconds: Math.max(0, Number(value.accumulatedSeconds || value.accumulated_seconds || 0)),
    selectedProject: text(value.selectedProject || value.selected_project) || DEFAULT_PROJECT,
    notesInput: text(value.notesInput || value.notes_input),
  };
}

function elapsedSeconds(session: ActiveAttendance | null, now: number) {
  if (!session) return 0;
  const running = !session.isPaused && session.checkInTimestamp
    ? Math.max(0, Math.floor((now - session.checkInTimestamp) / 1000))
    : 0;
  return Math.max(0, session.accumulatedSeconds + running);
}

function formatTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function persistSession(session: ActiveAttendance | null) {
  if (typeof window === 'undefined') return;

  if (!session) {
    localStorage.removeItem('bilik_active_attendance');
    return;
  }

  localStorage.setItem('bilik_active_attendance', JSON.stringify(session));

  try {
    const stored = localStorage.getItem('bilik_team_active_store');
    const teamStore = stored ? JSON.parse(stored) : {};
    teamStore[session.user_name.toLowerCase()] = session;
    localStorage.setItem('bilik_team_active_store', JSON.stringify(teamStore));
  } catch {
    // The API remains authoritative when the browser cache is unavailable.
  }
}

function clearPersistedSession(userName: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('bilik_active_attendance');

  try {
    const stored = localStorage.getItem('bilik_team_active_store');
    if (!stored) return;
    const teamStore = JSON.parse(stored);
    delete teamStore[userName.toLowerCase()];
    localStorage.setItem('bilik_team_active_store', JSON.stringify(teamStore));
  } catch {
    // Ignore malformed or unavailable local cache.
  }
}

function broadcastAttendanceChange() {
  window.dispatchEvent(new CustomEvent(ATTENDANCE_EVENT));

  if ('BroadcastChannel' in window) {
    try {
      const channel = new window.BroadcastChannel('bilik_attendance_channel');
      channel.postMessage({ type: 'SYNC_ATTENDANCE' });
      channel.close();
    } catch {
      // Cross-tab broadcast is an enhancement; polling remains active.
    }
  }
}

function checkoutRecord(session: ActiveAttendance, viewer: Viewer, totalSeconds: number) {
  const now = new Date();
  const localDate = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, '0'))
    .join('-');
  const durationHours = Number((totalSeconds / 3600).toFixed(2));
  const status = durationHours < 1 ? 'ALPHA' : durationHours > 8 ? 'LEMBUR' : 'HADIR';
  const regularHours = durationHours < 1 ? 0 : Math.min(8, durationHours);
  const overtimeHours = durationHours > 8 ? Number((durationHours - 8).toFixed(2)) : 0;

  return {
    id: `att-${Date.now()}`,
    user_name: viewer.name,
    user_avatar: viewer.avatar,
    date: localDate,
    day_name: now.toLocaleDateString('en-US', { weekday: 'short' }),
    check_in_time: session.checkInTime || new Date(session.checkInTimestamp).toLocaleTimeString('id-ID'),
    check_out_time: now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
    duration_hours: durationHours,
    regular_hours: regularHours,
    overtime_hours: overtimeHours,
    status,
    project_name: session.selectedProject,
    notes: session.notesInput || (status === 'ALPHA'
      ? 'Alpha: Durasi kerja kurang dari 1 jam'
      : 'Presensi Harian Kerja'),
  };
}

export default function FloatingAttendance() {
  const rootRef = useRef<HTMLDivElement>(null);
  const actionInFlightRef = useRef(false);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [session, setSession] = useState<ActiveAttendance | null>(null);
  const [projects, setProjects] = useState<string[]>([DEFAULT_PROJECT]);
  const [selectedProject, setSelectedProject] = useState(DEFAULT_PROJECT);
  const [notes, setNotes] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [action, setAction] = useState<AttendanceAction | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const totalSeconds = elapsedSeconds(session, now);
  const timerLabel = formatTimer(totalSeconds);

  const currentDate = useMemo(() => new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(now)), [now]);

  const refreshSession = useCallback(async (viewerName: string) => {
    if (!viewerName || actionInFlightRef.current) return;

    try {
      const response = await fetch('/api/attendance?active_only=1', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal memuat status presensi.');

      const sessions = Array.isArray(data.activeCheckIns)
        ? data.activeCheckIns.map((item: Record<string, unknown>) => normalizeSession(item))
        : [];
      const activeSession = sessions.find((item: ActiveAttendance) => belongsToViewer(item, viewerName)) || null;
      setSession(activeSession);

      if (activeSession) {
        setSelectedProject(activeSession.selectedProject);
        setNotes(activeSession.notesInput);
        persistSession(activeSession);
      } else {
        clearPersistedSession(viewerName);
      }
      setError('');
    } catch (refreshError) {
      // Preserve the last known session during a temporary network failure.
      setError(refreshError instanceof Error ? refreshError.message : 'Gagal memuat status presensi.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [userResponse, projectsResponse] = await Promise.all([
          fetch('/api/clickup/user', { cache: 'no-store' }),
          fetch('/api/clickup/projects', { cache: 'no-store' }),
        ]);

        const userData = await userResponse.json().catch(() => ({}));
        if (!userResponse.ok || !userData.user) {
          throw new Error(userData.error || 'Profil pengguna tidak tersedia.');
        }

        const nextViewer: Viewer = {
          name: text(userData.user.username || userData.user.name) || 'User',
          avatar: text(userData.user.profilePicture),
          email: text(userData.user.email).toLowerCase(),
        };

        if (cancelled) return;
        setViewer(nextViewer);

        try {
          const storedSession = localStorage.getItem('bilik_active_attendance');
          if (storedSession) {
            const cachedSession = normalizeSession(JSON.parse(storedSession));
            if (belongsToViewer(cachedSession, nextViewer.name)) {
              setSession(cachedSession);
              setSelectedProject(cachedSession.selectedProject);
              setNotes(cachedSession.notesInput);
            }
          }
        } catch {
          localStorage.removeItem('bilik_active_attendance');
        }

        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json().catch(() => ({}));
          const projectNames = Array.isArray(projectsData.projects)
            ? projectsData.projects.map((item: Record<string, unknown>) => text(item.name)).filter(Boolean)
            : [];
          setProjects(Array.from(new Set([DEFAULT_PROJECT, ...projectNames])));
        }

        await refreshSession(nextViewer.name);
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(bootstrapError instanceof Error ? bootstrapError.message : 'Presensi belum dapat dimuat.');
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!viewer?.name) return;

    let channel: BroadcastChannel | null = null;
    const sync = () => void refreshSession(viewer.name);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'bilik_active_attendance' || event.key === 'bilik_team_active_store') sync();
    };

    if ('BroadcastChannel' in window) {
      try {
        channel = new window.BroadcastChannel('bilik_attendance_channel');
        channel.onmessage = sync;
      } catch {
        channel = null;
      }
    }

    const interval = window.setInterval(sync, 3000);
    window.addEventListener('focus', sync);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(ATTENDANCE_EVENT, sync);

    return () => {
      channel?.close();
      window.clearInterval(interval);
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(ATTENDANCE_EVENT, sync);
    };
  }, [refreshSession, viewer?.name]);

  useEffect(() => {
    if (!session || session.isPaused) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!panelOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPanelOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [panelOpen]);

  const runAction = async (nextAction: AttendanceAction) => {
    if (!viewer || actionInFlightRef.current) return;
    if (nextAction !== 'checkin' && !session) return;

    actionInFlightRef.current = true;
    setAction(nextAction);
    setError('');
    setNotice('');

    try {
      const timestamp = Date.now();
      const basePayload = {
        user_name: viewer.name,
        user_avatar: viewer.avatar,
        selectedProject: session?.selectedProject || selectedProject || DEFAULT_PROJECT,
        notesInput: session?.notesInput || notes,
        checkInTime: session?.checkInTime,
        checkInTimestamp: session?.checkInTimestamp,
      };

      const body = nextAction === 'checkin'
        ? {
            action: nextAction,
            ...basePayload,
            checkInTime: new Date(timestamp).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            }),
            checkInTimestamp: timestamp,
          }
        : nextAction === 'checkout' && session
          ? {
              action: nextAction,
              ...basePayload,
              record: checkoutRecord(session, viewer, elapsedSeconds(session, timestamp)),
            }
          : { action: nextAction, ...basePayload };

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || `Gagal melakukan ${nextAction} presensi.`);
      }

      if (nextAction === 'checkout') {
        setSession(null);
        setSelectedProject(DEFAULT_PROJECT);
        setNotes('');
        clearPersistedSession(viewer.name);
        setNotice('Check-out tersimpan. Sampai jumpa di sesi berikutnya.');
        setPanelOpen(false);
      } else {
        const activeSession = normalizeSession(data.active || body);
        setSession(activeSession);
        setSelectedProject(activeSession.selectedProject);
        setNotes(activeSession.notesInput);
        setNow(Date.now());
        persistSession(activeSession);
        setNotice(nextAction === 'checkin'
          ? 'Check-in berhasil. Timer kerja sudah berjalan.'
          : nextAction === 'pause'
            ? 'Timer presensi sedang dijeda.'
            : 'Timer presensi kembali berjalan.');
      }

      broadcastAttendanceChange();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Aksi presensi gagal diproses.');
      setPanelOpen(true);
      if (viewer.name) await refreshSession(viewer.name);
    } finally {
      actionInFlightRef.current = false;
      setAction(null);
    }
  };

  const handleCheckIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAction('checkin');
  };

  const togglePanel = () => {
    setPanelOpen((current) => !current);
    if (viewer?.name) void refreshSession(viewer.name);
  };

  return (
    <div
      ref={rootRef}
      data-floating-attendance
      className="fixed right-5 z-[100] bottom-[calc(6.25rem+env(safe-area-inset-bottom))] md:bottom-6 md:right-6"
    >
      {panelOpen && (
        <section
          role="dialog"
          aria-label="Presensi live"
          data-floating-attendance-panel
          className="absolute bottom-[calc(100%+0.75rem)] right-0 flex max-h-[min(36rem,calc(100svh-11.5rem))] w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-[#E1E5EB] bg-white shadow-[0_24px_70px_rgba(36,50,74,0.24)] dark:border-[#3A4350] dark:bg-[#20242C] dark:shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E8E8EC] bg-[#F8F9FB] px-4 py-4 dark:border-[#343C48] dark:bg-[#252B34]">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                session?.isPaused
                  ? 'bg-[#FFF4D9] text-[#B7791F] dark:bg-[#493B22] dark:text-[#F1C86C]'
                  : session
                    ? 'bg-[#E7F6EE] text-[#378563] dark:bg-[#234438] dark:text-[#8ED2B1]'
                    : 'bg-[#EEF2F7] text-[#405575] dark:bg-[#2D3745] dark:text-[#A8B8CD]'
              }`}>
                {initializing ? <Loader2 className="h-5 w-5 animate-spin" /> : session?.isPaused ? <Pause className="h-5 w-5" /> : session ? <Play className="h-5 w-5 fill-current" /> : <Clock3 className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#F26B5E]">Presensi Live</p>
                <h2 className="mt-0.5 truncate text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">
                  {session?.isPaused ? 'Sesi sedang dijeda' : session ? 'Sedang bekerja' : 'Mulai sesi kerja'}
                </h2>
                <p className="mt-0.5 truncate text-[10px] text-[#7B808B] dark:text-[#9CA6B5]">{currentDate}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Tutup panel presensi"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#7B808B] transition hover:bg-[#E9EDF2] hover:text-[#24324A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26B5E] dark:hover:bg-[#343C48] dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
            {error && (
              <div role="alert" className="mb-3 rounded-2xl border border-[#F26B5E]/30 bg-[#FFF0ED] px-3 py-2.5 text-xs font-semibold leading-5 text-[#B64B42] dark:bg-[#3B272B] dark:text-[#F2A199]">
                {error}
              </div>
            )}
            {notice && !error && (
              <div className="mb-3 flex items-start gap-2 rounded-2xl border border-[#4F9D78]/25 bg-[#EEF8F3] px-3 py-2.5 text-xs font-semibold leading-5 text-[#356D53] dark:bg-[#1E392C] dark:text-[#91CFB0]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {session ? (
              <div className="space-y-3">
                <div className={`rounded-2xl border px-4 py-4 text-center ${
                  session.isPaused
                    ? 'border-[#E6A23C]/30 bg-[#FFF9ED] dark:bg-[#3D321F]'
                    : 'border-[#4F9D78]/25 bg-[#F2FAF6] dark:bg-[#1E392C]'
                }`}>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#7B808B] dark:text-[#A4ADBA]">
                    {session.isPaused ? 'Durasi tersimpan' : 'Durasi berjalan'}
                  </p>
                  <p className="mt-1 font-mono text-3xl font-black tracking-tight text-[#24324A] dark:text-[#F4F6FA]" aria-live="off">
                    {timerLabel}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-[#697180] dark:text-[#A4ADBA]">
                    Check-in {session.checkInTime || 'baru saja'}
                  </p>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-start gap-3 rounded-2xl border border-[#E8E8EC] px-3 py-3 dark:border-[#343C48]">
                    <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-[#7B68EE]" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#9297A1]">Project</p>
                      <p className="mt-0.5 break-words text-xs font-bold text-[#24324A] dark:text-[#F4F6FA]">{session.selectedProject}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-[#E8E8EC] px-3 py-3 dark:border-[#343C48]">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#F26B5E]" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#9297A1]">Catatan</p>
                      <p className="mt-0.5 break-words text-xs leading-5 text-[#525A68] dark:text-[#B3BBC7]">{session.notesInput || 'Tidak ada catatan kerja.'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void runAction(session.isPaused ? 'resume' : 'pause')}
                    disabled={action !== null}
                    className={`flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-extrabold text-white transition disabled:cursor-wait disabled:opacity-60 ${
                      session.isPaused
                        ? 'bg-[#4F9D78] hover:bg-[#3D8362]'
                        : 'bg-[#E6A23C] hover:bg-[#C78A2C]'
                    }`}
                  >
                    {action === 'pause' || action === 'resume'
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : session.isPaused
                        ? <Play className="h-4 w-4 fill-current" />
                        : <Pause className="h-4 w-4 fill-current" />}
                    {session.isPaused ? 'Lanjutkan' : 'Jeda'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAction('checkout')}
                    disabled={action !== null}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#F26B5E] text-xs font-extrabold text-white transition hover:bg-[#D95346] disabled:cursor-wait disabled:opacity-60"
                  >
                    {action === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4 fill-current" />}
                    Check-out
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCheckIn} className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7B808B] dark:text-[#A4ADBA]">Project / aktivitas</span>
                  <select
                    value={selectedProject}
                    onChange={(event) => setSelectedProject(event.target.value)}
                    disabled={initializing || !viewer}
                    className="h-11 w-full rounded-xl border border-[#DDE2EA] bg-white px-3 text-xs font-bold text-[#24324A] outline-none transition focus:border-[#7B68EE] focus:ring-2 focus:ring-[#7B68EE]/15 disabled:opacity-60 dark:border-[#3A4350] dark:bg-[#252B34] dark:text-[#F4F6FA]"
                  >
                    {projects.map((project) => <option key={project} value={project}>{project}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#7B808B] dark:text-[#A4ADBA]">Catatan kerja</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Apa yang akan dikerjakan?"
                    disabled={initializing || !viewer}
                    className="w-full resize-none rounded-xl border border-[#DDE2EA] bg-white px-3 py-2.5 text-xs leading-5 text-[#24324A] outline-none transition focus:border-[#7B68EE] focus:ring-2 focus:ring-[#7B68EE]/15 disabled:opacity-60 dark:border-[#3A4350] dark:bg-[#252B34] dark:text-[#F4F6FA]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={initializing || !viewer || action !== null}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#4F9D78] text-xs font-extrabold text-white shadow-[0_10px_24px_rgba(79,157,120,0.2)] transition hover:bg-[#3D8362] disabled:cursor-wait disabled:opacity-60"
                >
                  {action === 'checkin' || initializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                  {initializing ? 'Memuat presensi...' : 'Check-in & mulai timer'}
                </button>
              </form>
            )}
          </div>

          <Link
            href="/attendance"
            onClick={() => setPanelOpen(false)}
            className="flex shrink-0 items-center justify-between border-t border-[#E8E8EC] bg-[#FBFBFC] px-4 py-3 text-[10px] font-extrabold text-[#5C6675] transition hover:bg-[#F2F4F7] hover:text-[#24324A] dark:border-[#343C48] dark:bg-[#252B34] dark:text-[#ADB5C1] dark:hover:bg-[#303742] dark:hover:text-white"
          >
            <span>Buka dashboard Presensi lengkap</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      <div className="group relative">
        {session && !panelOpen && (
          <div
            data-floating-attendance-actions
            className="pointer-events-none absolute right-[calc(100%+0.5rem)] top-1/2 hidden -translate-y-1/2 translate-x-3 items-center gap-1.5 opacity-0 transition duration-200 md:flex md:group-focus-within:pointer-events-auto md:group-focus-within:translate-x-0 md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:translate-x-0 md:group-hover:opacity-100"
          >
          <button
            type="button"
            onClick={() => void runAction(session.isPaused ? 'resume' : 'pause')}
            disabled={action !== null}
            aria-label={session.isPaused ? 'Lanjutkan presensi' : 'Jeda presensi'}
            title={session.isPaused ? 'Lanjutkan presensi' : 'Jeda presensi'}
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-white shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
              session.isPaused
                ? 'border-[#4F9D78] bg-[#4F9D78] hover:bg-[#3D8362] focus-visible:ring-[#4F9D78]'
                : 'border-[#D29232] bg-[#E6A23C] hover:bg-[#C78A2C] focus-visible:ring-[#E6A23C]'
            }`}
          >
            {action === 'pause' || action === 'resume'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : session.isPaused
                ? <Play className="h-4 w-4 fill-current" />
                : <Pause className="h-4 w-4 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => void runAction('checkout')}
            disabled={action !== null}
            aria-label="Stop dan check-out"
            title="Stop dan check-out"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D95346] bg-[#F26B5E] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#D95346] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26B5E] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {action === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4 fill-current" />}
          </button>
          </div>
        )}

        <button
          type="button"
          onClick={togglePanel}
          aria-label={panelOpen ? 'Tutup panel presensi live' : 'Buka panel presensi live'}
          aria-expanded={panelOpen}
          aria-haspopup="dialog"
          data-floating-attendance-trigger
          className={`relative flex h-14 items-center justify-center overflow-hidden border text-white shadow-[0_14px_32px_rgba(36,50,74,0.28)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26B5E] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#171A20] ${
            session
              ? session.isPaused
                ? 'min-w-[9.5rem] rounded-full border-[#C78A2C] bg-[#A87528] px-4'
                : 'min-w-[9.5rem] rounded-full border-[#367B5B] bg-[#24324A] px-4 dark:border-[#4F9D78] dark:bg-[#1F2733]'
              : 'w-14 rounded-full border-[#1A2536] bg-[#24324A] hover:bg-[#1A2536]'
          }`}
        >
          {initializing ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#F26B5E]" />
          ) : session ? (
            <>
              <span className={`mr-2 h-2.5 w-2.5 shrink-0 rounded-full ${session.isPaused ? 'bg-[#FFD580]' : 'animate-pulse bg-[#62D49D]'}`} />
              <span className="font-mono text-sm font-black tabular-nums" aria-live="off">{timerLabel}</span>
            </>
          ) : (
            <Clock3 className={`h-6 w-6 ${error && !viewer ? 'text-[#F4C95D]' : 'text-[#F26B5E]'}`} />
          )}
          {!session && !initializing && (
            <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-[#24324A] bg-[#4F9D78] dark:border-[#1F2733]" />
          )}
        </button>
      </div>
    </div>
  );
}
