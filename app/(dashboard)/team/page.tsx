'use client';

import React, { useState, useEffect } from 'react';
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
  Network,
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

interface NodePosition {
  id: string;
  x: number;
  y: number;
  parentId?: string | null;
}

function InteractiveTeamChart({ members }: { members: TeamMemberWorkload[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [parentMap, setParentMap] = useState<Record<string, string>>({});

  // Initialize layout positions
  useEffect(() => {
    if (members.length === 0) return;
    const initial: Record<string, NodePosition> = {};
    const pMap: Record<string, string> = {};

    const rootId = members[0].id;
    initial[rootId] = { id: rootId, x: 380, y: 30 };

    const childMembers = members.slice(1);
    const cols = 4;
    const itemWidth = 180;
    const itemGap = 25;

    childMembers.forEach((m, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = 50 + col * (itemWidth + itemGap);
      const y = 190 + row * 150;
      initial[m.id] = { id: m.id, x, y, parentId: rootId };
      pMap[m.id] = rootId;
    });

    setPositions(initial);
    setParentMap(pMap);
  }, [members]);

  const handleMouseDown = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingId(id);
    const pos = positions[id] || { x: 0, y: 0 };
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    let newX = e.clientX - rect.left - dragOffset.x + containerRef.current!.scrollLeft;
    let newY = e.clientY - rect.top - dragOffset.y + containerRef.current!.scrollTop;

    newX = Math.max(10, Math.min(newX, 1100));
    newY = Math.max(10, Math.min(newY, 700));

    setPositions((prev) => ({
      ...prev,
      [draggingId]: { ...prev[draggingId], x: newX, y: newY },
    }));
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  const handleParentChange = (childId: string, newParentId: string) => {
    setParentMap((prev) => ({ ...prev, [childId]: newParentId }));
    setPositions((prev) => ({
      ...prev,
      [childId]: { ...prev[childId], parentId: newParentId },
    }));
  };

  const resetPositions = () => {
    if (members.length === 0) return;
    const initial: Record<string, NodePosition> = {};
    const rootId = members[0].id;
    initial[rootId] = { id: rootId, x: 380, y: 30 };

    const childMembers = members.slice(1);
    const cols = 4;
    const itemWidth = 180;
    const itemGap = 25;

    childMembers.forEach((m, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = 50 + col * (itemWidth + itemGap);
      const y = 190 + row * 150;
      initial[m.id] = { id: m.id, x, y, parentId: rootId };
    });
    setPositions(initial);
  };

  const CARD_WIDTH = 175;
  const CARD_HEIGHT = 100;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-4 py-2 border border-[#E8E8EC] rounded-xl text-xs font-semibold gap-2">
        <div className="flex items-center gap-2 text-[#737680]">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#EEF2F7] text-[#24324A] rounded-lg font-bold">
            🖐️ Klik & Geser Card untuk mengatur hirarki tim • Garis terhubung otomatis!
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetPositions}
            className="px-3 py-1.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg hover:bg-[#EEF2F7] text-[#24324A] font-bold transition-colors cursor-pointer"
          >
            Reset Tata Letak
          </button>
          <div className="flex items-center gap-1 bg-[#F7F7F8] border border-[#E8E8EC] px-2 py-1 rounded-lg">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="px-1.5 hover:text-[#F26B5E] font-bold cursor-pointer">-</button>
            <span className="w-12 text-center font-bold text-[#24324A]">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} className="px-1.5 hover:text-[#F26B5E] font-bold cursor-pointer">+</button>
          </div>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative bg-white border border-[#E8E8EC] rounded-2xl shadow-2xs overflow-auto h-[550px] select-none bg-grid-pattern cursor-grab active:cursor-grabbing"
      >
        <div
          className="relative min-w-[1000px] min-h-[750px] transition-transform duration-75 origin-top-left"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* Dynamic SVG Connecting Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#24324A" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#7B68EE" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            {members.map((m) => {
              const pId = parentMap[m.id] || (m.id !== members[0]?.id ? members[0]?.id : null);
              if (!pId || !positions[m.id] || !positions[pId]) return null;

              const parentPos = positions[pId];
              const childPos = positions[m.id];

              const x1 = parentPos.x + CARD_WIDTH / 2;
              const y1 = parentPos.y + CARD_HEIGHT;

              const x2 = childPos.x + CARD_WIDTH / 2;
              const y2 = childPos.y;

              const midY = (y1 + y2) / 2;
              const pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

              return (
                <g key={`link-${pId}-${m.id}`}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke="url(#lineGrad)"
                    strokeWidth="2.5"
                    strokeDasharray="6 3"
                    className="animate-pulse"
                  />
                  <circle cx={x1} cy={y1} r="4" fill="#24324A" />
                  <circle cx={x2} cy={y2} r="4" fill="#7B68EE" />
                </g>
              );
            })}
          </svg>

          {/* Draggable Cards */}
          {members.map((m, idx) => {
            const isRoot = idx === 0;
            const pos = positions[m.id] || { x: 50 + idx * 180, y: isRoot ? 30 : 190 };
            const isDragging = draggingId === m.id;

            return (
              <div
                key={m.id}
                onMouseDown={(e) => handleMouseDown(m.id, e)}
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${CARD_WIDTH}px`,
                }}
                className={`absolute z-10 p-3 rounded-2xl border transition-shadow cursor-grab active:cursor-grabbing ${
                  isRoot
                    ? 'bg-[#24324A] text-white border-[#24324A] shadow-lg'
                    : 'bg-white text-[#24324A] border-[#E8E8EC] hover:border-[#7B68EE] shadow-sm'
                } ${isDragging ? 'ring-2 ring-[#7B68EE] shadow-2xl scale-105 z-20' : ''}`}
              >
                <div className="flex flex-col items-center text-center space-y-1.5">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.avatar_url}
                      alt={m.full_name}
                      className={`w-9 h-9 rounded-full object-cover border-2 ${
                        isRoot ? 'border-white' : 'border-[#E8E8EC]'
                      }`}
                    />
                    {isRoot && (
                      <span className="absolute -top-1 -right-1 text-xs">👑</span>
                    )}
                  </div>

                  <div className="w-full min-w-0">
                    <h5 className="text-xs font-bold truncate leading-tight">{m.full_name}</h5>
                    <p className={`text-[10px] truncate ${isRoot ? 'text-[#EEF2F7]' : 'text-[#737680]'}`}>
                      {isRoot ? 'Workspace Owner' : m.role}
                    </p>
                  </div>

                  {!isRoot && (
                    <div className="w-full pt-1 border-t border-[#E8E8EC]/80 mt-0.5">
                      <select
                        value={parentMap[m.id] || members[0]?.id}
                        onChange={(e) => handleParentChange(m.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-[9px] font-bold text-[#737680] bg-[#F7F7F8] border border-[#E8E8EC] rounded px-1 py-0.5 outline-none cursor-pointer text-center"
                        title="Ubah Atasan / Lead Manager"
                      >
                        {members.map((pm) => (
                          <option key={pm.id} value={pm.id}>
                            ↑ {pm.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TeamWorkloadPage() {
  const [activeTab, setActiveTab] = useState<'workload' | 'analytics' | 'priorities' | 'chart' | 'timesheet'>('workload');
  const [members, setMembers] = useState<TeamMemberWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<'Owner' | 'Admin' | 'Member'>('Owner');
  const [allTasks, setAllTasks] = useState<any[]>([]);

  const fetchTeamWorkload = async () => {
    setLoading(true);
    try {
      // Fetch authenticated user profile
      try {
        const userRes = await fetch('/api/clickup/user');
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user) {
            const roleNum = userData.user.role;
            if (roleNum === 1) setCurrentUserRole('Owner');
            else if (roleNum === 2) setCurrentUserRole('Admin');
            else setCurrentUserRole('Member');
          }
        }
      } catch (err) {
        console.warn('[TeamWorkload] User role fetch fallback to Owner.', err);
      }

      // 1. Fetch live ClickUp team members
      const teamRes = await fetch('/api/clickup/teams');
      const teamData = await teamRes.json();
      const clickUpMembers = Array.isArray(teamData.members) ? teamData.members : [];

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
          onClick={() => setActiveTab('chart')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'chart'
              ? 'bg-[#24324A] text-[#FFFFFF] shadow-2xs'
              : 'text-[#737680] hover:text-[#24324A] hover:bg-[#EEF2F7]'
          }`}
        >
          <Network className="w-4 h-4 text-[#3B82F6]" />
          <span>Team Chart</span>
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
          {!isAdminOrOwner && (
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
      {/* TAB 4: TEAM CHART (Organizational Hierarchy Map)     */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'chart' && (
        <InteractiveTeamChart members={members} />
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
              <span className="px-3 py-1 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg font-bold text-[#737680]">$ Billable status</span>
              <span className="px-3 py-1 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg font-bold text-[#737680]">🏷️ Tag</span>
              <span className="px-3 py-1 bg-[#EEF2F7] border border-[#24324A]/20 rounded-lg font-bold text-[#24324A]">⏱️ Tracked time</span>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F7F7F8] border-b border-[#E8E8EC] text-[#737680] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4 min-w-[200px]">People ({members.length})</th>
                    <th className="py-3 px-2 text-center">Sun, Jul 26</th>
                    <th className="py-3 px-2 text-center">Mon, Jul 27</th>
                    <th className="py-3 px-2 text-center">Tue, Jul 28</th>
                    <th className="py-3 px-2 text-center">Wed, Jul 29</th>
                    <th className="py-3 px-2 text-center">Thu, Jul 30</th>
                    <th className="py-3 px-2 text-center">Fri, Jul 31</th>
                    <th className="py-3 px-2 text-center">Sat, Aug 1</th>
                    <th className="py-3 px-4 text-center font-bold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8EC]">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-[#F7F7F8] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.avatar_url} alt={m.full_name} className="w-7 h-7 rounded-full border border-[#E8E8EC]" />
                          <div>
                            <span className="font-bold text-[#24324A] block">{m.full_name}</span>
                            <span className="text-[10px] text-[#737680]">40h capacity</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center text-[#737680]">0h</td>
                      <td className="py-3 px-2 text-center font-semibold text-[#24324A]">8h</td>
                      <td className="py-3 px-2 text-center font-semibold text-[#24324A]">8h</td>
                      <td className="py-3 px-2 text-center font-semibold text-[#24324A]">8h</td>
                      <td className="py-3 px-2 text-center font-semibold text-[#24324A]">8h</td>
                      <td className="py-3 px-2 text-center font-semibold text-[#24324A]">8h</td>
                      <td className="py-3 px-2 text-center text-[#737680]">0h</td>
                      <td className="py-3 px-4 text-center font-extrabold text-[#4F9D78]">40h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
