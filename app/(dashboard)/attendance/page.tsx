'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Clock,
  Play,
  Pause,
  Square,
  Calendar,
  AlertCircle,
  Briefcase,
  FileText,
  User,
  ArrowRight,
  History,
  Sparkles,
  FileCheck2,
  UserX,
  Send,
  X,
  ShieldCheck,
  Users,
  Activity,
  BarChart3,
  Save,
  Settings2,
  Check,
  Loader2,
  MessageSquare,
  Ban,
  ChevronDown,
  ChevronUp,
  Target,
  Eye,
  Monitor,
  MousePointer2,
  Power,
  WifiOff,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { isSuperuserEmail } from '@/lib/auth/app-role';
import {
  type AttendanceAccessRequest,
  type AttendanceSchedule,
  type WorkDaySchedule,
} from '@/lib/attendance/schedule';
import {
  formatPresenceAge,
  presenceStateRank,
  resolvePresenceSnapshot,
  type PresenceState,
} from '@/lib/attendance/presence';

export interface AttendanceRecord {
  id: string;
  user_name: string;
  user_avatar: string;
  date: string; // YYYY-MM-DD
  day_name: string; // Sun, Mon, Tue, etc.
  check_in_time: string; // HH:mm:ss
  check_out_time: string; // HH:mm:ss
  duration_hours: number; // Total elapsed
  regular_hours: number; // Max 8h
  overtime_hours: number; // Excess above 8h
  status: 'HADIR' | 'ALPHA' | 'LEMBUR' | 'IZIN' | 'SAKIT' | 'CUTI';
  project_name: string;
  notes: string;
}

interface TeamMemberStatus {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  isOnline: boolean;
  checkInTime?: string;
  checkInTimestamp?: number;
  isPaused?: boolean;
  pausedAt?: string;
  accumulatedSeconds?: number;
  project?: string;
  statusText?: string;
  lastSeenAt?: string;
  lastActivityAt?: string;
  lastForegroundAt?: string;
  currentPath?: string;
  currentPageLabel?: string;
  deviceType?: string;
  appMode?: string;
}

interface AttendanceActivityEvent {
  id: string;
  event_type: 'page_view' | 'interaction' | 'forced_checkout';
  page_path?: string;
  page_label?: string;
  device_type?: string;
  app_mode?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface ActiveSessionSnapshot {
  user_name: string;
  user_email?: string;
  user_avatar?: string;
  checkInTime: string;
  checkInTimestamp: number;
  isPaused?: boolean;
  pausedAt?: string | null;
  accumulatedSeconds?: number;
  selectedProject: string;
  notesInput: string;
  lastSeenAt?: string;
  lastActivityAt?: string;
  lastForegroundAt?: string;
  currentPath?: string;
  currentPageLabel?: string;
  deviceType?: string;
  appMode?: string;
}

interface ClickUpProjectSummary {
  name?: string;
}

interface ClickUpMemberSummary {
  id: string | number;
  username?: string;
  email?: string;
  role?: number;
  profilePicture?: string;
}

interface PresenceStateApiRow {
  user_email?: string;
  user_name?: string;
  session_check_in_timestamp?: number;
  last_seen_at?: string;
  last_activity_at?: string;
  last_foreground_at?: string;
  current_path?: string;
  current_page_label?: string;
  device_type?: string;
  app_mode?: string;
}

const PRESENCE_VISUALS: Record<PresenceState, {
  label: string;
  badge: string;
  card: string;
  dot: string;
}> = {
  active: {
    label: 'Aktif di app',
    badge: 'border-[#4F9D78]/30 bg-[#4F9D78]/10 text-[#347A59] dark:text-[#72D6A5]',
    card: 'border-[#4F9D78]/40 bg-white dark:border-[#4F9D78]/45 dark:bg-[#1C2522]',
    dot: 'bg-[#4F9D78]',
  },
  idle: {
    label: 'Idle',
    badge: 'border-[#E6A23C]/35 bg-[#E6A23C]/10 text-[#A66A14] dark:text-[#F1BA64]',
    card: 'border-[#E6A23C]/40 bg-[#FFFBF2] dark:border-[#E6A23C]/45 dark:bg-[#292319]',
    dot: 'bg-[#E6A23C]',
  },
  away: {
    label: 'Away dari app',
    badge: 'border-[#D98A4E]/35 bg-[#D98A4E]/10 text-[#A45D26] dark:text-[#F0A56D]',
    card: 'border-[#D98A4E]/35 bg-[#FFF8F2] dark:border-[#D98A4E]/40 dark:bg-[#2A211C]',
    dot: 'bg-[#D98A4E]',
  },
  needs_review: {
    label: 'Perlu dicek',
    badge: 'border-[#D95858]/35 bg-[#D95858]/10 text-[#B13E3E] dark:text-[#FF8585]',
    card: 'border-[#D95858]/40 bg-[#FFF6F6] dark:border-[#D95858]/45 dark:bg-[#2B1D20]',
    dot: 'bg-[#D95858]',
  },
  critical: {
    label: 'Idle kritis',
    badge: 'border-[#D95858]/50 bg-[#D95858]/15 text-[#A92F2F] dark:text-[#FF7777]',
    card: 'border-[#D95858]/55 bg-[#FFF0F0] dark:border-[#D95858]/60 dark:bg-[#321C20]',
    dot: 'bg-[#D95858] animate-pulse',
  },
  paused: {
    label: 'Presensi dijeda',
    badge: 'border-[#7B68EE]/35 bg-[#7B68EE]/10 text-[#6654CF] dark:text-[#A99CFF]',
    card: 'border-[#7B68EE]/35 bg-[#F8F6FF] dark:border-[#7B68EE]/40 dark:bg-[#211F2D]',
    dot: 'bg-[#7B68EE]',
  },
  untracked: {
    label: 'Belum terpantau',
    badge: 'border-[#8A8E98]/30 bg-[#8A8E98]/10 text-[#666B75] dark:text-[#B4BBC7]',
    card: 'border-[#D7DAE0] bg-[#FAFAFB] dark:border-[#3A414D] dark:bg-[#1D2128]',
    dot: 'bg-[#8A8E98]',
  },
  offline: {
    label: 'Belum check-in',
    badge: 'border-[#D7DAE0] bg-[#F7F7F8] text-[#737680] dark:border-[#3A414D] dark:bg-[#20242C] dark:text-[#98A2B3]',
    card: 'border-[#E8E8EC] bg-[#F7F7F8] opacity-80 dark:border-[#303742] dark:bg-[#1A1E25]',
    dot: 'bg-[#737680]',
  },
};

export default function AttendancePage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    avatar: string;
    email: string;
    role: 'Owner' | 'Admin' | 'Member';
  }>({
    id: 'user-1',
    username: 'User',
    avatar: 'https://ui-avatars.com/api/?name=User&background=24324A&color=fff',
    email: '',
    role: 'Member', // Default to Member for safety
  });

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // Live Check-in State
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkInTimestamp, setCheckInTimestamp] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [accumulatedSeconds, setAccumulatedSeconds] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Form Inputs
  const [selectedProject, setSelectedProject] = useState<string>('Bilik Strategi Workspace');
  const [notesInput, setNotesInput] = useState<string>('');
  const [projectsList, setProjectsList] = useState<string[]>([
    'Bilik Strategi Workspace',
    'Media Brand Campaign',
    'Client Strategy Consulting',
    'Internal System R&D',
  ]);

  // Attendance History & Alert Banner
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [lastCheckOutNotice, setLastCheckOutNotice] = useState<{
    type: 'success' | 'warning' | 'alpha';
    message: string;
  } | null>(null);

  // Leave / Permit Modal State
  const [showLeaveModal, setShowLeaveModal] = useState<boolean>(false);
  const [leaveType, setLeaveType] = useState<'IZIN' | 'SAKIT' | 'CUTI'>('IZIN');
  const [leaveReason, setLeaveReason] = useState<string>('');

  // Live Team Active Presensi List (Admin View)
  const [teamStatusList, setTeamStatusList] = useState<TeamMemberStatus[]>([]);
  const [presenceClock, setPresenceClock] = useState<number>(0);
  const [expandedActivityMemberId, setExpandedActivityMemberId] = useState<string | null>(null);
  const [memberActivity, setMemberActivity] = useState<Record<string, AttendanceActivityEvent[]>>({});
  const [activityLoadingId, setActivityLoadingId] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<Record<string, string>>({});
  const [forceCheckoutTarget, setForceCheckoutTarget] = useState<TeamMemberStatus | null>(null);
  const [forceCheckoutReason, setForceCheckoutReason] = useState('Lupa checkout / sesi tidak lagi aktif.');
  const [forceCheckoutAtLastActivity, setForceCheckoutAtLastActivity] = useState(false);
  const [forceCheckoutSaving, setForceCheckoutSaving] = useState(false);
  const [forceCheckoutError, setForceCheckoutError] = useState('');
  const managerPresenceCacheRef = useRef<{
    fetchedAt: number;
    rows: PresenceStateApiRow[];
  }>({ fetchedAt: 0, rows: [] });

  // Admin Features & Multi-User Attendance History Monitor
  const [allUsersHistory, setAllUsersHistory] = useState<AttendanceRecord[]>([]);
  const [historyTab, setHistoryTab] = useState<'my-history' | 'team-history'>('my-history');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [showAdminResetModal, setShowAdminResetModal] = useState<boolean>(false);

  // Weekly work schedule and holiday access approval.
  const [workSchedule, setWorkSchedule] = useState<AttendanceSchedule | null>(null);
  const [scheduleStorageReady, setScheduleStorageReady] = useState<boolean>(true);
  const [scheduleLoading, setScheduleLoading] = useState<boolean>(true);
  const [scheduleSaving, setScheduleSaving] = useState<boolean>(false);
  const [scheduleMessage, setScheduleMessage] = useState<string>('');
  const [accessRequests, setAccessRequests] = useState<AttendanceAccessRequest[]>([]);
  const [isWorkScheduleExpanded, setIsWorkScheduleExpanded] = useState<boolean>(false);

  // Helper function to strictly check if user is Admin or Owner
  const checkIsAdminOrOwner = (userEmail?: string, userRole?: string): boolean => {
    const emailClean = (userEmail || '').toLowerCase().trim();
    const roleClean = (userRole || '').toLowerCase().trim();

    // The role returned by /api/clickup/user is backed by app_user_roles.
    // Ignore stale localStorage role flags so every device gets the same access.
    return isSuperuserEmail(emailClean) || roleClean === 'owner' || roleClean === 'admin';
  };

  const normalizeMemberKey = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const createAvatarUrl = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=24324A&color=fff`;

  const buildMemberFromActiveSession = (active: ActiveSessionSnapshot): TeamMemberStatus => {
    const name = active.user_name || 'User';
    const isCurrentUser = normalizeMemberKey(name) === normalizeMemberKey(currentUser.username);

    return {
      id: isCurrentUser ? currentUser.id : `active-${normalizeMemberKey(name) || Date.now()}`,
      name,
      email: active.user_email || (isCurrentUser ? currentUser.email : ''),
      role: isCurrentUser ? currentUser.role : 'Member',
      avatar: active.user_avatar || (isCurrentUser ? currentUser.avatar : createAvatarUrl(name)),
      isOnline: true,
      checkInTime: active.checkInTime,
      checkInTimestamp: active.checkInTimestamp,
      isPaused: active.isPaused === true,
      pausedAt: active.pausedAt || undefined,
      accumulatedSeconds: Number(active.accumulatedSeconds || 0),
      project: active.selectedProject || 'Bilik Strategi Workspace',
      statusText: active.isPaused ? 'Paused / Dijeda' : 'Online & Bekerja',
      lastSeenAt: active.lastSeenAt,
      lastActivityAt: active.lastActivityAt,
      lastForegroundAt: active.lastForegroundAt,
      currentPath: active.currentPath,
      currentPageLabel: active.currentPageLabel,
      deviceType: active.deviceType,
      appMode: active.appMode,
    };
  };

  const buildCurrentUserMember = (): TeamMemberStatus => ({
    id: currentUser.id,
    name: currentUser.username,
    email: currentUser.email,
    role: currentUser.role,
    avatar: currentUser.avatar || createAvatarUrl(currentUser.username),
    isOnline: isCheckedIn,
    checkInTime: isCheckedIn ? checkInTime || undefined : undefined,
    checkInTimestamp: isCheckedIn ? checkInTimestamp || undefined : undefined,
    isPaused: isCheckedIn ? isPaused : false,
    pausedAt: isCheckedIn ? pausedAt || undefined : undefined,
    accumulatedSeconds: isCheckedIn ? accumulatedSeconds : 0,
    project: isCheckedIn ? selectedProject : undefined,
    statusText: isCheckedIn ? (isPaused ? 'Paused / Dijeda' : 'Online & Bekerja') : 'Belum Check-In',
    lastSeenAt: undefined,
    lastActivityAt: undefined,
    lastForegroundAt: undefined,
    currentPath: undefined,
    currentPageLabel: undefined,
    deviceType: undefined,
    appMode: undefined,
  });

  const loadWorkSchedule = useCallback(async () => {
    try {
      const response = await fetch('/api/attendance/schedule?include_requests=1', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal memuat jadwal kerja.');

      if (data.schedule) setWorkSchedule(data.schedule as AttendanceSchedule);
      setScheduleStorageReady(data.storage_ready !== false);
      if (Array.isArray(data.requests)) setAccessRequests(data.requests as AttendanceAccessRequest[]);
      setScheduleMessage('');
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : 'Gagal memuat jadwal kerja.');
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const updateScheduleDay = (day: number, changes: Partial<WorkDaySchedule>) => {
    setWorkSchedule((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        days: previous.days.map((item) => (item.day === day ? { ...item, ...changes } : item)),
      };
    });
  };

  const handleSaveSchedule = async () => {
    if (!workSchedule || !checkIsAdminOrOwner(currentUser.email, currentUser.role)) return;

    setScheduleSaving(true);
    setScheduleMessage('');
    try {
      const response = await fetch('/api/attendance/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone: workSchedule.timezone,
          days: workSchedule.days,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan jadwal kerja.');
      if (data.schedule) setWorkSchedule(data.schedule as AttendanceSchedule);
      setScheduleStorageReady(true);
      setScheduleMessage('Jadwal hari dan jam kerja berhasil disimpan.');
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : 'Gagal menyimpan jadwal kerja.');
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleReviewAccessRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    setScheduleMessage('');
    try {
      const response = await fetch('/api/attendance/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review_request', request_id: requestId, status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal memproses permintaan izin.');
      setAccessRequests((previous) => previous.filter((request) => request.id !== requestId));
      setScheduleMessage(status === 'approved' ? 'Permintaan izin disetujui.' : 'Permintaan izin ditolak.');
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : 'Gagal memproses permintaan izin.');
    }
  };

  // 1. Fetch User Profile, Projects, & Team Members on Mount
  useEffect(() => {
    async function loadUserAndData() {
      try {
        let activeUsername = '';
        let activeEmail = '';
        let resolvedUserRole: 'Owner' | 'Admin' | 'Member' = 'Member';
        let hasServerAppRole = false;

        const userRes = await fetch('/api/clickup/user');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user) {
            activeUsername = userData.user.username || '';
            activeEmail = userData.user.email || '';
            const roleNum = userData.user.role;
            const appRole = String(userData.user.app_role || '').toLowerCase();
            hasServerAppRole = ['owner', 'admin', 'member', 'client'].includes(appRole);
            resolvedUserRole = appRole === 'owner' || roleNum === 1
              ? 'Owner'
              : appRole === 'admin' || roleNum === 2
                ? 'Admin'
                : 'Member';

            setCurrentUser({
              id: String(userData.user.id),
              username: activeUsername,
              avatar:
                userData.user.profilePicture ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(activeUsername || 'User')}&background=24324A&color=fff`,
              email: activeEmail,
              role: resolvedUserRole,
            });
          }
        }

        const projRes = await fetch('/api/clickup/projects');
        if (projRes.ok) {
          const projData = await projRes.json();
          if (Array.isArray(projData.projects) && projData.projects.length > 0) {
            const projects = (projData.projects as ClickUpProjectSummary[])
              .map((project) => project.name || '')
              .filter(Boolean);
            setProjectsList(projects);
          }
        }

        // Fetch ClickUp team members for Admin panel & Role resolution
        const teamRes = await fetch('/api/clickup/teams');

        if (teamRes.ok) {
          const teamData = await teamRes.json();
          const clickUpMembers: ClickUpMemberSummary[] = Array.isArray(teamData.members)
            ? teamData.members
            : [];

          // Find current user in workspace members to resolve exact role
          const matchedMember = clickUpMembers.find((m) => {
            const mName = (m.username || '').toLowerCase().trim();
            const uName = (activeUsername || '').toLowerCase().trim();
            const mEmail = (m.email || '').toLowerCase().trim();
            const uEmail = (activeEmail || '').toLowerCase().trim();
            return (
              (uName && (mName === uName || mName.includes(uName) || uName.includes(mName))) ||
              (uEmail && mEmail === uEmail)
            );
          });

          if (matchedMember && !hasServerAppRole) {
            resolvedUserRole = matchedMember.role === 1 ? 'Owner' : matchedMember.role === 2 ? 'Admin' : 'Member';
          }

          const baseTeam: TeamMemberStatus[] = clickUpMembers.map((m) => {
            const memberEmail = m.email || '';
            const memberName = m.username || memberEmail.split('@')[0] || 'User';
            return {
              id: String(m.id),
              name: memberName,
              email: memberEmail,
              role: m.role === 1 ? 'Owner' : m.role === 2 ? 'Admin' : 'Member',
              avatar:
                m.profilePicture ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(memberName)}&background=24324A&color=fff`,
              isOnline: false,
              checkInTime: undefined,
              checkInTimestamp: undefined,
              isPaused: false,
              pausedAt: undefined,
              accumulatedSeconds: 0,
              project: undefined,
              statusText: 'Belum Check-In',
              lastSeenAt: undefined,
              lastActivityAt: undefined,
              lastForegroundAt: undefined,
              currentPath: undefined,
              currentPageLabel: undefined,
              deviceType: undefined,
              appMode: undefined,
            };
          });

          setTeamStatusList((prev) => {
            if (baseTeam.length > 0) return baseTeam;
            return prev.length > 0 ? prev : [buildCurrentUserMember()];
          });

          setTimeout(() => {
            syncRealTimeTeamAttendance();
          }, 100);
        }

        // Update currentUser with exact resolved workspace role
        setCurrentUser((prev) => ({
          ...prev,
          role: resolvedUserRole,
        }));
      } catch (err) {
        console.warn('[Attendance] User, projects, or team fetch error', err);
      }

      // Restore active check-in state from localStorage
      const activeState = localStorage.getItem('bilik_active_attendance');
      if (activeState) {
        try {
          const parsed = JSON.parse(activeState);
          setIsCheckedIn(true);
          setCheckInTime(parsed.checkInTime);
          setCheckInTimestamp(parsed.checkInTimestamp);
          setIsPaused(parsed.isPaused === true);
          setPausedAt(parsed.pausedAt || null);
          setAccumulatedSeconds(Number(parsed.accumulatedSeconds || 0));
          setSelectedProject(parsed.selectedProject || 'Bilik Strategi Workspace');
          setNotesInput(parsed.notesInput || '');
        } catch {
          localStorage.removeItem('bilik_active_attendance');
        }
      }

      // Restore history logs
      const historyState = localStorage.getItem('bilik_attendance_history');
      if (historyState) {
        try {
          setHistory(JSON.parse(historyState));
        } catch {
          setHistory([]);
        }
      }

      fetchAllUsersHistory();

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('bilik_attendance_channel');
          bc.onmessage = (event) => {
            if (event.data?.type === 'RESET_ALL') {
              setHistory([]);
              setAllUsersHistory([]);
              setIsCheckedIn(false);
              setCheckInTime(null);
              setCheckInTimestamp(null);
              setIsPaused(false);
              setPausedAt(null);
              setAccumulatedSeconds(0);
              setElapsedSeconds(0);
              localStorage.removeItem('bilik_attendance_history');
              localStorage.removeItem('bilik_timesheet_recap');
              localStorage.removeItem('bilik_active_attendance');
              localStorage.removeItem('bilik_team_active_store');
            }
          };
        } catch {}
      }
    }

    loadUserAndData();
  }, []);

  // Keep the schedule and pending holiday requests current for every open tab.
  useEffect(() => {
    loadWorkSchedule();
    const interval = window.setInterval(loadWorkSchedule, 10000);
    return () => window.clearInterval(interval);
  }, [loadWorkSchedule]);

  // Fetch all users history for Admin view
  const fetchAllUsersHistory = async () => {
    try {
      const res = await fetch('/api/attendance');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.history)) {
          setAllUsersHistory(data.history);
          if (data.history.length === 0) {
            setHistory([]);
            localStorage.removeItem('bilik_attendance_history');
          }
          return;
        }
      }

      const { data: dbLogs } = await supabase
        .from('attendance_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbLogs) {
        setAllUsersHistory(dbLogs as AttendanceRecord[]);
        if (dbLogs.length === 0) {
          setHistory([]);
          localStorage.removeItem('bilik_attendance_history');
        }
      }
    } catch (err) {
      console.warn('[Attendance] Fetch all users history error', err);
    }
  };

  // Master Admin Reset Handler: Clear All Attendance History Across All Users
  const handleAdminMasterResetAll = async () => {
    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_all' }),
      });

      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://spnawjvexcwhhyfavvew.supabase.co';
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbmF3anZleGN3aGh5ZmF2dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjU1NDgsImV4cCI6MjEwMDk0MTU0OH0.IYNTrKH7s5aTBcRREiBgq1SOw5ONBcP0uxWpC_tSznU';

        await fetch(`${url}/rest/v1/attendance_logs?created_at=gt.1970-01-01T00:00:00Z`, {
          method: 'DELETE',
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        }).catch(() => {});

        await fetch(`${url}/rest/v1/active_sessions?updated_at=gt.1970-01-01T00:00:00Z`, {
          method: 'DELETE',
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        }).catch(() => {});

        await supabase.from('attendance_logs').delete().gt('created_at', '1970-01-01T00:00:00Z');
        await supabase.from('active_sessions').delete().gt('updated_at', '1970-01-01T00:00:00Z');
      } catch (dbErr) {
        console.warn('[Attendance] Supabase delete error', dbErr);
      }

      localStorage.removeItem('bilik_attendance_history');
      localStorage.removeItem('bilik_timesheet_recap');
      localStorage.removeItem('bilik_active_attendance');
      localStorage.removeItem('bilik_team_active_store');

      setHistory([]);
      setAllUsersHistory([]);
      setIsCheckedIn(false);
      setCheckInTime(null);
      setCheckInTimestamp(null);
      setIsPaused(false);
      setPausedAt(null);
      setAccumulatedSeconds(0);
      setElapsedSeconds(0);
      setShowAdminResetModal(false);

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('bilik_attendance_channel');
          bc.postMessage({ type: 'RESET_ALL' });
          bc.close();
        } catch {}
      }

      setLastCheckOutNotice({
        type: 'success',
        message: '🗑️ Seluruh Riwayat Presensi & Pengajuan Izin semua user telah berhasil di-reset bersih!',
      });
    } catch (err) {
      console.error('[Attendance] Master reset error', err);
      alert('Gagal melakukan reset data presensi.');
    }
  };

  // Export CSV for Attendance History
  const handleExportCSV = (recordsToExport: AttendanceRecord[]) => {
    if (recordsToExport.length === 0) {
      alert('Tidak ada data presensi untuk diexport.');
      return;
    }

    const headers = ['Nama User', 'Tanggal', 'Hari', 'Status', 'Jam Masuk', 'Jam Keluar', 'Durasi Total (Jam)', 'Lembur (Jam)', 'Project/Catatan'];
    const rows = recordsToExport.map((r) => [
      `"${r.user_name || 'User'}"`,
      `"${r.date}"`,
      `"${r.day_name}"`,
      `"${r.status}"`,
      `"${r.check_in_time}"`,
      `"${r.check_out_time}"`,
      r.duration_hours,
      r.overtime_hours,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Presensi_Bilik_Strategi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Real-time Clock & Elapsed Timer Ticker (Self + Team Members)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setPresenceClock(now.getTime());
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
      setCurrentDateStr(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );

      if (isCheckedIn) {
        const runningSeconds = !isPaused && checkInTimestamp
          ? Math.floor((now.getTime() - checkInTimestamp) / 1000)
          : 0;
        const totalSeconds = accumulatedSeconds + Math.max(0, runningSeconds);
        setElapsedSeconds(totalSeconds);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isCheckedIn, isPaused, checkInTimestamp, accumulatedSeconds]);

  // Sync live status directly from Supabase DB (Single Source of Truth)
  const syncRealTimeTeamAttendance = async () => {
    try {
      // 1. Direct Supabase DB active_sessions fetch via REST API
      let supabaseActiveList: ActiveSessionSnapshot[] = [];
      let hasAuthoritativeServerSnapshot = false;
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://spnawjvexcwhhyfavvew.supabase.co';
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbmF3anZleGN3aGh5ZmF2dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjU1NDgsImV4cCI6MjEwMDk0MTU0OH0.IYNTrKH7s5aTBcRREiBgq1SOw5ONBcP0uxWpC_tSznU';

        const restRes = await fetch(`${url}/rest/v1/active_sessions?select=*`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          cache: 'no-store',
        });
        if (restRes.ok) {
          hasAuthoritativeServerSnapshot = true;
          const restData = await restRes.json();
          if (Array.isArray(restData)) {
            supabaseActiveList = (restData as Array<Record<string, unknown>>).map((row) => ({
              user_name: String(row.user_name || ''),
              user_avatar: String(row.user_avatar || ''),
              checkInTime: String(row.check_in_time || ''),
              checkInTimestamp: Number(row.check_in_timestamp),
              isPaused: row.is_paused === true,
              pausedAt: row.paused_at ? String(row.paused_at) : undefined,
              accumulatedSeconds: Number(row.accumulated_seconds || 0),
              selectedProject: String(row.selected_project || 'Bilik Strategi Workspace'),
              notesInput: String(row.notes_input || ''),
            }));
          }
        }
      } catch {
        // ignore
      }

      if (checkIsAdminOrOwner(currentUser.email, currentUser.role)) {
        try {
          const cacheAge = Date.now() - managerPresenceCacheRef.current.fetchedAt;
          if (cacheAge >= 10_000) {
            const presenceResponse = await fetch('/api/attendance/presence?view=statuses', {
              cache: 'no-store',
            });
            const presenceData = await presenceResponse.json().catch(() => ({}));
            if (presenceResponse.ok && Array.isArray(presenceData.presences)) {
              managerPresenceCacheRef.current = {
                fetchedAt: Date.now(),
                rows: presenceData.presences as PresenceStateApiRow[],
              };
            }
          }
          const presenceRows = managerPresenceCacheRef.current.rows;

          for (const active of supabaseActiveList) {
            const activeName = normalizeMemberKey(active.user_name);
            const activeTimestamp = Number(active.checkInTimestamp || 0);
            const presence = presenceRows.find((row) => {
              const rowName = normalizeMemberKey(row.user_name);
              const rowTimestamp = Number(row.session_check_in_timestamp || 0);
              if (activeTimestamp > 0 && rowTimestamp > 0) {
                return rowTimestamp === activeTimestamp;
              }
              return activeName.length > 0 && rowName === activeName;
            });
            if (!presence) continue;

            active.user_email = presence.user_email || '';
            active.lastSeenAt = presence.last_seen_at || '';
            active.lastActivityAt = presence.last_activity_at || '';
            active.lastForegroundAt = presence.last_foreground_at || '';
            active.currentPath = presence.current_path || '';
            active.currentPageLabel = presence.current_page_label || '';
            active.deviceType = presence.device_type || '';
            active.appMode = presence.app_mode || '';
          }
        } catch {
          // Presence details are optional and manager-only.
        }
      }

      const currentNameClean = normalizeMemberKey(currentUser.username);
      const currentActiveSession = supabaseActiveList.find((active) => {
        const activeNameClean = normalizeMemberKey(active.user_name);
        return activeNameClean === currentNameClean ||
          (activeNameClean.length > 3 && currentNameClean.includes(activeNameClean)) ||
          (currentNameClean.length > 3 && activeNameClean.includes(currentNameClean));
      });

      // Keep the current device aligned with the server when another tab/device
      // pauses or resumes the same attendance session.
      if (currentActiveSession) {
        const sessionIsPaused = currentActiveSession.isPaused === true;
        const sessionAccumulated = Number(currentActiveSession.accumulatedSeconds || 0);
        const sessionStartedAt = Number(currentActiveSession.checkInTimestamp || 0);
        const runningSeconds = !sessionIsPaused && sessionStartedAt
          ? Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000))
          : 0;
        const sessionElapsed = sessionAccumulated + runningSeconds;

        setIsCheckedIn(true);
        setCheckInTime(currentActiveSession.checkInTime || null);
        setCheckInTimestamp(sessionStartedAt || null);
        setIsPaused(sessionIsPaused);
        setPausedAt(currentActiveSession.pausedAt || null);
        setAccumulatedSeconds(sessionAccumulated);
        setElapsedSeconds(sessionElapsed);
        setSelectedProject(currentActiveSession.selectedProject || 'Bilik Strategi Workspace');
        setNotesInput(currentActiveSession.notesInput || '');
        localStorage.setItem('bilik_active_attendance', JSON.stringify({
          user_name: currentActiveSession.user_name,
          user_avatar: currentActiveSession.user_avatar || currentUser.avatar,
          checkInTime: currentActiveSession.checkInTime,
          checkInTimestamp: sessionStartedAt,
          selectedProject: currentActiveSession.selectedProject || 'Bilik Strategi Workspace',
          notesInput: currentActiveSession.notesInput || '',
          isPaused: sessionIsPaused,
          pausedAt: currentActiveSession.pausedAt || null,
          accumulatedSeconds: sessionAccumulated,
        }));
      } else if (hasAuthoritativeServerSnapshot && currentUser.username !== 'User') {
        // A successful server snapshot without our row means the session was
        // checked out elsewhere. Clear stale local state instead of reviving it.
        setIsCheckedIn(false);
        setCheckInTime(null);
        setCheckInTimestamp(null);
        setIsPaused(false);
        setPausedAt(null);
        setAccumulatedSeconds(0);
        setElapsedSeconds(0);
        localStorage.removeItem('bilik_active_attendance');
      }

      setTeamStatusList((prev) => {
        const baseMembers = prev.length > 0 ? [...prev] : [buildCurrentUserMember()];

        supabaseActiveList.forEach((active) => {
          const activeNameClean = normalizeMemberKey(active.user_name);
          const exists = baseMembers.some((m) => {
            const memberNameClean = normalizeMemberKey(m.name);
            const memberEmailPrefix = normalizeMemberKey((m.email || '').split('@')[0]);
            return (
              activeNameClean === memberNameClean ||
              activeNameClean === memberEmailPrefix ||
              (activeNameClean.length > 3 && memberNameClean.includes(activeNameClean)) ||
              (memberNameClean.length > 3 && activeNameClean.includes(memberNameClean))
            );
          });

          if (!exists && activeNameClean) {
            baseMembers.push(buildMemberFromActiveSession(active));
          }
        });

        const hasCurrentUser = baseMembers.some((m) => {
          const memberNameClean = normalizeMemberKey(m.name);
          const memberEmailClean = (m.email || '').toLowerCase().trim();
          return (
            memberNameClean === normalizeMemberKey(currentUser.username) ||
            (!!currentUser.email && memberEmailClean === currentUser.email.toLowerCase().trim())
          );
        });

        if (!hasCurrentUser && currentUser.username && currentUser.username !== 'User') {
          baseMembers.push(buildCurrentUserMember());
        }

        return baseMembers.map((m) => {
          const mNameClean = normalizeMemberKey(m.name);
          const mEmailPrefix = normalizeMemberKey((m.email || '').split('@')[0]);
          const currentClean = normalizeMemberKey(currentUser.username);

          const isMe = mNameClean.length > 2 && (mNameClean === currentClean || mNameClean.includes(currentClean) || currentClean.includes(mNameClean));

          // If current user is checked out locally, FORCE OFFLINE on panel
          if (isMe && !isCheckedIn) {
            return {
              ...m,
              isOnline: false,
              checkInTime: undefined,
              checkInTimestamp: undefined,
              isPaused: false,
              pausedAt: undefined,
              accumulatedSeconds: 0,
              project: undefined,
              statusText: 'Belum Check-In',
            };
          }

          const active = supabaseActiveList.find((a) => {
            const aNameClean = normalizeMemberKey(a.user_name);
            return (
              aNameClean === mNameClean ||
              aNameClean === mEmailPrefix ||
              (aNameClean.length > 3 && mNameClean.includes(aNameClean)) ||
              (mNameClean.length > 3 && aNameClean.includes(mNameClean))
            );
          });

          if (active) {
            return {
              ...m,
              isOnline: true,
              checkInTime: active.checkInTime,
              checkInTimestamp: active.checkInTimestamp,
              isPaused: active.isPaused === true,
              pausedAt: active.pausedAt || undefined,
              accumulatedSeconds: Number(active.accumulatedSeconds || 0),
              project: active.selectedProject || 'Bilik Strategi Workspace',
              statusText: active.isPaused ? 'Paused / Dijeda' : 'Online & Bekerja',
              email: active.user_email || m.email,
              lastSeenAt: active.lastSeenAt,
              lastActivityAt: active.lastActivityAt,
              lastForegroundAt: active.lastForegroundAt,
              currentPath: active.currentPath,
              currentPageLabel: active.currentPageLabel,
              deviceType: active.deviceType,
              appMode: active.appMode,
            };
          }

          return {
            ...m,
            isOnline: false,
            checkInTime: undefined,
            checkInTimestamp: undefined,
            isPaused: false,
            pausedAt: undefined,
            accumulatedSeconds: 0,
            project: undefined,
            statusText: 'Belum Check-In',
            lastSeenAt: undefined,
            lastActivityAt: undefined,
            lastForegroundAt: undefined,
            currentPath: undefined,
            currentPageLabel: undefined,
            deviceType: undefined,
            appMode: undefined,
          };
        });
      });
    } catch (err) {
      console.warn('[Attendance] Live sync error', err);
    }
  };

  // Listen to BroadcastChannel & Storage events for INSTANT cross-tab / cross-window sync
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('bilik_attendance_channel');
      bc.onmessage = () => {
        syncRealTimeTeamAttendance();
      };
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bilik_active_attendance' || e.key === 'bilik_team_active_store') {
        syncRealTimeTeamAttendance();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    syncRealTimeTeamAttendance();

    const interval = setInterval(syncRealTimeTeamAttendance, 2000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [isCheckedIn, isPaused, pausedAt, accumulatedSeconds, checkInTime, checkInTimestamp, selectedProject, currentUser.username]);

  // 3. Supabase Live Realtime WebSocket Listener (Instant Push Notification on DB Changes)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('realtime_attendance_sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_sessions' },
        () => {
          syncRealTimeTeamAttendance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.username, isCheckedIn]);

  const toggleMemberActivity = async (member: TeamMemberStatus, event: React.MouseEvent) => {
    event.stopPropagation();

    if (expandedActivityMemberId === member.id) {
      setExpandedActivityMemberId(null);
      return;
    }

    setExpandedActivityMemberId(member.id);
    if (memberActivity[member.id]) return;

    setActivityLoadingId(member.id);
    setActivityError((previous) => ({ ...previous, [member.id]: '' }));
    try {
      const params = new URLSearchParams();
      if (member.email) params.set('user_email', member.email);
      params.set('user_name', member.name);
      const response = await fetch(`/api/attendance/presence?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal memuat aktivitas pengguna.');
      if (data.storage_ready !== true) {
        throw new Error('Timeline aktivitas belum aktif di server. Hubungi Owner untuk mengaktifkan penyimpanannya.');
      }
      setMemberActivity((previous) => ({
        ...previous,
        [member.id]: Array.isArray(data.events) ? data.events : [],
      }));
    } catch (error) {
      setActivityError((previous) => ({
        ...previous,
        [member.id]: error instanceof Error ? error.message : 'Gagal memuat aktivitas pengguna.',
      }));
    } finally {
      setActivityLoadingId(null);
    }
  };

  const openForceCheckout = (member: TeamMemberStatus, event: React.MouseEvent) => {
    event.stopPropagation();
    const presence = resolvePresenceSnapshot(member, Date.now());
    setForceCheckoutTarget(member);
    setForceCheckoutReason('Lupa checkout / sesi tidak lagi aktif.');
    setForceCheckoutAtLastActivity(
      Boolean(member.lastActivityAt) && ['needs_review', 'critical'].includes(presence.state),
    );
    setForceCheckoutError('');
  };

  const handleAdminForceCheckout = async () => {
    if (!forceCheckoutTarget || forceCheckoutSaving) return;

    setForceCheckoutSaving(true);
    setForceCheckoutError('');
    try {
      const response = await fetch('/api/attendance/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force_checkout',
          target_email: forceCheckoutTarget.email,
          target_user_name: forceCheckoutTarget.name,
          reason: forceCheckoutReason,
          checkout_at: forceCheckoutAtLastActivity ? 'last_activity' : 'now',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal menghentikan sesi presensi.');

      try {
        const stored = localStorage.getItem('bilik_team_active_store');
        if (stored) {
          const teamStore = JSON.parse(stored);
          delete teamStore[forceCheckoutTarget.name.toLowerCase()];
          localStorage.setItem('bilik_team_active_store', JSON.stringify(teamStore));
        }
      } catch {
        // Server state remains authoritative.
      }

      setLastCheckOutNotice({
        type: 'warning',
        message: data.activity_storage_ready === false
          ? `Sesi ${forceCheckoutTarget.name} berhasil dihentikan. Audit dasar tersimpan, tetapi timeline aktivitas server belum aktif.`
          : `Sesi ${forceCheckoutTarget.name} berhasil dihentikan oleh admin dan masuk ke riwayat presensi.`,
      });
      setMemberActivity((previous) => {
        const next = { ...previous };
        delete next[forceCheckoutTarget.id];
        return next;
      });
      setTeamStatusList((previous) => previous.map((member) => (
        member.id === forceCheckoutTarget.id
          ? {
              ...member,
              isOnline: false,
              checkInTime: undefined,
              checkInTimestamp: undefined,
              isPaused: false,
              pausedAt: undefined,
              accumulatedSeconds: 0,
              project: undefined,
              statusText: 'Belum Check-In',
              lastSeenAt: undefined,
              lastActivityAt: undefined,
              lastForegroundAt: undefined,
              currentPath: undefined,
              currentPageLabel: undefined,
              deviceType: undefined,
              appMode: undefined,
            }
          : member
      )));
      managerPresenceCacheRef.current = { fetchedAt: 0, rows: [] };
      setForceCheckoutTarget(null);
      setExpandedActivityMemberId(null);
      broadcastAttendanceSync();
      await Promise.all([syncRealTimeTeamAttendance(), fetchAllUsersHistory()]);
    } catch (error) {
      setForceCheckoutError(
        error instanceof Error ? error.message : 'Gagal menghentikan sesi presensi.',
      );
    } finally {
      setForceCheckoutSaving(false);
    }
  };

  const persistLocalActiveAttendance = (activeObj: ActiveSessionSnapshot) => {
    localStorage.setItem('bilik_active_attendance', JSON.stringify(activeObj));

    try {
      const storeStr = localStorage.getItem('bilik_team_active_store');
      const storeMap = storeStr ? JSON.parse(storeStr) : {};
      storeMap[currentUser.username.toLowerCase()] = activeObj;
      localStorage.setItem('bilik_team_active_store', JSON.stringify(storeMap));
    } catch {
      // ignore local cache errors
    }
  };

  const broadcastAttendanceSync = () => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('bilik_attendance_channel');
        bc.postMessage({ type: 'SYNC_ATTENDANCE' });
        bc.close();
      } catch {
        // ignore browser broadcast errors
      }
    }
  };

  const syncAttendanceAction = async (
    action: 'pause' | 'resume',
    activeObj: ActiveSessionSnapshot,
  ) => {
    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...activeObj }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Gagal melakukan ${action} presensi`);
    }
  };

  const handlePause = async () => {
    if (!isCheckedIn || isPaused || !checkInTimestamp) return;

    const now = Date.now();
    const nextAccumulatedSeconds = accumulatedSeconds + Math.max(
      0,
      Math.floor((now - checkInTimestamp) / 1000)
    );
    const nextPausedAt = new Date(now).toISOString();
    const activeObj = {
      user_name: currentUser.username,
      user_avatar: currentUser.avatar,
      checkInTime: checkInTime || new Date(checkInTimestamp).toLocaleTimeString('id-ID'),
      checkInTimestamp,
      isPaused: true,
      pausedAt: nextPausedAt,
      accumulatedSeconds: nextAccumulatedSeconds,
      selectedProject,
      notesInput,
    };

    setIsPaused(true);
    setPausedAt(nextPausedAt);
    setAccumulatedSeconds(nextAccumulatedSeconds);
    setElapsedSeconds(nextAccumulatedSeconds);
    persistLocalActiveAttendance(activeObj);
    broadcastAttendanceSync();

    try {
      await syncAttendanceAction('pause', activeObj);
      syncRealTimeTeamAttendance();
    } catch (err) {
      console.warn('[Attendance] Pause sync error', err);
      setLastCheckOutNotice({
        type: 'warning',
        message: 'Pause tersimpan di perangkat, tetapi belum berhasil disinkronkan ke server.',
      });
    }
  };

  const handleResume = async () => {
    if (!isCheckedIn || !isPaused) return;

    const now = Date.now();
    const activeObj = {
      user_name: currentUser.username,
      user_avatar: currentUser.avatar,
      checkInTime: checkInTime || new Date(now).toLocaleTimeString('id-ID'),
      checkInTimestamp: now,
      isPaused: false,
      pausedAt: null,
      accumulatedSeconds,
      selectedProject,
      notesInput,
    };

    setIsPaused(false);
    setPausedAt(null);
    setCheckInTimestamp(now);
    setElapsedSeconds(accumulatedSeconds);
    persistLocalActiveAttendance(activeObj);
    broadcastAttendanceSync();

    try {
      await syncAttendanceAction('resume', activeObj);
      syncRealTimeTeamAttendance();
    } catch (err) {
      console.warn('[Attendance] Resume sync error', err);
      setLastCheckOutNotice({
        type: 'warning',
        message: 'Presensi dilanjutkan di perangkat, tetapi belum berhasil disinkronkan ke server.',
      });
    }
  };

  // 3. Handle Check-In
  const handleCheckIn = () => {
    const now = new Date();
    const startTimeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const startTimestamp = now.getTime();

    setIsCheckedIn(true);
    setCheckInTime(startTimeStr);
    setCheckInTimestamp(startTimestamp);
    setIsPaused(false);
    setPausedAt(null);
    setAccumulatedSeconds(0);
    setElapsedSeconds(0);
    setLastCheckOutNotice(null);

    const activeObj = {
      user_name: currentUser.username,
      user_avatar: currentUser.avatar,
      checkInTime: startTimeStr,
      checkInTimestamp: startTimestamp,
      isPaused: false,
      pausedAt: null,
      accumulatedSeconds: 0,
      selectedProject,
      notesInput,
    };
    localStorage.setItem('bilik_active_attendance', JSON.stringify(activeObj));

    // Update shared team store for instant cross-tab sync
    try {
      const storeStr = localStorage.getItem('bilik_team_active_store');
      const storeMap = storeStr ? JSON.parse(storeStr) : {};
      storeMap[currentUser.username.toLowerCase()] = activeObj;
      localStorage.setItem('bilik_team_active_store', JSON.stringify(storeMap));
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('bilik_attendance_channel');
        bc.postMessage({ type: 'SYNC_ATTENDANCE' });
        bc.close();
      } catch {
        // ignore
      }
    }

    // Write directly to Supabase REST API (100% reliable cross-browser/device)
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://spnawjvexcwhhyfavvew.supabase.co';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbmF3anZleGN3aGh5ZmF2dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjU1NDgsImV4cCI6MjEwMDk0MTU0OH0.IYNTrKH7s5aTBcRREiBgq1SOw5ONBcP0uxWpC_tSznU';
      fetch(`${url}/rest/v1/active_sessions`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          user_name: currentUser.username,
          user_avatar: currentUser.avatar,
          check_in_time: startTimeStr,
          check_in_timestamp: startTimestamp,
          is_paused: false,
          paused_at: null,
          accumulated_seconds: 0,
          selected_project: selectedProject,
          notes_input: notesInput,
          updated_at: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {}

    // Broadcast check-in to shared server API for cross-browser & cross-device sync
    fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'checkin',
        user_name: currentUser.username,
        user_avatar: currentUser.avatar,
        selectedProject,
        notesInput,
        checkInTime: startTimeStr,
        checkInTimestamp: startTimestamp,
        isPaused: false,
        pausedAt: null,
        accumulatedSeconds: 0,
      }),
    }).catch(() => {});
  };

  // 4. Handle Check-Out (Includes Minimum 1 Hour Threshold + Overtime Logic)
  const handleCheckOut = () => {
    if (!checkInTimestamp) return;

    const now = new Date();
    const checkOutTimeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const diffMs = (accumulatedSeconds * 1000) + (
      isPaused ? 0 : Math.max(0, now.getTime() - checkInTimestamp)
    );
    const durationHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });
    const dateYMD = now.toISOString().split('T')[0];

    let status: 'HADIR' | 'ALPHA' | 'LEMBUR' = 'HADIR';
    let regularHours = 0;
    let overtimeHours = 0;

    if (durationHours < 1.0) {
      status = 'ALPHA';
      regularHours = 0;
      overtimeHours = 0;
      setLastCheckOutNotice({
        type: 'alpha',
        message: `⚠️ Durasi kerja hanya ${durationHours} jam (< 1 jam). Presensi dihitung ALPHA / TIDAK BEKERJA (0h ke Timesheet).`,
      });
    } else {
      regularHours = Math.min(8.0, durationHours);
      if (durationHours > 8.0) {
        status = 'LEMBUR';
        overtimeHours = parseFloat((durationHours - 8.0).toFixed(2));
        setLastCheckOutNotice({
          type: 'warning',
          message: `🔥 Durasi kerja ${durationHours} jam. 8.0h Jam Reguler + ${overtimeHours}h LEMBUR (Overtime) berhasil terekap!`,
        });
      } else {
        status = 'HADIR';
        setLastCheckOutNotice({
          type: 'success',
          message: `✅ Presensi ${durationHours} jam berhasil dicatat dan masuk ke Timesheet!`,
        });
      }
    }

    const newRecord: AttendanceRecord = {
      id: 'att-' + Date.now(),
      user_name: currentUser.username,
      user_avatar: currentUser.avatar,
      date: dateYMD,
      day_name: dayName,
      check_in_time: checkInTime || '08:00:00',
      check_out_time: checkOutTimeStr,
      duration_hours: durationHours,
      regular_hours: regularHours,
      overtime_hours: overtimeHours,
      status: status,
      project_name: selectedProject,
      notes: notesInput || (status === 'ALPHA' ? 'Alpha: Durasi kerja kurang dari 1 jam' : 'Presensi Harian Kerja'),
    };

    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('bilik_attendance_history', JSON.stringify(updatedHistory));

    const existingRecapStr = localStorage.getItem('bilik_timesheet_recap');
    const existingRecap: Record<string, Record<string, { regular: number; overtime: number; status: string; notes: string }>> = existingRecapStr
      ? JSON.parse(existingRecapStr)
      : {};

    if (!existingRecap[currentUser.username]) {
      existingRecap[currentUser.username] = {};
    }

    const currentEntry = existingRecap[currentUser.username][dayName] || { regular: 0, overtime: 0, status: 'HADIR', notes: '' };
    existingRecap[currentUser.username][dayName] = {
      regular: parseFloat((currentEntry.regular + regularHours).toFixed(2)),
      overtime: parseFloat((currentEntry.overtime + overtimeHours).toFixed(2)),
      status: status,
      notes: notesInput || 'Presensi Harian',
    };

    localStorage.setItem('bilik_timesheet_recap', JSON.stringify(existingRecap));

    setIsCheckedIn(false);
    setCheckInTime(null);
    setCheckInTimestamp(null);
    setIsPaused(false);
    setPausedAt(null);
    setAccumulatedSeconds(0);
    setElapsedSeconds(0);
    setNotesInput('');
    localStorage.removeItem('bilik_active_attendance');

    try {
      const storeStr = localStorage.getItem('bilik_team_active_store');
      if (storeStr) {
        const storeMap = JSON.parse(storeStr);
        delete storeMap[currentUser.username.toLowerCase()];
        localStorage.setItem('bilik_team_active_store', JSON.stringify(storeMap));
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('bilik_attendance_channel');
        bc.postMessage({ type: 'SYNC_ATTENDANCE' });
        bc.close();
      } catch {
        // ignore
      }
    }

    // Delete active session directly from Supabase REST API & SDK (100% reliable)
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://spnawjvexcwhhyfavvew.supabase.co';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbmF3anZleGN3aGh5ZmF2dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjU1NDgsImV4cCI6MjEwMDk0MTU0OH0.IYNTrKH7s5aTBcRREiBgq1SOw5ONBcP0uxWpC_tSznU';
      fetch(`${url}/rest/v1/active_sessions?user_name=ilike.${encodeURIComponent(currentUser.username)}`, {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      }).catch(() => {});
    } catch {}

    try {
      supabase.from('active_sessions').delete().ilike('user_name', currentUser.username).then(() => {
        syncRealTimeTeamAttendance();
      });
    } catch {}

    // Broadcast checkout to shared server API
    fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'checkout',
        user_name: currentUser.username,
        record: newRecord,
      }),
    }).catch(() => {});

    // Immediately trigger local real-time sync update
    setTimeout(() => {
      syncRealTimeTeamAttendance();
    }, 100);
  };

  // 5. Handle Submit Leave Request (Izin / Sakit / Cuti)
  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) return;

    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });
    const dateYMD = now.toISOString().split('T')[0];

    const leaveRecord: AttendanceRecord = {
      id: 'leave-' + Date.now(),
      user_name: currentUser.username,
      user_avatar: currentUser.avatar,
      date: dateYMD,
      day_name: dayName,
      check_in_time: '-',
      check_out_time: '-',
      duration_hours: 0,
      regular_hours: 0,
      overtime_hours: 0,
      status: leaveType,
      project_name: 'Pengajuan Presensi',
      notes: `${leaveType}: ${leaveReason}`,
    };

    const updatedHistory = [leaveRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('bilik_attendance_history', JSON.stringify(updatedHistory));

    const existingRecapStr = localStorage.getItem('bilik_timesheet_recap');
    const existingRecap: Record<string, Record<string, { regular: number; overtime: number; status: string; notes: string }>> = existingRecapStr
      ? JSON.parse(existingRecapStr)
      : {};

    if (!existingRecap[currentUser.username]) {
      existingRecap[currentUser.username] = {};
    }

    existingRecap[currentUser.username][dayName] = {
      regular: 0,
      overtime: 0,
      status: leaveType,
      notes: `${leaveType}: ${leaveReason}`,
    };

    localStorage.setItem('bilik_timesheet_recap', JSON.stringify(existingRecap));

    setShowLeaveModal(false);
    setLeaveReason('');
    setLastCheckOutNotice({
      type: 'warning',
      message: `📩 Pengajuan ${leaveType} berhasil dicatat & diperbarui di Timesheet!`,
    });
  };

  // Helper formatting for seconds to HH:MM:SS
  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')} : ${String(mins).padStart(2, '0')} : ${String(secs).padStart(2, '0')}`;
  };

  // Compute active team count
  const checkedInCount = teamStatusList.filter((m) => m.isOnline).length;
  const activeNowCount = teamStatusList.filter(
    (member) => resolvePresenceSnapshot(member, presenceClock).state === 'active',
  ).length;
  const reviewCount = teamStatusList.filter((member) =>
    ['needs_review', 'critical'].includes(resolvePresenceSnapshot(member, presenceClock).state),
  ).length;
  const isAdminOrOwner = checkIsAdminOrOwner(currentUser.email, currentUser.role);
  const currentDayIndex = new Date().getDay();

  return (
    <div className="space-y-6 animate-fade-in pb-12 relative">
      {/* Title Header */}
      <div className="flex min-w-0 flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E8EC] pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Presensi & Live Tracker</h1>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-[#EEF2F7] text-[#24324A] rounded-md border border-[#E8E8EC]">
              @bilik-strategi
            </span>
          </div>
          <p className="text-xs text-[#737680] mt-1">
            Min 1 jam bekerja (dibawah 1 jam = Alpha). Lebih dari 8 jam masuk Rekap Lembur. Panel khusus Admin menampilkan daftar anggota tim online secara live!
          </p>
        </div>

        <div className="flex w-full max-w-full flex-nowrap items-center gap-2.5 self-start overflow-x-auto pb-1 md:w-auto md:overflow-visible md:pb-0 md:self-auto">
          {isAdminOrOwner && (
            <button
              type="button"
              onClick={() => setShowAdminResetModal(true)}
              className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#F26B5E]/30 bg-[#FFF0ED] px-3.5 py-2.5 text-xs font-extrabold text-[#F26B5E] shadow-2xs transition-all hover:bg-[#F26B5E] hover:text-white cursor-pointer"
              title="Reset seluruh riwayat presensi semua user di workspace (Khusus Admin)"
            >
              <X className="w-4 h-4" />
              <span>Reset Presensi (Admin)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-[#E8E8EC] bg-white px-4 py-2.5 text-xs font-bold text-[#24324A] shadow-2xs transition-all hover:border-[#D1D5DB] hover:bg-[#F7F7F8] cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#7B68EE] flex-shrink-0" />
            <span>Form Izin / Sakit / Cuti</span>
          </button>

          <Link
            href="/team?tab=timesheet"
            className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-[#24324A] px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition-all hover:bg-[#1A2536]"
          >
            <BarChart3 className="w-4 h-4 text-[#4F9D78] flex-shrink-0" />
            <span>Rekap Timesheet & Lembur</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#F26B5E] flex-shrink-0 ml-0.5" />
          </Link>
        </div>
      </div>

      {/* Mobile-friendly shortcut to the personal performance workspace. */}
      <Link
        href="/performance"
        className="flex w-full items-center gap-3 rounded-2xl border border-[#DDE5F0] bg-gradient-to-r from-[#F4F7FB] to-white p-3.5 shadow-2xs transition hover:border-[#7B68EE]/40 hover:shadow-sm dark:border-[#303742] dark:from-[#20242C] dark:to-[#20242C] md:p-4"
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#24324A] text-white">
          <Target className="h-5 w-5 text-[#A99CF6]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-extrabold text-[#24324A] md:text-sm">KPI &amp; Daily Activity</span>
          <span className="mt-0.5 block truncate text-[10px] text-[#737680] md:text-[11px]">Isi checklist kerja, progres, dan lihat job description sesuai role Anda.</span>
        </span>
        <span className="inline-flex flex-shrink-0 items-center gap-1 text-[10px] font-extrabold text-[#7B68EE] md:text-xs">
          Buka <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>

      {/* Alert Notice Banner */}
      {lastCheckOutNotice && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold animate-fade-in ${
            lastCheckOutNotice.type === 'alpha'
              ? 'bg-[#F26B5E]/10 border-[#F26B5E]/30 text-[#D95858]'
              : lastCheckOutNotice.type === 'warning'
              ? 'bg-[#E6A23C]/10 border-[#E6A23C]/30 text-[#B87C24]'
              : 'bg-[#4F9D78]/10 border-[#4F9D78]/30 text-[#3D8362]'
          }`}
        >
          <div className="flex items-center gap-2">
            {lastCheckOutNotice.type === 'alpha' ? (
              <UserX className="w-4 h-4 text-[#F26B5E] flex-shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#4F9D78] flex-shrink-0" />
            )}
            <span>{lastCheckOutNotice.message}</span>
          </div>
          <button onClick={() => setLastCheckOutNotice(null)} className="text-[#737680] hover:text-[#24324A] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Weekly Work Schedule: full-width control above the live attendance cards */}
      <section className="w-full bg-white border border-[#E8E8EC] rounded-2xl p-3 md:p-5 lg:p-6 shadow-2xs space-y-3 md:space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 md:gap-4 border-b border-[#E8E8EC] pb-3 md:pb-4">
          <div className="flex items-start gap-2.5 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[#EEF2F7] text-[#24324A] flex items-center justify-center flex-shrink-0">
              <Settings2 className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xs md:text-sm font-extrabold text-[#24324A]">Hari Kerja & Jam Kerja</h2>
                {isAdminOrOwner && (
                  <span className="px-2 py-0.5 rounded-full bg-[#24324A] text-white text-[9px] font-extrabold">Admin dapat mengatur</span>
                )}
              </div>
              <p className="text-[10px] md:text-[11px] text-[#737680] mt-1">
                Jadwal ini menjadi dasar presensi, status hari libur, dan penguncian akses workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 self-end lg:self-auto">
            <button
              type="button"
              onClick={() => setIsWorkScheduleExpanded((previous) => !previous)}
              className="md:hidden inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#EEF2F7] text-[#24324A] text-[10px] font-extrabold border border-[#E8E8EC] cursor-pointer"
              aria-expanded={isWorkScheduleExpanded}
              aria-controls="attendance-work-schedule-body"
              title={isWorkScheduleExpanded ? 'Tutup jadwal kerja' : 'Buka jadwal kerja'}
            >
              {isWorkScheduleExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {isWorkScheduleExpanded ? 'Tutup' : 'Buka'}
            </button>

            {isAdminOrOwner && workSchedule && (
              <button
                type="button"
                onClick={handleSaveSchedule}
                disabled={scheduleSaving || !scheduleStorageReady}
                className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl bg-[#24324A] text-white text-[10px] md:text-xs font-extrabold hover:bg-[#1A2536] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                title="Simpan jadwal ke Supabase"
              >
                {scheduleSaving ? <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" /> : <Save className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                Simpan Jadwal
              </button>
            )}
          </div>
        </div>

        <div id="attendance-work-schedule-body" className={isWorkScheduleExpanded ? 'block' : 'hidden md:block'}>
          {scheduleLoading && !workSchedule ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2 md:gap-3">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="h-32 md:h-36 rounded-xl bg-[#F7F7F8] border border-[#E8E8EC] animate-pulse" />
              ))}
            </div>
          ) : workSchedule ? (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2 md:gap-3">
              {workSchedule.days.map((day) => {
                const isToday = day.day === currentDayIndex;
                return (
                  <div
                    key={day.day}
                    className={`min-w-0 rounded-xl border p-2.5 md:p-3 space-y-2 md:space-y-3 transition-colors ${
                      isToday
                        ? 'border-[#7B68EE]/50 bg-[#7B68EE]/5'
                        : 'border-[#E8E8EC] bg-[#F7F7F8]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#737680] font-bold">{day.shortLabel}</p>
                        <p className="text-xs font-extrabold text-[#24324A] mt-0.5">{day.label}</p>
                      </div>
                      {isToday && <span className="text-[9px] font-extrabold text-[#7B68EE]">Hari ini</span>}
                    </div>

                    {isAdminOrOwner ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={day.isWorking}
                          onChange={(event) => updateScheduleDay(day.day, { isWorking: event.target.checked })}
                        />
                        <span className="relative w-9 h-5 rounded-full bg-[#D1D5DB] peer-checked:bg-[#4F9D78] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
                        <span className={`text-[10px] font-extrabold ${day.isWorking ? 'text-[#4F9D78]' : 'text-[#737680]'}`}>
                          {day.isWorking ? 'Hari kerja' : 'Libur'}
                        </span>
                      </label>
                    ) : (
                      <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-extrabold ${day.isWorking ? 'bg-[#4F9D78]/10 text-[#4F9D78]' : 'bg-[#E8E8EC] text-[#737680]'}`}>
                        {day.isWorking ? 'Hari kerja' : 'Libur'}
                      </span>
                    )}

                    {day.isWorking ? (
                      <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                        <label className="space-y-1">
                          <span className="block text-[9px] font-bold text-[#737680]">Mulai</span>
                          <input
                            type="time"
                            value={day.startTime}
                            onChange={(event) => updateScheduleDay(day.day, { startTime: event.target.value })}
                            disabled={!isAdminOrOwner}
                            className="w-full min-w-0 h-8 px-1.5 md:px-2 md:py-1.5 bg-white border border-[#E8E8EC] rounded-lg text-[10px] md:text-[11px] font-bold text-[#24324A] disabled:opacity-70"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block text-[9px] font-bold text-[#737680]">Selesai</span>
                          <input
                            type="time"
                            value={day.endTime}
                            onChange={(event) => updateScheduleDay(day.day, { endTime: event.target.value })}
                            disabled={!isAdminOrOwner}
                            className="w-full min-w-0 h-8 px-1.5 md:px-2 md:py-1.5 bg-white border border-[#E8E8EC] rounded-lg text-[10px] md:text-[11px] font-bold text-[#24324A] disabled:opacity-70"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[10px] text-[#737680]">
                        <Ban className="w-3.5 h-3.5" /> Tidak ada jam kerja
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!scheduleStorageReady && isAdminOrOwner && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FFF8E7] border border-[#E6A23C]/30 text-[#8C641F]">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] font-bold leading-relaxed">
                  Jadwal belum tersimpan ke Supabase. Jalankan SQL migration yang saya kirimkan, lalu pastikan <code>SUPABASE_SERVICE_ROLE_KEY</code> tersedia di environment server.
                </p>
              </div>
            )}

            {scheduleMessage && (
              <p className="text-xs font-bold text-[#4F9D78]">{scheduleMessage}</p>
            )}

            {isAdminOrOwner && accessRequests.length > 0 && (
              <div className="border-t border-[#E8E8EC] pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#7B68EE]" />
                  <h3 className="text-xs font-extrabold text-[#24324A]">Permintaan Izin Masuk Saat Libur</h3>
                  <span className="px-1.5 py-0.5 rounded-full bg-[#F26B5E] text-white text-[9px] font-extrabold">{accessRequests.length}</span>
                </div>
                <div className="space-y-2">
                  {accessRequests.map((request) => (
                    <div key={request.id} className="flex flex-col lg:flex-row lg:items-center gap-3 p-3 rounded-xl bg-[#F7F7F8] border border-[#E8E8EC]">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-xs font-extrabold text-[#24324A]">{request.displayName}</p>
                          <span className="text-[10px] text-[#737680]">{request.email}</span>
                          <span className="text-[10px] font-bold text-[#7B68EE]">{request.requestDate}</span>
                        </div>
                        <p className="text-[11px] text-[#737680] mt-1 break-words">{request.reason}</p>
                      </div>
                      <div className="flex items-center gap-2 self-end lg:self-auto">
                        <button
                          type="button"
                          onClick={() => handleReviewAccessRequest(request.id, 'approved')}
                          className="w-8 h-8 rounded-lg bg-[#4F9D78]/10 text-[#4F9D78] border border-[#4F9D78]/20 flex items-center justify-center hover:bg-[#4F9D78] hover:text-white cursor-pointer"
                          title="Setujui permintaan izin"
                          aria-label="Setujui permintaan izin"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewAccessRequest(request.id, 'rejected')}
                          className="w-8 h-8 rounded-lg bg-[#F26B5E]/10 text-[#F26B5E] border border-[#F26B5E]/20 flex items-center justify-center hover:bg-[#F26B5E] hover:text-white cursor-pointer"
                          title="Tolak permintaan izin"
                          aria-label="Tolak permintaan izin"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </>
          ) : (
            <p className="text-xs text-[#737680]">Jadwal kerja belum dapat dimuat.</p>
          )}
        </div>
      </section>

      {/* Main Presensi Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Clock & Check In/Out Card (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl p-6 shadow-2xs relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#24324A]" />
                <h3 className="text-sm font-extrabold text-[#24324A]">Waktu Kerja & Presensi Live</h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#737680]">
                <Calendar className="w-3.5 h-3.5 text-[#24324A]" />
                <span>{currentDateStr || 'Hari ini'}</span>
              </div>
            </div>

            {/* Center Timer Display */}
            <div className="my-8 text-center space-y-3">
              <span className="text-[11px] font-bold text-[#737680] uppercase tracking-widest block">
                {isCheckedIn
                  ? (isPaused ? 'Durasi Jam Kerja Dijeda' : 'Durasi Jam Kerja Berjalan')
                  : 'Waktu Real-Time Saat Ini'}
              </span>
              <div className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tight text-[#24324A]">
                {isCheckedIn ? formatTimer(elapsedSeconds) : currentTime || '00 : 00 : 00'}
              </div>

              {isCheckedIn ? (
                <div className="space-y-1">
                  {checkInTime && (
                    <p
                      className={isPaused
                        ? "text-xs font-semibold text-[#B87C24] bg-[#E6A23C]/10 inline-block px-3 py-1 rounded-full border border-[#E6A23C]/20"
                        : "text-xs font-semibold text-[#4F9D78] bg-[#4F9D78]/10 inline-block px-3 py-1 rounded-full border border-[#4F9D78]/20"}
                    >
                      {isPaused ? '⏸ Presensi dijeda sejak' : '✓ Check-in masuk sejak'} pukul <b>{isPaused && pausedAt ? new Date(pausedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : checkInTime} WIB</b>
                    </p>
                  )}
                  {elapsedSeconds < 3600 && (
                    <p className="text-[11px] font-bold text-[#D95858] block">
                      ⚠️ Butuh minimal 1:00:00 jam kerja agar presensi sah (Bukan Alpha).
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-[#737680]">
                  Syarat Presensi Sah: Minimal <b>1 Jam Kerja</b>. Di atas <b>8 Jam</b> dihitung <b>Lembur</b>.
                </p>
              )}
            </div>

            {/* Action Check-In / Pause / Check-Out Buttons */}
            <div>
              {!isCheckedIn ? (
                <button
                  type="button"
                  onClick={handleCheckIn}
                  className="w-full py-4 bg-[#4F9D78] hover:bg-[#3D8362] text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>CHECK-IN (MULAI BEKERJA)</span>
                </button>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={isPaused ? handleResume : handlePause}
                    className={isPaused
                      ? "w-full py-4 bg-[#4F9D78] hover:bg-[#3D8362] text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5"
                      : "w-full py-4 bg-[#E6A23C] hover:bg-[#C78A2C] text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5"}
                  >
                    {isPaused ? <Play className="w-5 h-5 fill-white" /> : <Pause className="w-5 h-5 fill-white" />}
                    <span>{isPaused ? 'LANJUTKAN PRESENSI' : 'PAUSE PRESENSI'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckOut}
                    className="w-full py-4 bg-[#F26B5E] hover:bg-[#D95346] text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5"
                  >
                    <Square className="w-5 h-5 fill-white" />
                    <span>CHECK-OUT & SIMPAN</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Form Options */}
          <div className="bg-white border border-[#E8E8EC] rounded-2xl p-6 shadow-2xs space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentUser.avatar}
                alt={currentUser.username}
                className="w-10 h-10 rounded-full object-cover border-2 border-[#24324A]"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-[#24324A] truncate">{currentUser.username || 'User'}</h4>
                <p className="text-[10px] text-[#737680]">Bilik Strategi ({currentUser.role})</p>
              </div>
            </div>

            <div>
              <label className="block font-bold text-[#24324A] mb-1 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#24324A]" />
                Project / Focus Area
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                disabled={isCheckedIn}
                className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A] transition-colors"
              >
                {projectsList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#24324A] mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#24324A]" />
                Catatan Pekerjaan Harian
              </label>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                disabled={isCheckedIn}
                rows={2}
                placeholder="Contoh: Mengerjakan revisi desain UI dashboard, meeting klien, dll."
                className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A] transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right: Live Team Active Check-Ins Side Panel (5 cols - Visible to All / Enhanced for Admin) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-5 rounded-2xl border border-[#E8E8EC] bg-white p-4 shadow-2xs dark:border-[#303742] dark:bg-[#171A20] sm:p-6">
          <div className="space-y-4">
            {/* Panel Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E8EC] pb-3 dark:border-[#303742]">
              <div className="flex flex-wrap items-center gap-2">
                <Users className="w-4 h-4 text-[#7B68EE]" />
                <h3 className="text-sm font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Live Presensi Tim</h3>
                {isAdminOrOwner && (
                  <span className="flex items-center gap-1 rounded-full bg-[#24324A] px-2 py-0.5 text-[9px] font-extrabold text-white dark:bg-[#F26B5E]">
                    <ShieldCheck className="w-3 h-3 text-[#4F9D78]" /> Admin View
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {isAdminOrOwner && (
                  <span className="rounded-full border border-[#4F9D78]/20 bg-[#4F9D78]/10 px-2.5 py-1 text-[10px] font-extrabold text-[#4F9D78]">
                    {activeNowCount} Aktif
                  </span>
                )}
                <span className="rounded-full border border-[#7B68EE]/20 bg-[#7B68EE]/10 px-2.5 py-1 text-[10px] font-extrabold text-[#6654CF] dark:text-[#A99CFF]">
                  {checkedInCount} Check-in
                </span>
              </div>
            </div>

            <p className="text-[11px] leading-5 text-[#737680] dark:text-[#98A2B3]">
              {isAdminOrOwner
                ? 'Check-in menunjukkan presensi aktif. Status Aktif, Idle, dan Away menunjukkan aktivitas di aplikasi Bilik Strategi secara terpisah.'
                : 'Daftar anggota yang sedang check-in. Detail aktivitas aplikasi hanya tersedia untuk Admin dan Owner.'}
            </p>

            {/* Member Active Cards List - Online members always sorted to the top */}
            <div className="max-h-[680px] space-y-2.5 overflow-y-auto pr-1">
              {[...teamStatusList]
                .sort((a, b) =>
                  presenceStateRank(resolvePresenceSnapshot(a, presenceClock).state) -
                  presenceStateRank(resolvePresenceSnapshot(b, presenceClock).state)
                )
                .map((m) => {
                  const presence = resolvePresenceSnapshot(m, presenceClock);
                  const visual = PRESENCE_VISUALS[presence.state];
                  let liveMemberDurationStr = '00:00:00';
                  if (m.isOnline && m.checkInTimestamp) {
                    const runningSeconds = m.isPaused
                      ? 0
                      : Math.max(0, Math.floor(((presenceClock || m.checkInTimestamp) - m.checkInTimestamp) / 1000));
                    const sec = Number(m.accumulatedSeconds || 0) + runningSeconds;
                    liveMemberDurationStr = formatTimer(sec);
                  }
                  const statusAge = presence.state === 'away'
                    ? formatPresenceAge(presence.unseenMs)
                    : formatPresenceAge(presence.inactiveMs);
                  const statusLabel = !isAdminOrOwner && m.isOnline && !m.isPaused
                    ? 'Sedang check-in'
                    : ['idle', 'away', 'needs_review', 'critical'].includes(presence.state)
                      ? `${visual.label} · ${statusAge}`
                      : visual.label;
                  const events = memberActivity[m.id] || [];

                return (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-3 shadow-xs transition-all ${visual.card}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.avatar}
                            alt={m.name}
                            className="h-9 w-9 rounded-full border border-current object-cover"
                          />
                          <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#171A20] ${visual.dot}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="truncate text-xs font-bold text-[#24324A] dark:text-[#F4F6FA]">{m.name}</h4>
                            <span className="text-[9px] font-semibold uppercase text-[#737680] dark:text-[#98A2B3]">{m.role}</span>
                          </div>
                          <p className="truncate text-[10px] text-[#737680] dark:text-[#98A2B3]">
                            {m.isOnline
                              ? m.isPaused
                                ? 'Dijeda sejak ' + (m.pausedAt
                                ? new Date(m.pausedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                  : '-')
                                : 'Check-in ' + (m.checkInTime || '08:30') + ' WITA'
                              : 'Belum Check-In'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 flex-col items-end gap-1.5 text-right">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[9px] font-extrabold ${visual.badge}`}>
                          {presence.state === 'away' ? <WifiOff className="h-3 w-3" /> : <span className={`h-1.5 w-1.5 rounded-full ${visual.dot}`} />}
                          {statusLabel}
                        </span>
                        {m.isOnline ? (
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-xs font-extrabold text-[#24324A] dark:text-[#F4F6FA]">
                              {liveMemberDurationStr}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {isAdminOrOwner && m.isOnline && (
                      <div className="mt-3 grid gap-2 rounded-lg border border-black/5 bg-white/55 p-2.5 text-[10px] dark:border-white/5 dark:bg-black/10 sm:grid-cols-2">
                        <div className="flex min-w-0 items-start gap-1.5 text-[#737680] dark:text-[#98A2B3]">
                          <Monitor className="mt-0.5 h-3 w-3 flex-shrink-0 text-[#7B68EE]" />
                          <span className="min-w-0">
                            <span className="block font-bold text-[#24324A] dark:text-[#F4F6FA]">Posisi terakhir</span>
                            <span className="block truncate">{m.currentPageLabel || m.currentPath || 'Menunggu data aktivitas'}</span>
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[#737680] dark:text-[#98A2B3]">
                          <MousePointer2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-[#E6A23C]" />
                          <span>
                            <span className="block font-bold text-[#24324A] dark:text-[#F4F6FA]">Aktivitas terakhir</span>
                            <span className="block">
                              {m.lastActivityAt ? `${formatPresenceAge(Math.max(0, presenceClock - Date.parse(m.lastActivityAt)))} lalu` : 'Belum terdeteksi'}
                              {m.deviceType ? ` · ${m.appMode === 'pwa' ? 'PWA' : 'Browser'} ${m.deviceType}` : ''}
                            </span>
                          </span>
                        </div>
                        <div className="min-w-0 sm:col-span-2">
                          <span className="font-bold text-[#24324A] dark:text-[#F4F6FA]">Fokus:</span>{' '}
                          <span className="text-[#737680] dark:text-[#98A2B3]">{m.project || 'Bilik Strategi Workspace'}</span>
                        </div>
                      </div>
                    )}

                    {isAdminOrOwner && m.isOnline && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => void toggleMemberActivity(m, event)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D9DDE5] bg-white px-2.5 text-[10px] font-extrabold text-[#24324A] transition hover:bg-[#F3F5F8] dark:border-[#3A414D] dark:bg-[#20242C] dark:text-[#F4F6FA] dark:hover:bg-[#292F39]"
                        >
                          <Eye className="h-3 w-3" />
                          {expandedActivityMemberId === m.id ? 'Tutup Aktivitas' : 'Lihat Aktivitas'}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => openForceCheckout(m, event)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D95858]/30 bg-[#D95858]/10 px-2.5 text-[10px] font-extrabold text-[#B13E3E] transition hover:bg-[#D95858]/15 dark:text-[#FF8585]"
                        >
                          <Power className="h-3 w-3" /> Paksa Checkout
                        </button>
                      </div>
                    )}

                    {isAdminOrOwner && expandedActivityMemberId === m.id && (
                      <div className="mt-3 rounded-xl border border-[#DDE2EA] bg-white p-3 dark:border-[#3A414D] dark:bg-[#20242C]">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#24324A] dark:text-[#F4F6FA]">Aktivitas di Bilik Strategi</p>
                          <span className="text-[9px] text-[#8A8E98]">30 aktivitas terakhir</span>
                        </div>
                        {activityLoadingId === m.id ? (
                          <div className="flex items-center gap-2 py-3 text-[10px] text-[#737680] dark:text-[#98A2B3]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat aktivitas...</div>
                        ) : activityError[m.id] ? (
                          <p className="rounded-lg bg-[#D95858]/10 p-2 text-[10px] font-semibold text-[#B13E3E] dark:text-[#FF8585]">{activityError[m.id]}</p>
                        ) : events.length === 0 ? (
                          <p className="py-3 text-[10px] text-[#737680] dark:text-[#98A2B3]">Belum ada perpindahan halaman atau interaksi yang tercatat.</p>
                        ) : (
                          <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                            {events.map((activityEvent) => (
                              <div key={activityEvent.id} className="flex items-start justify-between gap-3 rounded-lg bg-[#F7F7F8] px-2.5 py-2 dark:bg-[#171A20]">
                                <div className="min-w-0">
                                  <p className="truncate text-[10px] font-bold text-[#24324A] dark:text-[#F4F6FA]">
                                    {activityEvent.event_type === 'page_view'
                                      ? `Membuka ${activityEvent.page_label || activityEvent.page_path || 'halaman'}`
                                      : activityEvent.event_type === 'forced_checkout'
                                        ? 'Checkout paksa oleh admin'
                                        : `Aktif di ${activityEvent.page_label || activityEvent.page_path || 'aplikasi'}`}
                                  </p>
                                  <p className="truncate text-[9px] text-[#8A8E98]">
                                    {[activityEvent.app_mode === 'pwa' ? 'PWA' : 'Browser', activityEvent.device_type].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                                <time className="flex-shrink-0 text-[9px] font-semibold text-[#737680] dark:text-[#98A2B3]">
                                  {new Date(activityEvent.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </time>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="mt-2 text-[9px] leading-4 text-[#8A8E98]">Hanya Admin/Owner yang dapat melihat timeline ini. Isi ketikan, screenshot, dan aktivitas di aplikasi lain tidak direkam.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isAdminOrOwner && <div className="rounded-xl border border-[#E8E8EC] bg-[#EEF2F7] p-3 text-[11px] text-[#24324A] dark:border-[#303742] dark:bg-[#20242C] dark:text-[#F4F6FA]">
            <p className="flex items-center gap-1 font-bold">
              <Activity className="w-3.5 h-3.5 text-[#4F9D78]" /> Real-Time Monitoring:
            </p>
            <p className="mt-1 text-[#737680] dark:text-[#98A2B3]">
              Idle mulai 5 menit, Away saat heartbeat aplikasi terputus, peringatan setelah 2 jam, dan status kritis setelah 4 jam.
            </p>
            {reviewCount > 0 && <p className="mt-1 font-extrabold text-[#D95858]">{reviewCount} anggota perlu diverifikasi oleh admin.</p>}
          </div>}
        </div>
      </div>

      {/* History Log Table with Admin Multi-User View */}
      <div className="bg-white border border-[#E8E8EC] rounded-2xl p-6 shadow-2xs space-y-4">
        {/* Header & Tab Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E8E8EC] pb-4">
          <div className="flex items-center gap-2">
            {isAdminOrOwner ? (
              <div className="flex items-center gap-1.5 bg-[#F7F7F8] p-1 rounded-xl border border-[#E8E8EC]">
                <button
                  type="button"
                  onClick={() => setHistoryTab('my-history')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    historyTab === 'my-history'
                      ? 'bg-[#24324A] text-white shadow-xs'
                      : 'text-[#737680] hover:text-[#24324A]'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Riwayat Saya</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setHistoryTab('team-history');
                    fetchAllUsersHistory();
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    historyTab === 'team-history'
                      ? 'bg-[#24324A] text-white shadow-xs'
                      : 'text-[#737680] hover:text-[#24324A]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-[#F26B5E]" />
                  <span>Monitor History Tim (Semua User)</span>
                  <span className="px-1.5 py-0.5 bg-[#4F9D78] text-white text-[9px] font-extrabold rounded-md">
                    Admin
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#24324A]" />
                <h3 className="text-sm font-extrabold text-[#24324A]">Riwayat Presensi & Pengajuan Izin Saya</h3>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportCSV(isAdminOrOwner && historyTab === 'team-history' ? allUsersHistory : history)}
              className="px-3 py-1.5 bg-white border border-[#E8E8EC] hover:bg-[#F7F7F8] text-[#24324A] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Download Data Presensi ke CSV/Excel"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#4F9D78]" />
              <span>Export CSV</span>
            </button>

            {isAdminOrOwner && (
              <button
                type="button"
                onClick={() => setShowAdminResetModal(true)}
                className="px-3 py-1.5 bg-[#FFF0ED] border border-[#F26B5E]/30 hover:bg-[#F26B5E] text-[#F26B5E] hover:text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Reset seluruh riwayat presensi semua user"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Riwayat Tim</span>
              </button>
            )}

            <span className="text-xs font-bold text-[#737680] bg-[#F7F7F8] px-2.5 py-1 rounded-lg border border-[#E8E8EC]">
              {isAdminOrOwner && historyTab === 'team-history' ? allUsersHistory.length : history.length} Entri
            </span>
          </div>
        </div>

        {/* Filters bar for Team History Mode (Admin Only) */}
        {isAdminOrOwner && historyTab === 'team-history' && (
          <div className="p-3 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5 font-bold text-[#24324A]">
                <User className="w-3.5 h-3.5 text-[#F26B5E]" />
                <span>Filter User:</span>
              </div>
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="p-1.5 bg-white border border-[#E8E8EC] rounded-lg text-xs font-semibold outline-none focus:border-[#24324A]"
              >
                <option value="ALL">Semua Anggota Tim</option>
                {Array.from(new Set(allUsersHistory.map((r) => r.user_name || 'User'))).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5 font-bold text-[#24324A] ml-2">
                <span>Status:</span>
              </div>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="p-1.5 bg-white border border-[#E8E8EC] rounded-lg text-xs font-semibold outline-none focus:border-[#24324A]"
              >
                <option value="ALL">Semua Status</option>
                <option value="HADIR">HADIR</option>
                <option value="ALPHA">ALPHA (&lt;1h)</option>
                <option value="LEMBUR">LEMBUR</option>
                <option value="IZIN">IZIN</option>
                <option value="SAKIT">SAKIT</option>
                <option value="CUTI">CUTI</option>
              </select>
            </div>

            <div className="relative max-w-xs w-full">
              <input
                type="text"
                placeholder="Cari nama user / catatan..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-[#E8E8EC] rounded-lg text-xs font-medium outline-none focus:border-[#24324A]"
              />
            </div>
          </div>
        )}

        {/* Table Body Component */}
        {(() => {
          const displayList = historyTab === 'my-history'
            ? history
            : allUsersHistory.filter((rec) => {
                const matchUser = selectedUserFilter === 'ALL' || (rec.user_name || '').toLowerCase() === selectedUserFilter.toLowerCase();
                const matchStatus = selectedStatusFilter === 'ALL' || rec.status === selectedStatusFilter;
                const matchSearch =
                  !historySearchQuery.trim() ||
                  (rec.user_name || '').toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                  (rec.notes || '').toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                  (rec.date || '').includes(historySearchQuery);
                return matchUser && matchStatus && matchSearch;
              });

          if (displayList.length === 0) {
            return (
              <div className="text-center py-10 text-xs text-[#737680] space-y-1">
                <p className="font-bold text-[#24324A]">Belum ada riwayat presensi yang terekam</p>
                <p>
                  {historyTab === 'team-history'
                    ? 'Tidak ada data presensi tim yang cocok dengan filter pencarian.'
                    : 'Klik tombol Check-In atau Form Izin di atas untuk mulai mencatat presensi pertama Anda.'}
                </p>
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F7F7F8] border-b border-[#E8E8EC] text-[#737680] font-bold uppercase tracking-wider">
                    {historyTab === 'team-history' && <th className="py-3 px-4">Anggota Tim</th>}
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Jam Masuk</th>
                    <th className="py-3 px-4">Jam Keluar</th>
                    <th className="py-3 px-4 text-center">Durasi Total</th>
                    <th className="py-3 px-4 text-center">Lembur (OT)</th>
                    <th className="py-3 px-4">Project / Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8EC]">
                  {displayList.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#F7F7F8] transition-colors">
                      {historyTab === 'team-history' && (
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                rec.user_avatar ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(rec.user_name || 'User')}&background=24324A&color=fff`
                              }
                              alt={rec.user_name}
                              className="w-7 h-7 rounded-full object-cover border border-[#24324A]"
                            />
                            <span className="font-extrabold text-[#24324A]">{rec.user_name || 'User'}</span>
                          </div>
                        </td>
                      )}
                      <td className="py-3 px-4 font-bold text-[#24324A]">
                        {rec.date} ({rec.day_name})
                      </td>
                      <td className="py-3 px-4">
                        {rec.status === 'HADIR' && (
                          <span className="px-2.5 py-1 bg-[#4F9D78]/10 text-[#4F9D78] border border-[#4F9D78]/30 rounded-lg font-bold">
                            ✓ HADIR
                          </span>
                        )}
                        {rec.status === 'ALPHA' && (
                          <span className="px-2.5 py-1 bg-[#F26B5E]/10 text-[#F26B5E] border border-[#F26B5E]/30 rounded-lg font-bold">
                            ⚠️ ALPHA (&lt;1h)
                          </span>
                        )}
                        {rec.status === 'LEMBUR' && (
                          <span className="px-2.5 py-1 bg-[#E6A23C]/10 text-[#B87C24] border border-[#E6A23C]/30 rounded-lg font-bold">
                            🔥 LEMBUR ({rec.overtime_hours}h)
                          </span>
                        )}
                        {(rec.status === 'IZIN' || rec.status === 'SAKIT' || rec.status === 'CUTI') && (
                          <span className="px-2.5 py-1 bg-[#7B68EE]/10 text-[#7B68EE] border border-[#7B68EE]/30 rounded-lg font-bold">
                            {rec.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#4F9D78] font-bold">
                        {rec.check_in_time !== '-' ? rec.check_in_time : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#F26B5E] font-bold">
                        {rec.check_out_time !== '-' ? rec.check_out_time : '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#24324A] bg-[#EEF2F7]/50 rounded-lg">
                        {rec.duration_hours} Jam
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-[#E6A23C]">
                        {rec.overtime_hours > 0 ? `+${rec.overtime_hours} Jam` : '-'}
                      </td>
                      <td className="py-3 px-4 text-[#737680] max-w-xs truncate">{rec.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Admin force-checkout confirmation with a durable audit reason. */}
      {forceCheckoutTarget && createPortal(
        <div data-mobile-modal className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 backdrop-blur-xs animate-fade-in sm:items-center sm:p-4">
          <div data-mobile-modal-panel className="relative max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#E8E8EC] bg-white p-5 shadow-2xl dark:border-[#303742] dark:bg-[#171A20] sm:rounded-2xl sm:p-6">
            <button
              type="button"
              onClick={() => setForceCheckoutTarget(null)}
              disabled={forceCheckoutSaving}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-[#737680] hover:bg-[#F2F4F7] hover:text-[#24324A] disabled:opacity-50 dark:hover:bg-[#252A33] dark:hover:text-white"
              aria-label="Tutup konfirmasi checkout paksa"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-3 border-b border-[#E8E8EC] pb-4 pr-8 dark:border-[#303742]">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-[#D95858]/25 bg-[#D95858]/10 text-[#D95858]">
                <Power className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#D95858]">Kontrol Admin</p>
                <h3 className="mt-0.5 text-base font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Paksa checkout {forceCheckoutTarget.name}?</h3>
                <p className="mt-1 text-xs leading-5 text-[#737680] dark:text-[#98A2B3]">
                  Sesi akan dihentikan pada semua perangkat dan tetap dibuatkan riwayat presensi dengan nama admin serta alasannya.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setForceCheckoutAtLastActivity(false)}
                className={`rounded-xl border p-3 text-left transition ${!forceCheckoutAtLastActivity
                  ? 'border-[#24324A] bg-[#EEF2F7] dark:border-[#F26B5E] dark:bg-[#2A2528]'
                  : 'border-[#E8E8EC] bg-white dark:border-[#303742] dark:bg-[#20242C]'}`}
              >
                <span className="block text-xs font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Checkout sekarang</span>
                <span className="mt-1 block text-[10px] leading-4 text-[#737680] dark:text-[#98A2B3]">Seluruh durasi hingga tindakan admin tetap dihitung.</span>
              </button>
              <button
                type="button"
                onClick={() => forceCheckoutTarget.lastActivityAt && setForceCheckoutAtLastActivity(true)}
                disabled={!forceCheckoutTarget.lastActivityAt}
                className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${forceCheckoutAtLastActivity
                  ? 'border-[#24324A] bg-[#EEF2F7] dark:border-[#F26B5E] dark:bg-[#2A2528]'
                  : 'border-[#E8E8EC] bg-white dark:border-[#303742] dark:bg-[#20242C]'}`}
              >
                <span className="block text-xs font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Aktivitas app terakhir</span>
                <span className="mt-1 block text-[10px] leading-4 text-[#737680] dark:text-[#98A2B3]">
                  {forceCheckoutTarget.lastActivityAt
                    ? `${formatPresenceAge(Math.max(0, presenceClock - Date.parse(forceCheckoutTarget.lastActivityAt)))} lalu`
                    : 'Belum ada heartbeat aktivitas.'}
                </span>
              </button>
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#737680] dark:text-[#98A2B3]">Alasan checkout paksa</span>
              <textarea
                value={forceCheckoutReason}
                onChange={(event) => setForceCheckoutReason(event.target.value)}
                rows={3}
                maxLength={320}
                placeholder="Contoh: User lupa checkout dan sudah dikonfirmasi melalui WhatsApp."
                className="w-full resize-none rounded-xl border border-[#DDE2EA] bg-white p-3 text-xs font-medium text-[#24324A] outline-none focus:border-[#D95858] dark:border-[#3A414D] dark:bg-[#20242C] dark:text-[#F4F6FA]"
              />
            </label>

            <div className="mt-3 rounded-xl border border-[#E6A23C]/25 bg-[#E6A23C]/10 p-3 text-[10px] leading-4 text-[#8A641F] dark:text-[#F1BA64]">
              Tidak ada aktivitas di app bukan bukti pasti tidak bekerja. Verifikasi dulu kemungkinan meeting, produksi lapangan, atau pekerjaan di aplikasi lain.
            </div>

            {forceCheckoutError && (
              <p className="mt-3 rounded-xl bg-[#D95858]/10 p-3 text-xs font-semibold text-[#B13E3E] dark:text-[#FF8585]">{forceCheckoutError}</p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setForceCheckoutTarget(null)}
                disabled={forceCheckoutSaving}
                className="h-10 rounded-xl border border-[#DDE2EA] px-4 text-xs font-extrabold text-[#737680] disabled:opacity-50 dark:border-[#3A414D] dark:text-[#CBD2DC]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleAdminForceCheckout()}
                disabled={forceCheckoutSaving || !forceCheckoutReason.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#D95858] px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#C74747] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {forceCheckoutSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                Hentikan Sesi & Simpan Riwayat
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Form Pengajuan Izin / Sakit / Cuti */}
      {showLeaveModal && createPortal(
        <div data-mobile-modal className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div data-mobile-modal-panel className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative z-[101]">
            <button
              onClick={() => setShowLeaveModal(false)}
              className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 border-b border-[#E8E8EC] pb-3">
              <FileCheck2 className="w-5 h-5 text-[#7B68EE]" />
              <h3 className="text-base font-extrabold text-[#24324A]">Form Pengajuan Izin / Cuti / Sakit</h3>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#24324A] mb-1.5">Jenis Pengajuan Presensi</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveType('IZIN')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer text-center ${
                      leaveType === 'IZIN'
                        ? 'bg-[#24324A] text-white border-[#24324A]'
                        : 'bg-[#F7F7F8] text-[#737680] border-[#E8E8EC] hover:bg-[#EEF2F7]'
                    }`}
                  >
                    📝 Izin
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('SAKIT')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer text-center ${
                      leaveType === 'SAKIT'
                        ? 'bg-[#24324A] text-white border-[#24324A]'
                        : 'bg-[#F7F7F8] text-[#737680] border-[#E8E8EC] hover:bg-[#EEF2F7]'
                    }`}
                  >
                    🤒 Sakit
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('CUTI')}
                    className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer text-center ${
                      leaveType === 'CUTI'
                        ? 'bg-[#24324A] text-white border-[#24324A]'
                        : 'bg-[#F7F7F8] text-[#737680] border-[#E8E8EC] hover:bg-[#EEF2F7]'
                    }`}
                  >
                    🏖️ Cuti
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Alasan / Keterangan Pengajuan</label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Contoh: Sakit flu berat (ada surat dokter) / Izin mendadak urusan keluarga."
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A] transition-colors resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] hover:text-[#24324A] rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7B68EE] hover:bg-[#6852ED] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Pengajuan</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Admin Confirmation: Reset Semua Presensi Tim */}
      {showAdminResetModal && createPortal(
        <div data-mobile-modal className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div data-mobile-modal-panel className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative z-[101]">
            <button
              onClick={() => setShowAdminResetModal(false)}
              className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4 border-b border-[#E8E8EC] pb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center flex-shrink-0 shadow-xs">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#24324A]">Reset Semua Riwayat Presensi Tim?</h3>
                <p className="text-xs text-[#737680] mt-1 leading-relaxed">
                  Apakah Anda yakin ingin menghapus <strong className="text-[#24324A]">SELURUH riwayat presensi & pengajuan izin milik SEMUA anggota tim</strong>?
                  Tindakan ini berlaku ke seluruh user workspace dan <strong className="text-[#F26B5E]">TIDAK DAPAT DIBATALKAN</strong>.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowAdminResetModal(false)}
                className="px-4 py-2.5 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl font-bold hover:text-[#24324A] cursor-pointer transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAdminMasterResetAll}
                className="px-5 py-2.5 bg-[#F26B5E] hover:bg-[#D95346] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
                <span>Hapus & Reset Semua Data</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
