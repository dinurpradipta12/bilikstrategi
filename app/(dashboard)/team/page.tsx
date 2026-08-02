'use client';

import React, { useState, useEffect } from 'react';
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
  Zap
} from 'lucide-react';

interface TeamMemberWorkload {
  id: string;
  full_name: string;
  email: string;
  role: string;
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
  const [activeTab, setActiveTab] = useState<'workload' | 'analytics' | 'priorities' | 'timesheet'>('workload');
  const [members, setMembers] = useState<TeamMemberWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<'Owner' | 'Admin' | 'Member'>('Owner');
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [timesheetRecap, setTimesheetRecap] = useState<Record<string, Record<string, any>>>({});

  // Check URL query string for ?tab=timesheet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['workload', 'analytics', 'priorities', 'timesheet'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  // Load live attendance timesheet recap from localStorage
  useEffect(() => {
    const recapStr = localStorage.getItem('bilik_timesheet_recap');
    if (recapStr) {
      try {
        setTimesheetRecap(JSON.parse(recapStr));
      } catch {
        setTimesheetRecap({});
      }
    }
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

      // 3. Map members with workload stats
      const now = new Date();
      const mappedMembers: TeamMemberWorkload[] = clickUpMembers.map((m: any) => {
        const memberName = m.username || (m.email ? m.email.split('@')[0] : 'Team Member');
        const assignedTasks = fetchedTasks.filter((t: any) =>
          t.assignee_names?.some((name: string) => name.toLowerCase().includes(memberName.toLowerCase()))
        );

        const activeTasks = assignedTasks.filter((t: any) => t.status !== 'completed');
        const completedTasks = assignedTasks.filter((t: any) => t.status === 'completed');
        const overdueTasks = activeTasks.filter((t: any) => new Date(t.due_date) < now);

        const hoursTracked = assignedTasks.reduce((acc: number, t: any) => acc + (t.time_tracked_hours || 4), 0);
        const capacity = 40;

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

        return {
          id: String(m.id),
          full_name: memberName,
          email: m.email || '',
          role: m.role === 1 ? 'Owner' : m.role === 2 ? 'Admin' : 'Member',
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

  const handleCapacityChange = (memberId: string, newCapacity: number) => {
    if (!isAdminOrOwner) return;

    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={user.avatar_url} alt={user.full_name} className="w-12 h-12 rounded-full object-cover border border-[#E8E8EC]" />
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
                        <span className="font-bold text-[#202124] text-sm">{user.assigned_tasks_count}</span>
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
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span className="text-[#737680]">Jam Kerja Terpakai:</span>
                        <span className="text-[#24324A]">{user.hours_tracked} jam / {user.capacity_hours} jam</span>
                      </div>
                      <div className="w-full bg-[#EEF2F7] h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            user.hours_tracked > user.capacity_hours ? 'bg-[#D95858]' : 'bg-[#24324A]'
                          }`}
                          style={{ width: `${Math.min(100, (user.hours_tracked / user.capacity_hours) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Capacity Hours Setting (Restricted to Admin/Owner) */}
                    <div className="flex items-center justify-between text-xs pt-2">
                      <span className="text-[#737680]">Default Kapasitas:</span>
                      {isAdminOrOwner ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={user.capacity_hours}
                            onChange={(e) => handleCapacityChange(user.id, parseInt(e.target.value) || 40)}
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
      {/* TAB 5: TIMESHEET (Weekly Logged Hours Matrix Grid)   */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'timesheet' && (
        <div className="space-y-6 animate-fade-in">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button className="p-1.5 border border-[#E8E8EC] rounded-lg hover:bg-[#F7F7F8]"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-xs font-extrabold text-[#24324A]">Jul 26 - Aug 1, 2026</span>
              <button className="p-1.5 border border-[#E8E8EC] rounded-lg hover:bg-[#F7F7F8]"><ChevronRight className="w-4 h-4" /></button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Link
                href="/attendance"
                className="px-3.5 py-1.5 bg-[#4F9D78] text-white rounded-xl font-extrabold hover:bg-[#3D8362] transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-white" />
                <span>⏱️ Presensi Check-In Live</span>
              </Link>
              <span className="px-3 py-1 bg-[#EEF2F7] border border-[#24324A]/20 rounded-lg font-bold text-[#24324A]">⏱️ Tracked time</span>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F7F7F8] border-b border-[#E8E8EC] text-[#737680] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4 min-w-[180px]">People ({members.length})</th>
                    <th className="py-3 px-2 text-center">Sun, Jul 26</th>
                    <th className="py-3 px-2 text-center">Mon, Jul 27</th>
                    <th className="py-3 px-2 text-center">Tue, Jul 28</th>
                    <th className="py-3 px-2 text-center">Wed, Jul 29</th>
                    <th className="py-3 px-2 text-center">Thu, Jul 30</th>
                    <th className="py-3 px-2 text-center">Fri, Jul 31</th>
                    <th className="py-3 px-2 text-center">Sat, Aug 1</th>
                    <th className="py-3 px-3 text-center font-bold text-[#E6A23C]">Total OT</th>
                    <th className="py-3 px-4 text-center font-bold text-[#4F9D78]">Total Jam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8EC]">
                  {members.map((m) => {
                    const userRecap = timesheetRecap[m.full_name] || {};

                    const getDayCell = (dayKey: string) => {
                      const dayData = userRecap[dayKey];
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

                    // Compute totals exclusively from real check-in data in this application
                    let totalReg = 0;
                    let totalOT = 0;

                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    days.forEach((d) => {
                      const dayData = userRecap[d];
                      if (typeof dayData === 'number') {
                        totalReg += dayData;
                      } else if (dayData) {
                        totalReg += dayData.regular || 0;
                        totalOT += dayData.overtime || 0;
                      }
                    });

                    const totalOverall = parseFloat((totalReg + totalOT).toFixed(2));

                    return (
                      <tr key={m.id} className="hover:bg-[#F7F7F8] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.avatar_url} alt={m.full_name} className="w-7 h-7 rounded-full border border-[#E8E8EC]" />
                            <div>
                              <span className="font-bold text-[#24324A] block">{m.full_name}</span>
                              <span className="text-[10px] text-[#737680]">ClickUp Team Member</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">{getDayCell('Sun')}</td>
                        <td className="py-3 px-2 text-center">{getDayCell('Mon')}</td>
                        <td className="py-3 px-2 text-center">{getDayCell('Tue')}</td>
                        <td className="py-3 px-2 text-center">{getDayCell('Wed')}</td>
                        <td className="py-3 px-2 text-center">{getDayCell('Thu')}</td>
                        <td className="py-3 px-2 text-center">{getDayCell('Fri')}</td>
                        <td className="py-3 px-2 text-center">{getDayCell('Sat')}</td>
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
      )}
    </div>
  );
}
