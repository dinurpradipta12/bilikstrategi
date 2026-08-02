'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Clock,
  Play,
  Square,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  FileText,
  User,
  ArrowRight,
  History,
  Sparkles,
  FileCheck2,
  UserX,
  Stethoscope,
  Umbrella,
  Send,
  X,
  ShieldCheck,
  Users,
  Activity,
  BarChart3,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

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
  project?: string;
  statusText?: string;
}

export default function AttendancePage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    avatar: string;
    role: 'Owner' | 'Admin' | 'Member';
  }>({
    id: 'user-1',
    username: 'Dinur Pradipta',
    avatar: 'https://ui-avatars.com/api/?name=Dinur+Pradipta&background=24324A&color=fff',
    role: 'Owner',
  });

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // Live Check-in State
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkInTimestamp, setCheckInTimestamp] = useState<number | null>(null);
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

  // 1. Fetch User Profile, Projects, & Team Members on Mount
  useEffect(() => {
    async function loadUserAndData() {
      try {
        const userRes = await fetch('/api/clickup/user');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user) {
            const roleNum = userData.user.role;
            const roleStr = roleNum === 1 ? 'Owner' : roleNum === 2 ? 'Admin' : 'Member';
            setCurrentUser({
              id: String(userData.user.id),
              username: userData.user.username,
              avatar:
                userData.user.profilePicture ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.user.username)}&background=24324A&color=fff`,
              role: roleStr,
            });
          }
        }

        const projRes = await fetch('/api/clickup/projects');
        if (projRes.ok) {
          const projData = await projRes.json();
          if (Array.isArray(projData.projects) && projData.projects.length > 0) {
            setProjectsList(projData.projects.map((p: any) => p.name));
          }
        }

        // Fetch ClickUp team members for Admin panel & Role resolution
        const teamRes = await fetch('/api/clickup/teams');
        let resolvedUserRole: 'Owner' | 'Admin' | 'Member' = 'Owner';

        if (teamRes.ok) {
          const teamData = await teamRes.json();
          const clickUpMembers = Array.isArray(teamData.members) ? teamData.members : [];

          // Find current user in workspace members to resolve exact role
          const matchedMember = clickUpMembers.find((m: any) => {
            const mName = (m.username || '').toLowerCase().trim();
            const uName = (currentUser.username || '').toLowerCase().trim();
            return mName === uName || mName.includes(uName) || uName.includes(mName);
          });

          if (matchedMember) {
            resolvedUserRole = matchedMember.role === 1 ? 'Owner' : matchedMember.role === 2 ? 'Admin' : 'Member';
          }

          // Real base active team list (defaults to offline unless real check-in performed)
          const baseTeam: TeamMemberStatus[] = clickUpMembers.map((m: any) => {
            return {
              id: String(m.id),
              name: m.username || m.email.split('@')[0],
              email: m.email,
              role: m.role === 1 ? 'Owner' : m.role === 2 ? 'Admin' : 'Member',
              avatar:
                m.profilePicture ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username || 'User')}&background=24324A&color=fff`,
              isOnline: false,
              checkInTime: undefined,
              checkInTimestamp: undefined,
              project: undefined,
              statusText: 'Belum Check-In',
            };
          });

          setTeamStatusList(baseTeam);

          // Immediately sync live real-time status with Supabase for all team members
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
    }

    loadUserAndData();
  }, []);

  // 2. Real-time Clock & Elapsed Timer Ticker (Self + Team Members)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
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

      if (isCheckedIn && checkInTimestamp) {
        const diffSec = Math.floor((now.getTime() - checkInTimestamp) / 1000);
        setElapsedSeconds(diffSec > 0 ? diffSec : 0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isCheckedIn, checkInTimestamp]);

  // Sync live status directly from Supabase DB (Single Source of Truth)
  const syncRealTimeTeamAttendance = async () => {
    try {
      // 1. Direct Supabase DB active_sessions fetch via REST API
      let supabaseActiveList: any[] = [];
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://spnawjvexcwhhyfavvew.supabase.co';
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbmF3anZleGN3aGh5ZmF2dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjU1NDgsImV4cCI6MjEwMDk0MTU0OH0.IYNTrKH7s5aTBcRREiBgq1SOw5ONBcP0uxWpC_tSznU';

        const restRes = await fetch(`${url}/rest/v1/active_sessions?select=*`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          cache: 'no-store',
        });
        if (restRes.ok) {
          const restData = await restRes.json();
          if (Array.isArray(restData)) {
            supabaseActiveList = restData.map((row: any) => ({
              user_name: row.user_name,
              user_avatar: row.user_avatar,
              checkInTime: row.check_in_time,
              checkInTimestamp: Number(row.check_in_timestamp),
              selectedProject: row.selected_project,
              notesInput: row.notes_input || '',
            }));
          }
        }
      } catch {
        // ignore
      }

      setTeamStatusList((prev) =>
        prev.map((m) => {
          const mNameClean = (m.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const mEmailPrefix = (m.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          const currentClean = (currentUser.username || '').toLowerCase().replace(/[^a-z0-9]/g, '');

          const isMe = mNameClean.length > 2 && (mNameClean === currentClean || mNameClean.includes(currentClean) || currentClean.includes(mNameClean));

          // If current user is checked out locally, FORCE OFFLINE on panel
          if (isMe && !isCheckedIn) {
            return {
              ...m,
              isOnline: false,
              checkInTime: undefined,
              checkInTimestamp: undefined,
              project: undefined,
              statusText: 'Belum Check-In',
            };
          }

          const active = supabaseActiveList.find((a: any) => {
            const aNameClean = (a.user_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
              project: active.selectedProject || 'Bilik Strategi Workspace',
              statusText: 'Online & Bekerja',
            };
          }

          return {
            ...m,
            isOnline: false,
            checkInTime: undefined,
            checkInTimestamp: undefined,
            project: undefined,
            statusText: 'Belum Check-In',
          };
        })
      );
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
  }, [isCheckedIn, checkInTime, checkInTimestamp, selectedProject, currentUser.username]);

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
  }, []);

  // Admin Quick Action: Toggle Check-In for any Team Member
  const handleAdminToggleMemberCheckIn = async (member: TeamMemberStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const startTimeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const startTimestamp = now.getTime();

    if (!member.isOnline) {
      const activeObj = {
        user_name: member.name,
        user_avatar: member.avatar,
        checkInTime: startTimeStr,
        checkInTimestamp: startTimestamp,
        selectedProject: 'Bilik Strategi Workspace',
        notesInput: 'Check-In via Admin',
      };

      try {
        const storeStr = localStorage.getItem('bilik_team_active_store');
        const storeMap = storeStr ? JSON.parse(storeStr) : {};
        storeMap[member.name.toLowerCase()] = activeObj;
        localStorage.setItem('bilik_team_active_store', JSON.stringify(storeMap));
      } catch {}

      try {
        await supabase.from('active_sessions').upsert({
          user_name: member.name,
          user_avatar: member.avatar,
          check_in_time: startTimeStr,
          check_in_timestamp: startTimestamp,
          selected_project: 'Bilik Strategi Workspace',
          notes_input: 'Check-In via Admin',
          updated_at: new Date().toISOString(),
        });
      } catch {}

      fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkin',
          user_name: member.name,
          user_avatar: member.avatar,
          selectedProject: 'Bilik Strategi Workspace',
          notesInput: 'Check-In via Admin',
          checkInTime: startTimeStr,
          checkInTimestamp: startTimestamp,
        }),
      }).catch(() => {});
    } else {
      try {
        const storeStr = localStorage.getItem('bilik_team_active_store');
        if (storeStr) {
          const storeMap = JSON.parse(storeStr);
          delete storeMap[member.name.toLowerCase()];
          localStorage.setItem('bilik_team_active_store', JSON.stringify(storeMap));
        }
      } catch {}

      try {
        await supabase.from('active_sessions').delete().eq('user_name', member.name);
      } catch {}

      fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkout',
          user_name: member.name,
        }),
      }).catch(() => {});
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('bilik_attendance_channel');
        bc.postMessage({ type: 'SYNC_ATTENDANCE' });
        bc.close();
      } catch {}
    }

    syncRealTimeTeamAttendance();
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
    setElapsedSeconds(0);
    setLastCheckOutNotice(null);

    const activeObj = {
      user_name: currentUser.username,
      checkInTime: startTimeStr,
      checkInTimestamp: startTimestamp,
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

    const diffMs = now.getTime() - checkInTimestamp;
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
  const onlineCount = teamStatusList.filter((m) => m.isOnline).length;
  const isAdminOrOwner = currentUser.role === 'Owner' || currentUser.role === 'Admin';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12 relative">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E8EC] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Presensi & Live Tracker</h1>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-[#EEF2F7] text-[#24324A] rounded-md border border-[#E8E8EC]">
              @bilik-strategi
            </span>
          </div>
          <p className="text-xs text-[#737680] mt-1">
            Min 1 jam bekerja (dibawah 1 jam = Alpha). Lebih dari 8 jam masuk Rekap Lembur. Panel khusus Admin menampilkan daftar anggota tim online secara live!
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-nowrap">
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 h-10 bg-white border border-[#E8E8EC] text-[#24324A] hover:bg-[#F7F7F8] hover:border-[#D1D5DB] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-[#7B68EE] flex-shrink-0" />
            <span>Form Izin / Sakit / Cuti</span>
          </button>

          <Link
            href="/team?tab=timesheet"
            className="flex items-center gap-2 px-4 py-2.5 h-10 bg-[#24324A] text-white rounded-xl text-xs font-bold hover:bg-[#1A2536] transition-all shadow-2xs whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4 text-[#4F9D78] flex-shrink-0" />
            <span>Rekap Timesheet & Lembur</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#F26B5E] flex-shrink-0 ml-0.5" />
          </Link>
        </div>
      </div>

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

      {/* Main Layout: Left Timer + Right Settings & Admin Live Team Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Giant Live Timer Card + Personal Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl p-6 shadow-2xs flex flex-col justify-between relative overflow-hidden min-h-[360px]">
            {/* Top Status & Date */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isCheckedIn ? 'bg-[#4F9D78] animate-ping' : 'bg-[#737680]'
                  }`}
                />
                <span className="text-xs font-bold text-[#24324A]">
                  {isCheckedIn ? 'Status: SEDANG BEKERJA (LIVE)' : 'Status: BELUM CHECK-IN'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#737680] font-semibold bg-[#F7F7F8] px-3 py-1 rounded-lg border border-[#E8E8EC]">
                <Calendar className="w-3.5 h-3.5 text-[#24324A]" />
                <span>{currentDateStr || 'Hari ini'}</span>
              </div>
            </div>

            {/* Center Timer Display */}
            <div className="my-8 text-center space-y-3">
              <span className="text-[11px] font-bold text-[#737680] uppercase tracking-widest block">
                {isCheckedIn ? 'Durasi Jam Kerja Berjalan' : 'Waktu Real-Time Saat Ini'}
              </span>
              <div className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tight text-[#24324A]">
                {isCheckedIn ? formatTimer(elapsedSeconds) : currentTime || '00 : 00 : 00'}
              </div>

              {isCheckedIn ? (
                <div className="space-y-1">
                  {checkInTime && (
                    <p className="text-xs font-semibold text-[#4F9D78] bg-[#4F9D78]/10 inline-block px-3 py-1 rounded-full border border-[#4F9D78]/20">
                      ✓ Check-in masuk sejak pukul <b>{checkInTime} WIB</b>
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

            {/* Action Check-In / Check-Out Button */}
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
                <button
                  type="button"
                  onClick={handleCheckOut}
                  className="w-full py-4 bg-[#F26B5E] hover:bg-[#D95346] text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5"
                >
                  <Square className="w-5 h-5 fill-white" />
                  <span>CHECK-OUT (SELESAI & SIMPAN KE TIMESHEET)</span>
                </button>
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
                <h4 className="text-xs font-bold text-[#24324A] truncate">{currentUser.username}</h4>
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
        <div className="lg:col-span-5 bg-white border border-[#E8E8EC] rounded-2xl p-6 shadow-2xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#7B68EE]" />
                <h3 className="text-sm font-extrabold text-[#24324A]">Live Presensi Tim</h3>
                {isAdminOrOwner && (
                  <span className="px-2 py-0.5 bg-[#24324A] text-white text-[9px] font-extrabold rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-[#4F9D78]" /> Admin View
                  </span>
                )}
              </div>
              <span className="px-2.5 py-1 bg-[#4F9D78]/10 text-[#4F9D78] rounded-full text-[11px] font-extrabold border border-[#4F9D78]/20">
                {onlineCount} / {teamStatusList.length} Online
              </span>
            </div>

            <p className="text-[11px] text-[#737680]">
              Daftar anggota tim yang sedang aktif bekerja beserta durasi online check-in secara real-time.
            </p>

            {/* Member Active Cards List - Online members always sorted to the top */}
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {[...teamStatusList]
                .sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0))
                .map((m) => {
                  let liveMemberDurationStr = '00:00:00';
                  if (m.isOnline && m.checkInTimestamp) {
                    const sec = Math.max(0, Math.floor((Date.now() - m.checkInTimestamp) / 1000));
                    liveMemberDurationStr = formatTimer(sec);
                  }

                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl border transition-all ${
                      m.isOnline
                        ? 'bg-[#FFFFFF] border-[#4F9D78]/40 shadow-xs'
                        : 'bg-[#F7F7F8] border-[#E8E8EC] opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.avatar}
                            alt={m.name}
                            className={`w-9 h-9 rounded-full object-cover border ${
                              m.isOnline ? 'border-[#4F9D78]' : 'border-[#E8E8EC]'
                            }`}
                          />
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                              m.isOnline ? 'bg-[#4F9D78]' : 'bg-[#737680]'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-[#24324A] truncate">{m.name}</h4>
                            <span className="text-[9px] text-[#737680] font-semibold uppercase">{m.role}</span>
                          </div>
                          <p className="text-[10px] text-[#737680] truncate">
                            {m.isOnline ? `Check-In ${m.checkInTime || '08:30'} WIB` : 'Belum Check-In'}
                          </p>
                        </div>
                      </div>

                      {/* Online Status & Live Duration Badge */}
                      <div className="text-right flex-shrink-0">
                        {m.isOnline ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#4F9D78]/10 text-[#4F9D78] rounded-lg font-mono font-extrabold text-xs border border-[#4F9D78]/30 shadow-2xs">
                              <span className="w-2 h-2 rounded-full bg-[#4F9D78] animate-ping" />
                              {liveMemberDurationStr}
                            </span>
                            <p className="text-[10px] font-extrabold text-[#7B68EE] mt-1 truncate max-w-[130px]">
                              {m.project || 'Bilik Strategi Workspace'}
                            </p>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 bg-[#F7F7F8] text-[#737680] rounded-lg font-bold text-[11px] border border-[#E8E8EC]">
                            Offline
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-[#EEF2F7] rounded-xl border border-[#E8E8EC] text-[11px] text-[#24324A]">
            <p className="font-bold flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-[#4F9D78]" /> Real-Time Monitoring:
            </p>
            <p className="text-[#737680]">
              Durasi online seluruh tim berjalan otomatis setiap detik untuk pemantauan presensi yang akurat.
            </p>
          </div>
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-white border border-[#E8E8EC] rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#24324A]" />
            <h3 className="text-sm font-extrabold text-[#24324A]">Riwayat Presensi & Pengajuan Izin Saya</h3>
          </div>
          <span className="text-xs font-bold text-[#737680]">{history.length} Entri Dicatat</span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#737680] space-y-1">
            <p className="font-bold text-[#24324A]">Belum ada riwayat presensi</p>
            <p>Klik tombol Check-In atau Form Izin di atas untuk mulai mencatat presensi pertama Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F7F8] border-b border-[#E8E8EC] text-[#737680] font-bold uppercase tracking-wider">
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
                {history.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#F7F7F8] transition-colors">
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
        )}
      </div>

      {/* Modal Form Pengajuan Izin / Sakit / Cuti */}
      {showLeaveModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative z-[101]">
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
    </div>
  );
}
