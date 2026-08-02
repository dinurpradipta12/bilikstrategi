'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Briefcase,
  RefreshCw,
  Lock,
  BarChart2,
  Flag,
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Activity,
  Zap,
  Edit3,
  Mail,
  Phone,
  Building2,
  X,
  Send,
  UserPlus,
  CalendarDays,
  SlidersHorizontal,
} from 'lucide-react';

interface TeamMemberWorkload {
  id: string;
  full_name: string;
  email: string;
  role: string;
  custom_role?: string;
  division?: string;
  phone?: string;
  avatar_url: string;
  assigned_tasks_count: number;
  overdue_tasks_count: number;
  completed_tasks_count: number;
  hours_tracked: number;
  capacity_hours: number;
  workload_status: 'low' | 'balanced' | 'high' | 'over_capacity';
  projects: Array<{ name: string; progress: number }>;
  tasks?: Array<{ id: string; name: string; priority: string; progress: number }>;
}

export default function TeamWorkloadPage() {
  const [activeTab, setActiveTab] = useState<'workload' | 'team_list' | 'analytics' | 'priorities' | 'timesheet'>('workload');
  const [mounted, setMounted] = useState(false);
  const [members, setMembers] = useState<TeamMemberWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<'Owner' | 'Admin' | 'Member'>('Owner');
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [timesheetRecap, setTimesheetRecap] = useState<Record<string, Record<string, any>>>({});

  // Edit Member Modal State
  const [editingMember, setEditingMember] = useState<TeamMemberWorkload | null>(null);
  const [formRole, setFormRole] = useState('');
  const [formDivision, setFormDivision] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCapacity, setFormCapacity] = useState(40);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);

  // ------------------------------------------------------------------------
  // TIMESHEET RECORDING PERIOD RANGE STATE
  // ------------------------------------------------------------------------
  type PeriodMode = 'weekly' | 'monthly' | 'custom';
  const [periodMode, setPeriodMode] = useState<PeriodMode>('weekly');

  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day;
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  });

  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + 6;
    const end = new Date(d.setDate(diff));
    end.setHours(23, 59, 59, 999);
    return end;
  });

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [customStartStr, setCustomStartStr] = useState<string>('');
  const [customEndStr, setCustomEndStr] = useState<string>('');

  const handlePrevPeriod = () => {
    if (periodMode === 'weekly') {
      const newStart = new Date(startDate);
      newStart.setDate(newStart.getDate() - 7);
      const newEnd = new Date(endDate);
      newEnd.setDate(newEnd.getDate() - 7);
      setStartDate(newStart);
      setEndDate(newEnd);
    } else if (periodMode === 'monthly') {
      const newStart = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
      const newEnd = new Date(startDate.getFullYear(), startDate.getMonth(), 0, 23, 59, 59);
      setStartDate(newStart);
      setEndDate(newEnd);
    } else {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 7;
      const newStart = new Date(startDate);
      newStart.setDate(newStart.getDate() - diffDays);
      const newEnd = new Date(endDate);
      newEnd.setDate(newEnd.getDate() - diffDays);
      setStartDate(newStart);
      setEndDate(newEnd);
    }
  };

  const handleNextPeriod = () => {
    if (periodMode === 'weekly') {
      const newStart = new Date(startDate);
      newStart.setDate(newStart.getDate() + 7);
      const newEnd = new Date(endDate);
      newEnd.setDate(newEnd.getDate() + 7);
      setStartDate(newStart);
      setEndDate(newEnd);
    } else if (periodMode === 'monthly') {
      const newStart = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
      const newEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 2, 0, 23, 59, 59);
      setStartDate(newStart);
      setEndDate(newEnd);
    } else {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 7;
      const newStart = new Date(startDate);
      newStart.setDate(newStart.getDate() + diffDays);
      const newEnd = new Date(endDate);
      newEnd.setDate(newEnd.getDate() + diffDays);
      setStartDate(newStart);
      setEndDate(newEnd);
    }
  };

  const handleSelectPreset = (mode: PeriodMode) => {
    setPeriodMode(mode);
    const now = new Date();
    if (mode === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day;
      const start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      setStartDate(start);
      setEndDate(end);
    } else if (mode === 'monthly') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);

      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);

      setStartDate(start);
      setEndDate(end);
    } else if (mode === 'custom') {
      setCustomStartStr(startDate.toISOString().split('T')[0]);
      setCustomEndStr(endDate.toISOString().split('T')[0]);
      setShowPeriodModal(true);
    }
  };

  const handleSaveCustomPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStartStr || !customEndStr) return;

    const s = new Date(customStartStr);
    s.setHours(0, 0, 0, 0);

    const eD = new Date(customEndStr);
    eD.setHours(23, 59, 59, 999);

    if (s > eD) {
      alert('Tanggal mulai tidak boleh melebihi tanggal selesai!');
      return;
    }

    setStartDate(s);
    setEndDate(eD);
    setPeriodMode('custom');
    setShowPeriodModal(false);
  };

  const getDaysInPeriod = () => {
    const daysList: Array<{ dateObj: Date; dayName: string; dateStr: string; label: string }> = [];
    const curr = new Date(startDate);
    curr.setHours(0, 0, 0, 0);

    const finalEnd = new Date(endDate);
    finalEnd.setHours(23, 59, 59, 999);

    const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    while (curr <= finalEnd && daysList.length < 31) {
      const dayName = dayNamesShort[curr.getDay()];
      const dateStr = curr.toISOString().split('T')[0];
      const label = `${dayName}, ${monthNamesShort[curr.getMonth()]} ${curr.getDate()}`;
      daysList.push({
        dateObj: new Date(curr),
        dayName,
        dateStr,
        label,
      });
      curr.setDate(curr.getDate() + 1);
    }
    return daysList;
  };

  const formatPeriodLabel = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startStr = `${months[startDate.getMonth()]} ${startDate.getDate()}`;
    const endStr = `${months[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`;
    return `${startStr} - ${endStr}`;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOpenEditMemberModal = (member: TeamMemberWorkload) => {
    if (!isAdminOrOwner) return;
    setEditingMember(member);
    setFormRole(member.custom_role || member.role);
    setFormDivision(member.division || 'Agency Team');
    setFormEmail(member.email);
    setFormPhone(member.phone || '+62 812-3456-7890');
    setFormCapacity(member.capacity_hours);
    setShowEditMemberModal(true);
  };

  const handleSaveMemberInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !isAdminOrOwner) return;

    const savedCustomInfoStr = localStorage.getItem('bilik_team_custom_info');
    let customInfoMap: Record<string, any> = {};
    if (savedCustomInfoStr) {
      try { customInfoMap = JSON.parse(savedCustomInfoStr); } catch {}
    }

    const updatedInfo = {
      custom_role: formRole,
      division: formDivision,
      email: formEmail,
      phone: formPhone,
      capacity: formCapacity,
    };

    customInfoMap[editingMember.full_name] = updatedInfo;
    customInfoMap[editingMember.id] = updatedInfo;

    localStorage.setItem('bilik_team_custom_info', JSON.stringify(customInfoMap));

    // Also update capacities map
    const savedCapsStr = localStorage.getItem('bilik_member_capacities');
    let currentCaps: Record<string, number> = {};
    if (savedCapsStr) {
      try { currentCaps = JSON.parse(savedCapsStr); } catch {}
    }
    currentCaps[editingMember.id] = formCapacity;
    currentCaps[editingMember.full_name] = formCapacity;
    localStorage.setItem('bilik_member_capacities', JSON.stringify(currentCaps));

    // Update in-memory members list
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === editingMember.id || m.full_name === editingMember.full_name) {
          return {
            ...m,
            custom_role: formRole,
            division: formDivision,
            email: formEmail,
            phone: formPhone,
            capacity_hours: formCapacity,
          };
        }
        return m;
      })
    );

    setShowEditMemberModal(false);
  };

  // Active Sessions Live Ticker & Capacity State
  const [activeSessions, setActiveSessions] = useState<Record<string, { checkInTimestamp: number; checkInTime: string; projectName?: string }>>({});
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  const [capacities, setCapacities] = useState<Record<string, number>>({});

  // Check URL query string for ?tab=timesheet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['workload', 'team_list', 'analytics', 'priorities', 'timesheet'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }

    const savedCap = localStorage.getItem('bilik_member_capacities');
    if (savedCap) {
      try { setCapacities(JSON.parse(savedCap)); } catch {}
    }
  }, []);

  // Sync live check-in sessions for real-time AKTIF ticker
  const syncLiveSessions = async () => {
    const sessionMap: Record<string, { checkInTimestamp: number; checkInTime: string; projectName?: string }> = {};

    const myActiveStr = localStorage.getItem('bilik_active_attendance');
    if (myActiveStr) {
      try {
        const parsed = JSON.parse(myActiveStr);
        if (parsed.user_name && parsed.checkInTimestamp) {
          sessionMap[parsed.user_name.toLowerCase().trim()] = {
            checkInTimestamp: parsed.checkInTimestamp,
            checkInTime: parsed.checkInTime || '',
            projectName: parsed.selectedProject,
          };
        }
      } catch {}
    }

    const teamStoreStr = localStorage.getItem('bilik_team_active_store');
    if (teamStoreStr) {
      try {
        const parsed = JSON.parse(teamStoreStr);
        Object.keys(parsed).forEach((key) => {
          const item = parsed[key];
          if (item && item.checkInTimestamp) {
            sessionMap[key.toLowerCase().trim()] = {
              checkInTimestamp: item.checkInTimestamp,
              checkInTime: item.checkInTime || '',
              projectName: item.selectedProject,
            };
          }
        });
      } catch {}
    }

    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://spnawjvexcwhhyfavvew.supabase.co';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbmF3anZleGN3aGh5ZmF2dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjU1NDgsImV4cCI6MjEwMDk0MTU0OH0.IYNTrKH7s5aTBcRREiBgq1SOw5ONBcP0uxWpC_tSznU';

      const restRes = await fetch(`${url}/rest/v1/active_sessions?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: 'no-store',
      });
      if (restRes.ok) {
        const data = await restRes.json();
        if (Array.isArray(data)) {
          data.forEach((row: any) => {
            if (row.user_name && row.check_in_timestamp) {
              sessionMap[row.user_name.toLowerCase().trim()] = {
                checkInTimestamp: Number(row.check_in_timestamp),
                checkInTime: row.check_in_time || '',
                projectName: row.selected_project,
              };
            }
          });
        }
      }
    } catch {}

    setActiveSessions(sessionMap);
  };

  useEffect(() => {
    syncLiveSessions();
    const interval = setInterval(() => {
      setNowTimestamp(Date.now());
      syncLiveSessions();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getLiveOnlineTimeStr = (memberName: string) => {
    const clean = memberName.toLowerCase().trim();
    const sessionKey = Object.keys(activeSessions).find(
      (k) => k === clean || clean.includes(k) || k.includes(clean)
    );
    if (!sessionKey || !activeSessions[sessionKey]) return null;

    const startMs = activeSessions[sessionKey].checkInTimestamp;
    const diffSec = Math.max(0, Math.floor((nowTimestamp - startMs) / 1000));

    const hrs = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;

    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Load live attendance timesheet recap from localStorage & Supabase DB for cross-device sync
  const loadTimesheetRecap = async () => {
    const recapMap: Record<string, Record<string, any>> = {};

    // 1. Load from local browser storage first for instant feedback
    const recapStr = localStorage.getItem('bilik_timesheet_recap');
    if (recapStr) {
      try {
        const parsed = JSON.parse(recapStr);
        Object.assign(recapMap, parsed);
      } catch {}
    }

    // 2. Fetch from Supabase attendance_logs table so all domains & devices stay in sync
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://spnawjvexcwhhyfavvew.supabase.co';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbmF3anZleGN3aGh5ZmF2dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjU1NDgsImV4cCI6MjEwMDk0MTU0OH0.IYNTrKH7s5aTBcRREiBgq1SOw5ONBcP0uxWpC_tSznU';

      const res = await fetch(`${url}/rest/v1/attendance_logs?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: 'no-store',
      });

      if (res.ok) {
        const logs = await res.json();
        if (Array.isArray(logs)) {
          logs.forEach((log: any) => {
            const userName = log.user_name;
            const dayName = log.day_name;
            const dateStr = log.date; // YYYY-MM-DD

            if (userName) {
              if (!recapMap[userName]) recapMap[userName] = {};

              // Store by YYYY-MM-DD if present
              if (dateStr) {
                const existingD = recapMap[userName][dateStr] || { regular: 0, overtime: 0, status: 'HADIR' };
                const regD = Math.max(Number(existingD.regular || 0), Number(log.regular_hours || 0));
                const otD = Math.max(Number(existingD.overtime || 0), Number(log.overtime_hours || 0));
                recapMap[userName][dateStr] = {
                  regular: parseFloat(regD.toFixed(2)),
                  overtime: parseFloat(otD.toFixed(2)),
                  status: log.status || 'HADIR',
                };
              }

              // Also store by dayName ("Sun", "Mon", etc.)
              if (dayName) {
                const existing = recapMap[userName][dayName] || { regular: 0, overtime: 0, status: 'HADIR' };
                const reg = Math.max(Number(existing.regular || 0), Number(log.regular_hours || 0));
                const ot = Math.max(Number(existing.overtime || 0), Number(log.overtime_hours || 0));
                recapMap[userName][dayName] = {
                  regular: parseFloat(reg.toFixed(2)),
                  overtime: parseFloat(ot.toFixed(2)),
                  status: log.status || 'HADIR',
                };
              }
            }
          });
        }
      }
    } catch (err) {
      console.warn('[Timesheet] Supabase logs sync warning:', err);
    }

    setTimesheetRecap(recapMap);
  };

  // Real-time Event Listeners & Auto-Sync for Instant Check-Out Log Updates
  useEffect(() => {
    loadTimesheetRecap();

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('bilik_attendance_channel');
        bc.onmessage = () => {
          loadTimesheetRecap();
        };
      } catch {}
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'bilik_timesheet_recap' ||
        e.key === 'bilik_active_attendance' ||
        e.key === 'bilik_team_active_store'
      ) {
        loadTimesheetRecap();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(loadTimesheetRecap, 2000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [activeTab]);

  const fetchTeamWorkload = async () => {
    setLoading(true);
    try {
      // 1. Fetch live ClickUp team members
      const teamRes = await fetch('/api/clickup/teams');
      const teamData = await teamRes.json();
      const clickUpMembers = Array.isArray(teamData.members) ? teamData.members : [];

      // Fetch authenticated user profile & resolve exact workspace role
      try {
        const userRes = await fetch('/api/clickup/user');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user) {
            const uName = (userData.user.username || '').toLowerCase().trim();
            const uEmail = (userData.user.email || '').toLowerCase().trim();

            const foundMember = clickUpMembers.find((m: any) => {
              const mName = (m.username || '').toLowerCase().trim();
              const mEmail = (m.email || '').toLowerCase().trim();
              return (
                (mName && (mName === uName || mName.includes(uName) || uName.includes(mName))) ||
                (mEmail && mEmail === uEmail)
              );
            });

            if (foundMember) {
              const matchedRole = foundMember.role === 1 ? 'Owner' : foundMember.role === 2 ? 'Admin' : 'Member';
              setCurrentUserRole(matchedRole);
            } else {
              const roleNum = userData.user.role;
              if (roleNum === 1) setCurrentUserRole('Owner');
              else if (roleNum === 2) setCurrentUserRole('Admin');
              else setCurrentUserRole('Owner'); // Default workspace creator to Owner
            }
          }
        }
      } catch (err) {
        console.warn('[TeamWorkload] User role fetch fallback.', err);
        setCurrentUserRole('Owner');
      }

      // 2. Fetch live ClickUp tasks
      const tasksRes = await fetch('/api/clickup/tasks');
      const tasksData = await tasksRes.json();
      const fetchedTasks = Array.isArray(tasksData.tasks) ? tasksData.tasks : [];
      setAllTasks(fetchedTasks);

      // 3. Map members with workload stats & custom role info
      const now = new Date();
      const savedCapsStr = localStorage.getItem('bilik_member_capacities');
      let currentCaps: Record<string, number> = {};
      if (savedCapsStr) {
        try { currentCaps = JSON.parse(savedCapsStr); } catch {}
      }

      const savedCustomInfoStr = localStorage.getItem('bilik_team_custom_info');
      let customInfoMap: Record<string, any> = {};
      if (savedCustomInfoStr) {
        try { customInfoMap = JSON.parse(savedCustomInfoStr); } catch {}
      }

      const mappedMembers: TeamMemberWorkload[] = clickUpMembers.map((m: any) => {
        const memberName = m.username || (m.email ? m.email.split('@')[0] : 'Team Member');
        const cInfo = customInfoMap[memberName] || customInfoMap[String(m.id)] || {};

        const assignedTasks = fetchedTasks.filter((t: any) =>
          t.assignee_names?.some((name: string) => name.toLowerCase().includes(memberName.toLowerCase()))
        );

        const activeTasks = assignedTasks.filter((t: any) => t.status !== 'completed');
        const completedTasks = assignedTasks.filter((t: any) => t.status === 'completed');
        const overdueTasks = activeTasks.filter((t: any) => new Date(t.due_date) < now);

        const hoursTracked = assignedTasks.reduce((acc: number, t: any) => acc + (t.time_tracked_hours || 4), 0);
        const capacity = cInfo.capacity || currentCaps[String(m.id)] || currentCaps[memberName] || 40;

        let workloadStatus: 'low' | 'balanced' | 'high' | 'over_capacity' = 'balanced';
        if (hoursTracked > capacity || activeTasks.length > 8) workloadStatus = 'over_capacity';
        else if (activeTasks.length >= 5) workloadStatus = 'high';
        else if (activeTasks.length >= 2) workloadStatus = 'balanced';
        else workloadStatus = 'low';

        // Extract unique projects
        const projectMap = new Map<string, number>();
        assignedTasks.forEach((t: any) => {
          if (t.project_name) projectMap.set(t.project_name, 50);
        });

        const projects = Array.from(projectMap.entries()).map(([name, progress]) => ({ name, progress }));

        // Format priority tasks
        const memberPriorityTasks = assignedTasks.map((t: any) => ({
          id: t.id,
          name: t.task_name,
          priority: t.priority || 'normal',
          progress: t.status === 'completed' ? 100 : 40,
        }));

        const defaultCustomRole = m.role === 1 ? 'Owner / Project Lead' : m.role === 2 ? 'Admin / Operations' : 'Agency Team Member';

        return {
          id: String(m.id),
          full_name: memberName,
          email: cInfo.email || m.email || '',
          role: m.role === 1 ? 'Owner' : m.role === 2 ? 'Admin' : 'Member',
          custom_role: cInfo.custom_role || defaultCustomRole,
          division: cInfo.division || 'Agency Team',
          phone: cInfo.phone || '+62 812-3456-7890',
          avatar_url: m.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(memberName)}&background=24324A&color=fff`,
          assigned_tasks_count: activeTasks.length,
          overdue_tasks_count: overdueTasks.length,
          completed_tasks_count: completedTasks.length,
          hours_tracked: hoursTracked,
          capacity_hours: capacity,
          workload_status: workloadStatus,
          projects,
          tasks: memberPriorityTasks,
        };
      });

      setMembers(mappedMembers);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamWorkload();
  }, []);

  const isAdminOrOwner = currentUserRole === 'Owner' || currentUserRole === 'Admin';

  const handleCapacityChange = (memberId: string, memberName: string, newCapacity: number) => {
    if (!isAdminOrOwner) return;

    const savedCapsStr = localStorage.getItem('bilik_member_capacities');
    let currentCaps: Record<string, number> = {};
    if (savedCapsStr) {
      try { currentCaps = JSON.parse(savedCapsStr); } catch {}
    }

    currentCaps[memberId] = newCapacity;
    currentCaps[memberName] = newCapacity;
    setCapacities(currentCaps);
    localStorage.setItem('bilik_member_capacities', JSON.stringify(currentCaps));

    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId || m.full_name === memberName) {
          let workloadStatus = m.workload_status;
          if (m.hours_tracked > newCapacity) workloadStatus = 'over_capacity';
          return { ...m, capacity_hours: newCapacity, workload_status: workloadStatus };
        }
        return m;
      })
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E8EC] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Team Workspace</h1>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-[#EEF2F7] text-[#24324A] rounded-md border border-[#E8E8EC]">
              @bilik-strategi
            </span>
          </div>
          <p className="text-xs text-[#737680] mt-1">
            Pantau distribusi beban kerja tim agency, analitik aktivitas online, prioritas task, struktur organisasi, dan timesheet ClickUp.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* Role Status Badge & Test Switcher (Admin/Owner Only) */}
          {isAdminOrOwner && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl text-xs shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#4F9D78]" />
              <span className="text-[#737680]">Akses Anda:</span>
              <select
                value={currentUserRole}
                onChange={(e) => setCurrentUserRole(e.target.value as any)}
                className="font-bold text-[#24324A] bg-transparent outline-none cursor-pointer text-xs"
                title="Ganti Mode Role Pengguna"
              >
                <option value="Owner">Owner 👑 (Admin Edit)</option>
                <option value="Admin">Admin 🛡️ (Admin Edit)</option>
                <option value="Member">Member 👤 (Read Only)</option>
              </select>
            </div>
          )}

          <button
            onClick={fetchTeamWorkload}
            className="flex items-center gap-2 px-4 py-2 border border-[#E8E8EC] bg-[#FFFFFF] rounded-xl text-xs font-bold text-[#24324A] hover:bg-[#EEF2F7] transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync ClickUp</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Bar (ClickUp Style) */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-[#E8E8EC] pb-2 text-xs font-bold scrollbar-none">
        <button
          onClick={() => setActiveTab('workload')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'workload'
              ? 'bg-[#24324A] text-[#FFFFFF] shadow-2xs'
              : 'text-[#737680] hover:text-[#24324A] hover:bg-[#EEF2F7]'
          }`}
        >
          <Briefcase className="w-4 h-4 text-[#F26B5E]" />
          <span>Workload</span>
        </button>

        <button
          onClick={() => setActiveTab('team_list')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'team_list'
              ? 'bg-[#24324A] text-[#FFFFFF] shadow-2xs'
              : 'text-[#737680] hover:text-[#24324A] hover:bg-[#EEF2F7]'
          }`}
        >
          <Users className="w-4 h-4 text-[#3B82F6]" />
          <span>Team List</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-[#24324A] text-[#FFFFFF] shadow-2xs'
              : 'text-[#737680] hover:text-[#24324A] hover:bg-[#EEF2F7]'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-[#4F9D78]" />
          <span>Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('priorities')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'priorities'
              ? 'bg-[#24324A] text-[#FFFFFF] shadow-2xs'
              : 'text-[#737680] hover:text-[#24324A] hover:bg-[#EEF2F7]'
          }`}
        >
          <Flag className="w-4 h-4 text-[#D95858]" />
          <span>Priorities</span>
        </button>

        <button
          onClick={() => setActiveTab('timesheet')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'timesheet'
              ? 'bg-[#24324A] text-[#FFFFFF] shadow-2xs'
              : 'text-[#737680] hover:text-[#24324A] hover:bg-[#EEF2F7]'
          }`}
        >
          <Calendar className="w-4 h-4 text-[#E6A23C]" />
          <span>Timesheet</span>
        </button>
      </div>

      {/* Loading indicator */}
      {loading && members.length === 0 && (
        <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl p-12 text-center space-y-3 shadow-2xs">
          <RefreshCw className="w-8 h-8 text-[#24324A] animate-spin mx-auto opacity-40" />
          <h3 className="text-sm font-extrabold text-[#24324A]">Mengambil Data Tim ClickUp Workspace…</h3>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 1: WORKLOAD (Original Capacity Planner)          */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'workload' && (
        <div className="space-y-6 animate-fade-in">
          {isAdminOrOwner ? (
            <div className="p-3 bg-[#4F9D78]/10 border border-[#4F9D78]/30 rounded-xl text-xs text-[#3D8362] flex items-center gap-2 font-medium">
              <ShieldCheck className="w-4 h-4 text-[#4F9D78] flex-shrink-0" />
              <span>
                <strong>Akses Administrator Aktif:</strong> Anda masuk sebagai <strong className="uppercase">{currentUserRole}</strong>. Anda memiliki wewenang penuh untuk mengatur default kapasitas jam kerja anggota tim di bawah ini.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-[#EEF2F7] border border-[#24324A]/20 rounded-xl text-xs text-[#24324A] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#24324A] flex-shrink-0" />
              <span>
                <strong>Perhatian Akses:</strong> Anda masuk sebagai <strong className="uppercase">{currentUserRole}</strong>. Pengaturan default kapasitas jam kerja hanya dapat diubah oleh <strong>Admin / Owner Workspace</strong>.
              </span>
            </div>
          )}

          {!loading && members.length === 0 && (
            <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl p-12 text-center space-y-3 shadow-2xs">
              <Users className="w-10 h-10 text-[#737680] mx-auto opacity-40" />
              <h3 className="text-sm font-extrabold text-[#24324A]">Belum Ada Anggota Tim di ClickUp Workspace</h3>
            </div>
          )}

          {members.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {members.map((user) => {
                const workloadBadge =
                  user.workload_status === 'over_capacity'
                    ? 'bg-[#FFF0ED] text-[#D95858] border-[#D95858]'
                    : user.workload_status === 'high'
                    ? 'bg-[#FEF3D6] text-[#E6A23C] border-[#E6A23C]'
                    : user.workload_status === 'balanced'
                    ? 'bg-[#EEF2F7] text-[#4F9D78] border-[#4F9D78]'
                    : 'bg-[#EEF2F7] text-[#24324A] border-[#24324A]';

                return (
                  <div
                    key={user.id}
                    className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4 hover:border-[#24324A] transition-colors"
                  >
                    {/* Member Banner */}
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={user.avatar_url} alt={user.full_name} className="w-12 h-12 rounded-full object-cover border border-[#E8E8EC]" />
                        {getLiveOnlineTimeStr(user.full_name) && (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center" title={`Online Check-In (${getLiveOnlineTimeStr(user.full_name)})`}>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4F9D78] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4F9D78] border-2 border-white"></span>
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-[#24324A] truncate">{user.full_name}</h3>
                        <p className="text-xs text-[#737680] capitalize flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#4F9D78]" />
                          {user.role}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase border ${workloadBadge}`}>
                        {user.workload_status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Task Counts Summary */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#E8E8EC] text-center text-xs">
                      <div>
                        <span className="text-[#737680] text-[10px] block uppercase font-semibold">Aktif</span>
                        {getLiveOnlineTimeStr(user.full_name) ? (
                          <span className="font-extrabold text-[#4F9D78] text-[10px] flex items-center justify-center gap-1 bg-[#4F9D78]/10 py-1 px-1 rounded-lg border border-[#4F9D78]/30 shadow-2xs mt-0.5" title="User sedang Check-In Online">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4F9D78] animate-ping flex-shrink-0" />
                            <span>Online ({getLiveOnlineTimeStr(user.full_name)})</span>
                          </span>
                        ) : (
                          <span className="font-bold text-[#737680] text-sm block mt-0.5">0</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[#737680] text-[10px] block uppercase font-semibold">Overdue</span>
                        <span className="font-bold text-[#D95858] text-sm">{user.overdue_tasks_count}</span>
                      </div>
                      <div>
                        <span className="text-[#737680] text-[10px] block uppercase font-semibold">Selesai</span>
                        <span className="font-bold text-[#4F9D78] text-sm">{user.completed_tasks_count}</span>
                      </div>
                    </div>

                    {/* Hours Tracked vs Capacity Progress */}
                    {(() => {
                      const userRecap = timesheetRecap[user.full_name] || {};
                      let checkedInHours = 0;
                      Object.values(userRecap).forEach((d: any) => {
                        if (typeof d === 'number') checkedInHours += d;
                        else if (d) checkedInHours += (d.regular || 0) + (d.overtime || 0);
                      });
                      const displayHours = parseFloat(checkedInHours.toFixed(2));
                      return (
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between font-semibold">
                            <span className="text-[#737680]">Jam Kerja Terpakai (Presensi):</span>
                            <span className="text-[#24324A]">{displayHours} jam / {user.capacity_hours} jam</span>
                          </div>
                          <div className="w-full bg-[#EEF2F7] h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                displayHours > user.capacity_hours ? 'bg-[#D95858]' : 'bg-[#4F9D78]'
                              }`}
                              style={{ width: `${Math.min(100, (displayHours / user.capacity_hours) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Capacity Hours Setting (Restricted to Admin/Owner) */}
                    <div className="flex items-center justify-between text-xs pt-2">
                      <span className="text-[#737680]">Default Kapasitas:</span>
                      {isAdminOrOwner ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={user.capacity_hours}
                            onChange={(e) => handleCapacityChange(user.id, user.full_name, parseInt(e.target.value) || 40)}
                            className="w-16 px-2 py-1 border border-[#24324A] rounded text-center text-xs font-bold text-[#24324A] bg-[#FFFFFF] shadow-2xs"
                            title="Edit Kapasitas (Khusus Admin/Owner)"
                          />
                          <span className="text-[10px] font-bold text-[#4F9D78]">jam</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg text-xs font-bold text-[#737680]" title="Hanya Admin/Owner yang dapat mengubah kapasitas">
                          <Lock className="w-3 h-3 text-[#737680]" />
                          <span>{user.capacity_hours} jam</span>
                        </div>
                      )}
                    </div>

                    {/* Active Projects List */}
                    <div className="pt-2 border-t border-[#E8E8EC] space-y-1">
                      <span className="text-[11px] font-bold text-[#737680] uppercase tracking-wider block">
                        Project Sedang Dikerjakan ({user.projects.length})
                      </span>
                      <div className="space-y-1">
                        {user.projects.length > 0 ? (
                          user.projects.map((p, idx) => (
                            <div key={idx} className="text-xs font-medium text-[#202124] flex items-center justify-between truncate">
                              <span className="truncate">• {p.name}</span>
                              <span className="text-[10px] text-[#737680]">{p.progress}%</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-[#737680] italic">Belum ada project aktif assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: ANALYTICS (Online Activity & Focus Cards)     */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          {/* Hourly Activity Bar Chart */}
          <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#4F9D78] animate-pulse"></span>
                <span className="text-xs font-bold text-[#737680] uppercase tracking-wider">
                  Number of People Who Were Online (Hari Ini)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#737680]">
                <button className="p-1 rounded hover:bg-[#F7F7F8]"><ChevronLeft className="w-4 h-4" /></button>
                <span className="font-bold text-[#24324A]">Jul 30, 2026</span>
                <button className="p-1 rounded hover:bg-[#F7F7F8]"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Simulated Hourly Bar Histogram */}
            <div className="h-32 flex items-end justify-between gap-1 pt-6 px-2 border-b border-[#E8E8EC] pb-2">
              {[
                { hour: '12am', val: 0 }, { hour: '1am', val: 0 }, { hour: '2am', val: 0 },
                { hour: '3am', val: 0 }, { hour: '4am', val: 0 }, { hour: '5am', val: 0 },
                { hour: '6am', val: 2 }, { hour: '7am', val: 0 }, { hour: '8am', val: 3 },
                { hour: '9am', val: 1 }, { hour: '10am', val: 4 }, { hour: '11am', val: 6 },
                { hour: '12pm', val: 5 }, { hour: '1pm', val: 1 }, { hour: '2pm', val: 2 },
                { hour: '3pm', val: 2 }, { hour: '4pm', val: 3 }, { hour: '5pm', val: 5 },
                { hour: '6pm', val: 3 }, { hour: '7pm', val: 0 }, { hour: '8pm', val: 0 },
                { hour: '9pm', val: 0 }, { hour: '10pm', val: 0 }, { hour: '11pm', val: 0 },
              ].map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full bg-[#4F9D78] rounded-t-xs transition-all group-hover:bg-[#24324A]"
                    style={{ height: `${(item.val / 6) * 100}%` }}
                    title={`${item.hour}: ${item.val} Member Online`}
                  />
                  <span className="text-[9px] text-[#737680] group-hover:font-bold group-hover:text-[#24324A]">{item.hour}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Member Online / Offline Cards */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#EEF2F7] text-[#4F9D78] text-xs font-bold rounded-lg border border-[#4F9D78]/30">
                3 Online
              </span>
              <span className="px-3 py-1 bg-[#F7F7F8] text-[#737680] text-xs font-bold rounded-lg border border-[#E8E8EC]">
                3 Offline
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {members.map((user, idx) => {
                const isOnline = idx % 2 === 0;
                return (
                  <div key={user.id} className="p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={user.avatar_url} alt={user.full_name} className="w-10 h-10 rounded-full object-cover border border-[#E8E8EC]" />
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#FFFFFF] ${isOnline ? 'bg-[#4F9D78]' : 'bg-[#737680]'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-[#24324A] truncate">{user.full_name}</h4>
                        <span className="text-[10px] text-[#737680]">{isOnline ? 'Aktif bekerja' : 'Offline'}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E8E8EC] space-y-1">
                      <span className="text-[10px] text-[#737680] font-semibold uppercase">Focused On</span>
                      {user.tasks && user.tasks.length > 0 ? (
                        <div className="p-2 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg text-xs font-medium text-[#24324A] flex items-center justify-between">
                          <span className="truncate">{user.tasks[0].name}</span>
                          <span className="text-[10px] font-bold text-[#4F9D78]">100%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#737680] italic block">Nothing to see here</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: PRIORITIES (Member Task Priorities Cards)     */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'priorities' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-extrabold text-[#24324A]">Papan Prioritas Task Per Anggota Tim</h3>
            <span className="text-xs text-[#737680]">Urutan berdasarkan prioritas teratas</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {members.map((user) => (
              <div key={user.id} className="p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={user.avatar_url} alt={user.full_name} className="w-9 h-9 rounded-full object-cover border border-[#E8E8EC]" />
                  <h4 className="text-xs font-bold text-[#24324A] truncate">{user.full_name}</h4>
                </div>

                <div className="space-y-2">
                  {user.tasks && user.tasks.length > 0 ? (
                    user.tasks.slice(0, 3).map((t) => (
                      <div key={t.id} className="p-2.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <Flag className={`w-3.5 h-3.5 flex-shrink-0 ${
                            t.priority === 'urgent' ? 'text-[#D95858]' : t.priority === 'high' ? 'text-[#E6A23C]' : 'text-[#3B82F6]'
                          }`} />
                          <span className="font-semibold text-[#24324A] truncate">{t.name}</span>
                        </div>
                        <span className="text-[10px] text-[#737680] capitalize font-mono">{t.priority}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 border border-dashed border-[#E8E8EC] rounded-xl text-center text-xs text-[#737680]">
                      Belum ada task prioritas
                    </div>
                  )}
                </div>

                <button className="w-full py-2 border border-dashed border-[#E8E8EC] rounded-xl text-xs font-bold text-[#737680] hover:text-[#24324A] hover:bg-[#F7F7F8] flex items-center justify-center gap-1 transition-colors cursor-pointer">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add task</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* ---------------------------------------------------- */}
      {/* TAB 5: TIMESHEET (Dynamic Logged Hours Matrix Grid)  */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'timesheet' && (() => {
        const activeDays = getDaysInPeriod();
        return (
          <div className="space-y-6 animate-fade-in">
            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] p-4 border border-[#E8E8EC] rounded-2xl shadow-2xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Period Shift Controls */}
                <div className="flex items-center gap-1 bg-[#F7F7F8] p-1 border border-[#E8E8EC] rounded-xl">
                  <button
                    onClick={handlePrevPeriod}
                    className="p-1.5 rounded-lg hover:bg-[#FFFFFF] text-[#24324A] transition-colors cursor-pointer"
                    title="Periode Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-xs font-extrabold text-[#24324A] min-w-[140px] text-center">
                    {formatPeriodLabel()}
                  </span>
                  <button
                    onClick={handleNextPeriod}
                    className="p-1.5 rounded-lg hover:bg-[#FFFFFF] text-[#24324A] transition-colors cursor-pointer"
                    title="Periode Berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Preset Mode Pills */}
                <div className="flex items-center gap-1 bg-[#EEF2F7] p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => handleSelectPreset('weekly')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      periodMode === 'weekly' ? 'bg-[#24324A] text-white shadow-2xs' : 'text-[#737680] hover:text-[#24324A]'
                    }`}
                  >
                    Mingguan
                  </button>
                  <button
                    onClick={() => handleSelectPreset('monthly')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      periodMode === 'monthly' ? 'bg-[#24324A] text-white shadow-2xs' : 'text-[#737680] hover:text-[#24324A]'
                    }`}
                  >
                    Bulanan
                  </button>
                  <button
                    onClick={() => handleSelectPreset('custom')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      periodMode === 'custom' ? 'bg-[#24324A] text-white shadow-2xs' : 'text-[#737680] hover:text-[#24324A]'
                    }`}
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Kustom</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Link
                  href="/attendance"
                  className="px-3.5 py-2 bg-[#4F9D78] text-white rounded-xl font-extrabold hover:bg-[#3D8362] transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-white" />
                  <span>⏱️ Presensi Check-In Live</span>
                </Link>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F7F7F8] border-b border-[#E8E8EC] text-[#737680] uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4 min-w-[180px]">People ({members.length})</th>
                      {activeDays.map((d) => (
                        <th key={d.dateStr} className="py-3 px-2 text-center whitespace-nowrap min-w-[70px]">
                          {d.label}
                        </th>
                      ))}
                      <th className="py-3 px-3 text-center font-bold text-[#E6A23C] min-w-[80px]">Total OT</th>
                      <th className="py-3 px-4 text-center font-bold text-[#4F9D78] min-w-[80px]">Total Jam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8EC]">
                    {members.map((m) => {
                      // Case-insensitive & email/name fuzzy lookup for user recap
                      const mName = m.full_name.toLowerCase().trim();
                      const mEmail = (m.email || '').toLowerCase().trim();

                      const userRecap: Record<string, any> = {};

                      Object.keys(timesheetRecap).forEach((key) => {
                        const kLower = key.toLowerCase().trim();
                        const matchName = kLower === mName || mName.includes(kLower) || kLower.includes(mName);
                        const matchEmail = mEmail && (kLower.includes(mEmail.split('@')[0]) || mEmail.includes(kLower));

                        if (matchName || matchEmail) {
                          Object.assign(userRecap, timesheetRecap[key]);
                        }
                      });

                      const getDayCell = (dayInfo: { dateObj: Date; dayName: string; dateStr: string }) => {
                        const todayObj = new Date();
                        todayObj.setHours(23, 59, 59, 999);
                        const isFutureDate = dayInfo.dateObj > todayObj;

                        // Future dates CANNOT have past attendance recap or ALPHA status
                        if (isFutureDate) {
                          return <span className="text-[#737680] font-normal">0h</span>;
                        }

                        // Strictly lookup by YYYY-MM-DD dateStr first to prevent date bleeding
                        let dayData = userRecap[dayInfo.dateStr];

                        // If not found by dateStr, only fallback to dayName ("Fri") if dayInfo is in current week and <= today
                        if (!dayData) {
                          const now = new Date();
                          const currentWeekSun = new Date(now);
                          currentWeekSun.setDate(now.getDate() - now.getDay());
                          currentWeekSun.setHours(0, 0, 0, 0);

                          const currentWeekSat = new Date(currentWeekSun);
                          currentWeekSat.setDate(currentWeekSat.getDate() + 6);
                          currentWeekSat.setHours(23, 59, 59, 999);

                          if (dayInfo.dateObj >= currentWeekSun && dayInfo.dateObj <= currentWeekSat) {
                            dayData = userRecap[dayInfo.dayName];
                          }
                        }

                        if (!dayData) {
                          return <span className="text-[#737680] font-normal">0h</span>;
                        }

                        if (typeof dayData === 'number') {
                          return dayData > 0 ? (
                            <span className="font-semibold text-[#24324A]">{dayData}h</span>
                          ) : (
                            <span className="text-[#737680]">0h</span>
                          );
                        }

                        if (dayData.status === 'ALPHA') {
                          return <span className="px-1.5 py-0.5 bg-[#F26B5E]/10 text-[#F26B5E] border border-[#F26B5E]/30 rounded font-bold text-[10px]">ALPHA</span>;
                        }
                        if (['IZIN', 'SAKIT', 'CUTI'].includes(dayData.status)) {
                          return <span className="px-1.5 py-0.5 bg-[#7B68EE]/10 text-[#7B68EE] border border-[#7B68EE]/30 rounded font-bold text-[10px]">{dayData.status}</span>;
                        }

                        const reg = dayData.regular || 0;
                        const ot = dayData.overtime || 0;

                        if (reg === 0 && ot === 0) {
                          return <span className="text-[#737680]">0h</span>;
                        }

                        return (
                          <div className="flex flex-col items-center">
                            <span className="font-extrabold text-[#24324A]">{reg}h</span>
                            {ot > 0 && <span className="text-[9px] font-bold text-[#E6A23C] bg-[#E6A23C]/10 px-1 rounded">+{ot}h OT</span>}
                          </div>
                        );
                      };

                      // Compute totals across days up to today
                      let totalReg = 0;
                      let totalOT = 0;

                      const todayEnd = new Date();
                      todayEnd.setHours(23, 59, 59, 999);

                      activeDays.forEach((d) => {
                        if (d.dateObj <= todayEnd) {
                          const dayData = userRecap[d.dateStr] || userRecap[d.dayName];
                          if (typeof dayData === 'number') {
                            totalReg += dayData;
                          } else if (dayData) {
                            totalReg += dayData.regular || 0;
                            totalOT += dayData.overtime || 0;
                          }
                        }
                      });

                      const totalOverall = parseFloat((totalReg + totalOT).toFixed(2));

                      return (
                        <tr key={m.id} className="hover:bg-[#F7F7F8] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="relative flex-shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={m.avatar_url} alt={m.full_name} className="w-7.5 h-7.5 rounded-full border border-[#E8E8EC] object-cover" />
                                {getLiveOnlineTimeStr(m.full_name) && (
                                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center" title={`Online Check-In (${getLiveOnlineTimeStr(m.full_name)})`}>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4F9D78] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4F9D78] border-2 border-white"></span>
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-[#24324A] block truncate max-w-[150px]">{m.full_name}</span>
                                  {getLiveOnlineTimeStr(m.full_name) && (
                                    <span className="px-1.5 py-0.2 bg-[#4F9D78]/10 text-[#4F9D78] border border-[#4F9D78]/30 rounded text-[9px] font-extrabold flex items-center gap-1" title={`Check-In sejak ${getLiveOnlineTimeStr(m.full_name)}`}>
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#4F9D78] animate-pulse"></span>
                                      <span>ON ({getLiveOnlineTimeStr(m.full_name)})</span>
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-[#737680] font-medium block truncate max-w-[150px]" title={m.custom_role || m.role}>
                                  {m.custom_role || (m.role === 'Owner' ? 'Owner / Project Lead' : 'ClickUp Team Member')}
                                </span>
                              </div>
                            </div>
                          </td>

                          {activeDays.map((d) => (
                            <td key={d.dateStr} className="py-3 px-2 text-center">
                              {getDayCell(d)}
                            </td>
                          ))}

                          <td className="py-3 px-3 text-center font-extrabold text-[#E6A23C] bg-[#E6A23C]/5">
                            {totalOT > 0 ? `+${totalOT}h` : '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-extrabold text-[#4F9D78]">
                            {totalOverall > 0 ? `${totalOverall}h` : '0h'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL SET RENTANG PERIODE KUSTOM */}
      {showPeriodModal && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button onClick={() => setShowPeriodModal(false)} className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-3">
              <SlidersHorizontal className="w-5 h-5 text-[#24324A]" />
              <div>
                <h3 className="text-base font-extrabold text-[#24324A]">Atur Rentang Periode Kustom</h3>
                <p className="text-xs text-[#737680]">Tentukan tanggal mulai dan tanggal selesai pencatatan timesheet</p>
              </div>
            </div>

            <form onSubmit={handleSaveCustomPeriod} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={customStartStr}
                    onChange={(e) => setCustomStartStr(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Tanggal Selesai *</label>
                  <input
                    type="date"
                    required
                    value={customEndStr}
                    onChange={(e) => setCustomEndStr(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block font-bold text-[#737680] mb-1.5">Preset Cepat:</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const eD = new Date();
                      const sD = new Date();
                      sD.setDate(sD.getDate() - 6);
                      setCustomStartStr(sD.toISOString().split('T')[0]);
                      setCustomEndStr(eD.toISOString().split('T')[0]);
                    }}
                    className="px-2.5 py-1 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg hover:bg-[#EEF2F7] text-[11px] font-bold text-[#24324A]"
                  >
                    7 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const eD = new Date();
                      const sD = new Date();
                      sD.setDate(sD.getDate() - 13);
                      setCustomStartStr(sD.toISOString().split('T')[0]);
                      setCustomEndStr(eD.toISOString().split('T')[0]);
                    }}
                    className="px-2.5 py-1 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg hover:bg-[#EEF2F7] text-[11px] font-bold text-[#24324A]"
                  >
                    14 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const sD = new Date(now.getFullYear(), now.getMonth(), 1);
                      const eD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      setCustomStartStr(sD.toISOString().split('T')[0]);
                      setCustomEndStr(eD.toISOString().split('T')[0]);
                    }}
                    className="px-2.5 py-1 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg hover:bg-[#EEF2F7] text-[11px] font-bold text-[#24324A]"
                  >
                    Bulan Ini
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPeriodModal(false)}
                  className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl font-bold hover:text-[#24324A] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#24324A] hover:bg-[#1A2536] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-[#4F9D78]" />
                  <span>Terapkan Periode</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB: TEAM LIST (Member Directory & Role Management)  */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'team_list' && (
        <div className="space-y-6 animate-fade-in">
          {isAdminOrOwner ? (
            <div className="p-3 bg-[#4F9D78]/10 border border-[#4F9D78]/30 rounded-xl text-xs text-[#3D8362] flex items-center gap-2 font-medium">
              <ShieldCheck className="w-4 h-4 text-[#4F9D78] flex-shrink-0" />
              <span>
                <strong>Akses Administrator Aktif:</strong> Anda masuk sebagai <strong className="uppercase">{currentUserRole}</strong>. Anda memiliki hak akses untuk mengedit role/jabatan spesifik, divisi, dan data tim di bawah ini.
              </span>
            </div>
          ) : (
            <div className="p-3 bg-[#EEF2F7] border border-[#24324A]/20 rounded-xl text-xs text-[#24324A] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#24324A] flex-shrink-0" />
              <span>
                <strong>Perhatian Akses:</strong> Anda masuk sebagai <strong className="uppercase">{currentUserRole}</strong>. Pengubahan role & informasi anggota tim hanya dapat dilakukan oleh <strong>Admin / Owner Workspace</strong>.
              </span>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs">
            <div>
              <h3 className="text-sm font-extrabold text-[#24324A] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#3B82F6]" />
                <span>Direktori & Role Anggota Tim Agency</span>
              </h3>
              <p className="text-xs text-[#737680] mt-1">
                Kelola nama, role/jabatan spesifik, divisi, email, telepon, dan kapasitas kerja tim. Role di sini akan otomatis muncul di Timesheet.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#737680]">Total {members.length} Anggota</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => (
              <div key={member.id} className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4 hover:border-[#24324A] transition-colors relative group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={member.avatar_url} alt={member.full_name} className="w-12 h-12 rounded-full object-cover border border-[#E8E8EC]" />
                    <div>
                      <h4 className="text-sm font-extrabold text-[#24324A]">{member.full_name}</h4>
                      <span className="px-2 py-0.5 text-[10px] font-extrabold bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 rounded-md block mt-1">
                        {member.custom_role || member.role}
                      </span>
                    </div>
                  </div>

                  {isAdminOrOwner ? (
                    <button
                      onClick={() => handleOpenEditMemberModal(member)}
                      className="p-1.5 bg-white border border-[#E8E8EC] rounded-lg hover:bg-[#EEF2F7] text-[#24324A] cursor-pointer shadow-xs transition-colors"
                      title="Edit Role & Info Anggota Tim"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#F26B5E]" />
                    </button>
                  ) : (
                    <div
                      className="p-1.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg text-[#737680] cursor-not-allowed opacity-60"
                      title="Hanya Admin / Owner yang dapat mengedit role & info tim"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#737680]" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-3 border-t border-[#E8E8EC] text-xs text-[#737680]">
                  <p className="flex items-center gap-2 truncate">
                    <Building2 className="w-3.5 h-3.5 text-[#24324A] flex-shrink-0" />
                    <span>Divisi: <strong className="text-[#202124]">{member.division || 'Agency Team'}</strong></span>
                  </p>
                  <p className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-[#24324A] flex-shrink-0" />
                    <span>{member.email}</span>
                  </p>
                  <p className="flex items-center gap-2 truncate">
                    <Phone className="w-3.5 h-3.5 text-[#24324A] flex-shrink-0" />
                    <span>{member.phone || '+62 812-3456-7890'}</span>
                  </p>
                  <p className="flex items-center gap-2 truncate">
                    <Clock className="w-3.5 h-3.5 text-[#4F9D78] flex-shrink-0" />
                    <span>Kapasitas: <strong className="text-[#4F9D78]">{member.capacity_hours} jam/bulan</strong></span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL EDIT DATA ANGGOTA TIM */}
      {showEditMemberModal && editingMember && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button onClick={() => setShowEditMemberModal(false)} className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#E8E8EC] pb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={editingMember.avatar_url} alt={editingMember.full_name} className="w-10 h-10 rounded-full border border-[#E8E8EC]" />
              <div>
                <h3 className="text-base font-extrabold text-[#24324A]">{editingMember.full_name}</h3>
                <p className="text-xs text-[#737680]">Edit Role, Divisi & Informasi Anggota Tim</p>
              </div>
            </div>

            <form onSubmit={handleSaveMemberInfo} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#24324A] mb-1">Role / Jabatan Spesifik *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Project Lead / Senior Creative Designer"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
                <span className="text-[10px] text-[#737680] mt-0.5 block">* Role ini akan langsung tampil di Timesheet di bawah nama anggota.</span>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Divisi / Departemen</label>
                <input
                  type="text"
                  placeholder="Contoh: Creative & Strategy / Tech & Dev"
                  value={formDivision}
                  onChange={(e) => setFormDivision(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Email Kontak</label>
                  <input
                    type="email"
                    placeholder="name@bilikstrategi.id"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Telepon / WA</label>
                  <input
                    type="text"
                    placeholder="+62 812-3456-7890"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Default Kapasitas Jam Kerja (Jam/Bulan)</label>
                <input
                  type="number"
                  required
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(parseInt(e.target.value) || 40)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-extrabold outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditMemberModal(false)}
                  className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl font-bold hover:text-[#24324A] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#24324A] hover:bg-[#1A2536] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-[#F26B5E]" />
                  <span>Simpan Perubahan</span>
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
