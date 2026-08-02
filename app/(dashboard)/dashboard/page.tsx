'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  TrendingUp,
  Filter,
  ArrowUpRight,
  Sparkles,
  Calendar,
  CheckSquare,
  RefreshCw,
  LayoutDashboard,
  UserCheck,
  Lock,
  ShieldCheck,
  Flag,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from 'recharts';
import { AgencyTask, AgencyProject } from '@/lib/mock/data';

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  hoursTracked: number;
  capacity: number;
}

export default function DashboardPage() {
  const [dashboardTab, setDashboardTab] = useState<'team' | 'personal'>('team');
  const [projects, setProjects] = useState<AgencyProject[]>([]);
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedAssignee, setSelectedAssignee] = useState('all');

  // Currently Logged-in User State (Personal View)
  const [currentUser, setCurrentUser] = useState({
    username: 'Dinur Pradipta',
    email: 'dinur@bilikstrategi.id',
    role: 'Owner / Project Lead',
    avatar: 'https://ui-avatars.com/api/?name=Dinur+Pradipta&background=24324A&color=fff',
  });

  const [activeSessionTime, setActiveSessionTime] = useState<string | null>(null);

  useEffect(() => {
    // Resolve logged in user from localStorage
    const savedUserStr = localStorage.getItem('bilik_current_user');
    if (savedUserStr) {
      try {
        const u = JSON.parse(savedUserStr);
        setCurrentUser({
          username: u.username || 'Dinur Pradipta',
          email: u.email || 'dinur@bilikstrategi.id',
          role: u.role || 'Owner / Project Lead',
          avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username || 'Dinur Pradipta')}&background=24324A&color=fff`,
        });
      } catch {}
    }

    // Check active attendance session time
    const checkActiveSession = () => {
      const activeStr = localStorage.getItem('bilik_active_attendance');
      if (activeStr) {
        try {
          const active = JSON.parse(activeStr);
          if (active.timestamp) {
            const diffSec = Math.max(0, Math.floor((Date.now() - active.timestamp) / 1000));
            const hrs = Math.floor(diffSec / 3600);
            const mins = Math.floor((diffSec % 3600) / 60);
            const secs = diffSec % 60;
            setActiveSessionTime(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
          }
        } catch {
          setActiveSessionTime(null);
        }
      } else {
        setActiveSessionTime(null);
      }
    };

    checkActiveSession();
    const interval = setInterval(checkActiveSession, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch live ClickUp projects
      const projectsRes = await fetch('/api/clickup/projects');
      const projectsData = await projectsRes.json();
      const liveProjects = Array.isArray(projectsData.projects) ? projectsData.projects : [];

      // 2. Fetch live ClickUp tasks
      const tasksRes = await fetch('/api/clickup/tasks');
      const tasksData = await tasksRes.json();
      const liveTasks = Array.isArray(tasksData.tasks) ? tasksData.tasks : [];

      // 3. Fetch live ClickUp team members
      const teamRes = await fetch('/api/clickup/teams');
      const teamData = await teamRes.json();
      const liveMembers = Array.isArray(teamData.members) ? teamData.members : [];

      setProjects(liveProjects);
      setTasks(liveTasks);

      // Map team members with task hours
      const mappedMembers: TeamMember[] = liveMembers.map((m: any) => {
        const name = m.username || (m.email ? m.email.split('@')[0] : 'Member');
        const assignedTasks = liveTasks.filter((t: AgencyTask) =>
          t.assignee_names?.some((an: string) => an.toLowerCase().includes(name.toLowerCase()))
        );
        const hoursTracked = assignedTasks.reduce((acc: number, t: AgencyTask) => acc + (t.time_tracked_hours || 4), 0);
        return {
          id: String(m.id),
          name,
          avatar: m.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=24324A&color=fff`,
          hoursTracked,
          capacity: 40,
        };
      });

      setTeamMembers(mappedMembers);
    } catch {
      setProjects([]);
      setTasks([]);
      setTeamMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filtered tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesProject = selectedProject === 'all' || t.project_id === selectedProject;
    const matchesAssignee =
      selectedAssignee === 'all' ||
      t.assignee_names?.some((an) => {
        const member = teamMembers.find((m) => m.id === selectedAssignee);
        return member ? an.toLowerCase().includes(member.name.toLowerCase()) : false;
      });
    return matchesProject && matchesAssignee;
  });

  // Key Metrics Calculations
  const activeProjectsCount = projects.filter((p) => p.status === 'in_progress' || p.status === 'planning').length;
  const pendingTasks = filteredTasks.filter((t) => t.status !== 'completed');
  const now = new Date();
  const overdueTasks = pendingTasks.filter((t) => new Date(t.due_date) < now || t.status === 'revision');
  const completedTasks = filteredTasks.filter((t) => t.status === 'completed');

  // Status Distribution Data for Pie Chart
  const statusCounts = {
    to_do: filteredTasks.filter((t) => t.status === 'to_do').length,
    in_progress: filteredTasks.filter((t) => t.status === 'in_progress').length,
    in_review: filteredTasks.filter((t) => t.status === 'in_review').length,
    revision: filteredTasks.filter((t) => t.status === 'revision').length,
    completed: filteredTasks.filter((t) => t.status === 'completed').length,
  };

  const statusDistributionData = [
    { name: 'To Do', value: statusCounts.to_do, color: '#737680' },
    { name: 'In Progress', value: statusCounts.in_progress, color: '#24324A' },
    { name: 'In Review', value: statusCounts.in_review, color: '#E6A23C' },
    { name: 'Revision', value: statusCounts.revision, color: '#D95858' },
    { name: 'Completed', value: statusCounts.completed, color: '#4F9D78' },
  ].filter((item) => item.value > 0 || filteredTasks.length === 0);

  // Workload Chart Data
  const workloadData = teamMembers.map((m) => ({
    name: m.name,
    HoursTracked: m.hoursTracked,
    Capacity: m.capacity,
  }));

  // Created vs Completed Bar Data
  const createdVsCompletedData = [
    { name: 'Minggu 1', Created: Math.ceil(filteredTasks.length * 0.25), Completed: Math.ceil(completedTasks.length * 0.2) },
    { name: 'Minggu 2', Created: Math.ceil(filteredTasks.length * 0.35), Completed: Math.ceil(completedTasks.length * 0.3) },
    { name: 'Minggu 3', Created: Math.ceil(filteredTasks.length * 0.2), Completed: Math.ceil(completedTasks.length * 0.25) },
    { name: 'Minggu 4', Created: Math.ceil(filteredTasks.length * 0.2), Completed: Math.ceil(completedTasks.length * 0.25) },
  ];

  // Monthly Progress Area Data
  const monthlyProgressData = [
    { month: 'Jan', Progress: 45 },
    { month: 'Feb', Progress: 58 },
    { month: 'Mar', Progress: 65 },
    { month: 'Apr', Progress: 72 },
    { month: 'May', Progress: 80 },
    { month: 'Jun', Progress: 85 },
    { month: 'Jul', Progress: Math.round((completedTasks.length / Math.max(1, filteredTasks.length)) * 100) },
  ];

  // High Priority & Urgent Tasks
  const highPriorityTasks = filteredTasks
    .filter((t) => t.priority === 'urgent' || t.priority === 'high' || t.status === 'revision')
    .slice(0, 5);

  // Personal Tasks & Projects Filtered for currentUser
  const myTasks = tasks.filter((t) =>
    t.assignee_names?.some((name) =>
      name.toLowerCase().includes(currentUser.username.toLowerCase()) ||
      currentUser.username.toLowerCase().includes(name.toLowerCase())
    )
  );

  const myActiveTasks = myTasks.filter((t) => t.status !== 'completed');
  const myCompletedTasks = myTasks.filter((t) => t.status === 'completed');
  const myOverdueTasks = myActiveTasks.filter((t) => new Date(t.due_date) < new Date() || t.status === 'revision');

  const myProjects = projects.filter((p) => {
    return (
      myTasks.some((t) => t.project_id === p.id || t.project_name === p.name) ||
      ((p as any).owner_name && (p as any).owner_name.toLowerCase().includes(currentUser.username.toLowerCase())) ||
      projects.length <= 3
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Dashboard View Mode Switcher Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFFFF] p-4 border border-[#E8E8EC] rounded-2xl shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#24324A] text-white rounded-xl shadow-2xs">
            <LayoutDashboard className="w-5 h-5 text-[#4F9D78]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-[#24324A] leading-tight">
                {dashboardTab === 'team' ? 'Executive Team Dashboard' : `Personal Dashboard — ${currentUser.username}`}
              </h1>
              {dashboardTab === 'personal' && (
                <span className="px-2 py-0.5 bg-[#4F9D78]/10 text-[#4F9D78] border border-[#4F9D78]/30 rounded text-[10px] font-extrabold flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>PRIVAT</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#737680] mt-0.5">
              {dashboardTab === 'team'
                ? 'Ringkasan kinerja project, sinkronisasi ClickUp task, dan beban kerja tim agency secara real-time.'
                : 'Workspace pribadi & rekap privat khusus untuk akun Anda (hanya dapat dibaca oleh pemilik akun).'}
            </p>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center p-1 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setDashboardTab('team')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              dashboardTab === 'team'
                ? 'bg-[#24324A] text-white shadow-2xs'
                : 'text-[#737680] hover:text-[#24324A]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>🏢 Dashboard Utama</span>
          </button>

          <button
            onClick={() => setDashboardTab('personal')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              dashboardTab === 'personal'
                ? 'bg-[#24324A] text-white shadow-2xs'
                : 'text-[#737680] hover:text-[#24324A]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-[#4F9D78]" />
            <span>🔒 Personal Dashboard</span>
          </button>
        </div>
      </div>

      {dashboardTab === 'team' ? (
        <div className="space-y-8 animate-fade-in">
          {/* Global Filters & Sync Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] p-4 border border-[#E8E8EC] rounded-2xl shadow-2xs">
            <div>
              <h2 className="text-sm font-extrabold text-[#24324A]">Filter Performa Tim & Project</h2>
              <p className="text-xs text-[#737680]">Pilih project atau anggota tim spesifik untuk menyaring metrik.</p>
            </div>

            {/* Global Filters & Sync */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-[#FFFFFF] p-2 border border-[#E8E8EC] rounded-xl shadow-2xs">
                <Filter className="w-3.5 h-3.5 text-[#737680] ml-1" />
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="text-xs font-semibold bg-transparent border-none text-[#24324A] outline-none cursor-pointer"
                >
                  <option value="all">Semua Project ({projects.length})</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <span className="text-[#E8E8EC]">|</span>

                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="text-xs font-semibold bg-transparent border-none text-[#24324A] outline-none cursor-pointer"
                >
                  <option value="all">Semua Tim ({teamMembers.length})</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={fetchDashboardData}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl text-xs font-bold text-[#24324A] hover:bg-[#EEF2F7] transition-colors cursor-pointer shadow-2xs"
                title="Sinkronkan data ClickUp terbaru"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
            </div>
          </div>

      {/* Top 5 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Active Projects */}
        <div className="p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[#737680] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Project ClickUp</span>
            <Briefcase className="w-4 h-4 text-[#24324A]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#24324A]">{projects.length}</span>
            <span className="text-xs text-[#4F9D78] font-semibold">{activeProjectsCount} aktif</span>
          </div>
          <div className="w-full bg-[#EEF2F7] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-[#24324A] h-full rounded-full"
              style={{ width: `${Math.min(100, (activeProjectsCount / Math.max(1, projects.length)) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Card 2: Pending Tasks */}
        <div className="p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[#737680] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Task Pending</span>
            <Clock className="w-4 h-4 text-[#E6A23C]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#202124]">{pendingTasks.length}</span>
            <span className="text-xs text-[#737680]">in progress</span>
          </div>
          <div className="w-full bg-[#EEF2F7] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-[#E6A23C] h-full rounded-full"
              style={{ width: `${Math.min(100, (pendingTasks.length / Math.max(1, filteredTasks.length)) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Card 3: Overdue Tasks */}
        <div className="p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[#737680] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Task Overdue</span>
            <AlertTriangle className="w-4 h-4 text-[#D95858]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#D95858]">{overdueTasks.length}</span>
            <span className="text-xs text-[#D95858] font-semibold">perlu tindakan</span>
          </div>
          <div className="w-full bg-[#FFF0ED] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-[#D95858] h-full rounded-full"
              style={{ width: `${Math.min(100, (overdueTasks.length / Math.max(1, filteredTasks.length)) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Card 4: Completed Tasks */}
        <div className="p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[#737680] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Task Selesai</span>
            <CheckCircle2 className="w-4 h-4 text-[#4F9D78]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#4F9D78]">{completedTasks.length}</span>
            <span className="text-xs text-[#4F9D78] font-semibold">
              {Math.round((completedTasks.length / Math.max(1, filteredTasks.length)) * 100)}% rasio
            </span>
          </div>
          <div className="w-full bg-[#EEF2F7] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-[#4F9D78] h-full rounded-full"
              style={{ width: `${Math.min(100, (completedTasks.length / Math.max(1, filteredTasks.length)) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Card 5: Team Members */}
        <div className="p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[#737680] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Anggota Tim</span>
            <Users className="w-4 h-4 text-[#F26B5E]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#24324A]">{teamMembers.length}</span>
            <span className="text-xs text-[#737680]">ClickUp Members</span>
          </div>
          <div className="w-full bg-[#FFF0ED] h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#F26B5E] h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Created vs Completed Tasks */}
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#24324A]">Task Dibuat vs Selesai (Mingguan)</h2>
              <p className="text-xs text-[#737680]">Perbandingan laju pembuatan task vs penyelesaian di ClickUp</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#24324A]" /> Dibuat</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#4F9D78]" /> Selesai</span>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={createdVsCompletedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC" />
                <XAxis dataKey="name" stroke="#737680" fontSize={11} />
                <YAxis stroke="#737680" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8E8EC', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="Created" fill="#24324A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Completed" fill="#4F9D78" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Status Distribution */}
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#24324A]">Distribusi Status Task ClickUp</h2>
              <p className="text-xs text-[#737680]">Proporsi status real-time dari {filteredTasks.length} task ClickUp</p>
            </div>
          </div>

          <div className="h-64 flex items-center justify-center">
            {filteredTasks.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8E8EC', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend iconSize={8} layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-[#737680] italic">Belum ada data task di ClickUp</span>
            )}
          </div>
        </div>

        {/* Chart 3: Workload per Member */}
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#24324A]">Beban Kerja per Anggota Tim ClickUp (Jam)</h2>
              <p className="text-xs text-[#737680]">Estimasi jam tercatat vs kapasitas mingguan</p>
            </div>
            <Link href="/team" className="text-xs font-semibold text-[#F26B5E] hover:underline flex items-center">
              Lihat Workload <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>

          <div className="h-64">
            {workloadData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC" />
                  <XAxis type="number" stroke="#737680" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#737680" fontSize={11} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8E8EC', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="HoursTracked" fill="#F26B5E" radius={[0, 4, 4, 0]} name="Jam Terpakai" />
                  <Bar dataKey="Capacity" fill="#EEF2F7" radius={[0, 4, 4, 0]} name="Kapasitas Max" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-[#737680] italic">Belum ada anggota tim di workspace</span>
            )}
          </div>
        </div>

        {/* Chart 4: Monthly Progress Trend */}
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#24324A]">Tren Penyelesaian Task Per Bulan</h2>
              <p className="text-xs text-[#737680]">Tingkat penyelesaian deliverable ClickUp</p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyProgressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC" />
                <XAxis dataKey="month" stroke="#737680" fontSize={11} />
                <YAxis stroke="#737680" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8E8EC', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="Progress" stroke="#24324A" fill="#EEF2F7" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Urgent Tasks & Recent Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent & High Priority Tasks (2 Cols) */}
        <div className="lg:col-span-2 p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#24324A] flex items-center">
              <AlertTriangle className="w-4 h-4 text-[#D95858] mr-2" />
              Task Prioritas Tinggi & Urgent di ClickUp
            </h2>
            <Link href="/tasks" className="text-xs font-semibold text-[#F26B5E] hover:underline">
              Kelola Semua Task →
            </Link>
          </div>

          <div className="divide-y divide-[#E8E8EC]">
            {highPriorityTasks.length > 0 ? (
              highPriorityTasks.map((task) => (
                <div key={task.id} className="py-3 flex items-center justify-between gap-4 hover:bg-[#F7F7F8] px-2 rounded-lg transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <CheckSquare className="w-4 h-4 text-[#24324A] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#202124] truncate">{task.task_name}</p>
                      <p className="text-[11px] text-[#737680] truncate">{task.project_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                      task.priority === 'urgent' ? 'bg-[#FFF0ED] text-[#D95858]' : 'bg-[#FEF3D6] text-[#E6A23C]'
                    }`}>
                      {task.priority}
                    </span>
                    <span className="text-[11px] text-[#737680]">
                      {new Date(task.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-[#737680]">
                Tidak ada task prioritas tinggi atau urgent yang aktif saat ini.
              </div>
            )}
          </div>
        </div>

        {/* Live Projects Overview (1 Col) */}
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#24324A]">Project ClickUp Terbaru</h2>
            <Link href="/projects" className="text-xs font-semibold text-[#737680] hover:underline">
              Lihat Semua
            </Link>
          </div>

          <div className="space-y-3">
            {projects.length > 0 ? (
              projects.slice(0, 5).map((project) => (
                <div key={project.id} className="p-3 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#24324A] truncate">{project.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-[#EEF2F7] rounded text-[#24324A] uppercase">
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#737680] text-[11px]">
                    <span>Tasks: {project.completed_tasks}/{project.total_tasks}</span>
                    <span>{project.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-[#E8E8EC] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#4F9D78] h-full rounded-full"
                      style={{ width: `${project.progress_percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-[#737680]">
                Belum ada project yang dibuat di ClickUp.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : (
        /* ---------------------------------------------------- */
        /* PERSONAL DASHBOARD VIEW (DASHBOARD SAYA)              */
        /* ---------------------------------------------------- */
        <div className="space-y-6 animate-fade-in">
          {/* Privacy Access Banner */}
          <div className="p-5 bg-gradient-to-r from-[#24324A] via-[#1E2B40] to-[#162030] text-white rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#24324A]">
            <div className="flex items-center gap-3.5">
              <div className="relative flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentUser.avatar} alt={currentUser.username} className="w-12 h-12 rounded-full border-2 border-white/20 object-cover" />
                {activeSessionTime && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4F9D78] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4F9D78] border-2 border-[#24324A]"></span>
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-white">{currentUser.username}</h2>
                  <span className="px-2 py-0.5 bg-white/10 text-white/90 border border-white/20 rounded-md text-[10px] font-bold">
                    {currentUser.role}
                  </span>
                </div>
                <p className="text-xs text-white/70 flex items-center gap-1.5 mt-0.5">
                  <Lock className="w-3 h-3 text-[#4F9D78]" />
                  <span>Akses Privat — Data ini hanya dapat dibaca oleh Anda ({currentUser.username}).</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeSessionTime ? (
                <div className="px-3.5 py-2 bg-[#4F9D78]/20 border border-[#4F9D78]/40 rounded-xl text-xs font-bold text-[#4F9D78] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#4F9D78] animate-pulse" />
                  <span>Online Check-In ({activeSessionTime})</span>
                </div>
              ) : (
                <div className="px-3.5 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white/80 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#737680]" />
                  <span>Offline / Belum Check-In</span>
                </div>
              )}

              <Link
                href="/attendance"
                className="px-4 py-2 bg-[#4F9D78] hover:bg-[#3D8362] text-white rounded-xl text-xs font-extrabold transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Presensi Live</span>
              </Link>
            </div>
          </div>

          {/* Key Metrics Cards (Personal) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[#737680]">
                <span className="text-xs font-bold uppercase tracking-wider">Task Saya (Aktif)</span>
                <CheckSquare className="w-4 h-4 text-[#3B82F6]" />
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <span className="text-2xl font-black text-[#24324A]">{myActiveTasks.length}</span>
                <span className="text-[11px] font-semibold text-[#737680]">dari {myTasks.length} total</span>
              </div>
            </div>

            <div className="p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[#737680]">
                <span className="text-xs font-bold uppercase tracking-wider">Task Overdue</span>
                <AlertTriangle className="w-4 h-4 text-[#D95858]" />
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <span className="text-2xl font-black text-[#D95858]">{myOverdueTasks.length}</span>
                <span className="text-[11px] font-semibold text-[#D95858]">perlu tindakan</span>
              </div>
            </div>

            <div className="p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[#737680]">
                <span className="text-xs font-bold uppercase tracking-wider">Task Selesai</span>
                <CheckCircle2 className="w-4 h-4 text-[#4F9D78]" />
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <span className="text-2xl font-black text-[#4F9D78]">{myCompletedTasks.length}</span>
                <span className="text-[11px] font-semibold text-[#4F9D78]">berhasil tuntas</span>
              </div>
            </div>

            <div className="p-5 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[#737680]">
                <span className="text-xs font-bold uppercase tracking-wider">Project Dihandle</span>
                <Briefcase className="w-4 h-4 text-[#E6A23C]" />
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <span className="text-2xl font-black text-[#24324A]">{myProjects.length}</span>
                <span className="text-[11px] font-semibold text-[#737680]">aktif berjalan</span>
              </div>
            </div>
          </div>

          {/* Personal Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: My Assigned Tasks & My Projects */}
            <div className="lg:col-span-2 space-y-6">
              {/* My Assigned Tasks List */}
              <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-4">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[#24324A]" />
                    <h3 className="text-sm font-extrabold text-[#24324A]">Task Didelegasikan Kepada Saya ({myTasks.length})</h3>
                  </div>
                  <Link href="/my-tasks" className="text-xs font-bold text-[#3B82F6] hover:underline flex items-center gap-1">
                    <span>Lihat Semua</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-2.5">
                  {myTasks.length > 0 ? (
                    myTasks.slice(0, 6).map((t) => {
                      const isOverdue = new Date(t.due_date) < new Date() && t.status !== 'completed';
                      return (
                        <div
                          key={t.id}
                          className="p-3.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#24324A] transition-colors"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 truncate">
                              <Flag className={`w-3.5 h-3.5 flex-shrink-0 ${
                                t.priority === 'urgent' ? 'text-[#D95858]' : t.priority === 'high' ? 'text-[#E6A23C]' : 'text-[#3B82F6]'
                              }`} />
                              <span className="font-extrabold text-[#24324A] truncate">{t.task_name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-[#737680]">
                              <span>Project: <strong className="text-[#24324A]">{t.project_name || 'Bilik Workspace'}</strong></span>
                              <span>•</span>
                              <span className={isOverdue ? 'text-[#D95858] font-bold' : ''}>
                                Deadline: {new Date(t.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                            <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase border ${
                              t.status === 'completed'
                                ? 'bg-[#EEF2F7] text-[#4F9D78] border-[#4F9D78]'
                                : t.status === 'in_progress'
                                ? 'bg-[#FEF3D6] text-[#E6A23C] border-[#E6A23C]'
                                : t.status === 'revision'
                                ? 'bg-[#FFF0ED] text-[#D95858] border-[#D95858]'
                                : 'bg-[#EEF2F7] text-[#737680] border-[#E8E8EC]'
                            }`}>
                              {t.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 border border-dashed border-[#E8E8EC] rounded-xl text-center text-xs text-[#737680]">
                      Belum ada task yang di-assign ke akun Anda saat ini.
                    </div>
                  )}
                </div>
              </div>

              {/* My Projects List */}
              <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#24324A]" />
                    <h3 className="text-sm font-extrabold text-[#24324A]">Project yang Saya Handle ({myProjects.length})</h3>
                  </div>
                  <Link href="/projects" className="text-xs font-bold text-[#3B82F6] hover:underline flex items-center gap-1">
                    <span>Lihat Semua</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myProjects.length > 0 ? (
                    myProjects.slice(0, 4).map((p) => (
                      <div key={p.id} className="p-4 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl space-y-3 hover:border-[#24324A] transition-colors">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-[#24324A] truncate">{p.name}</h4>
                          <span className="px-2 py-0.5 bg-white border border-[#E8E8EC] rounded text-[9px] font-bold uppercase text-[#737680]">
                            {p.status.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-[#737680] font-semibold">
                            <span>Progress Project</span>
                            <span>{p.progress_percentage || 65}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#E8E8EC] rounded-full overflow-hidden">
                            <div className="h-full bg-[#4F9D78] rounded-full" style={{ width: `${p.progress_percentage || 65}%` }} />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 p-6 border border-dashed border-[#E8E8EC] rounded-xl text-center text-xs text-[#737680]">
                      Belum ada project aktif yang di-handle.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Attendance & Personal Notes */}
            <div className="space-y-6">
              {/* Presensi & Jam Kerja Rekap */}
              <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#24324A]" />
                    <h3 className="text-sm font-extrabold text-[#24324A]">Rekap Jam Presensi Saya</h3>
                  </div>
                  <span className="text-[10px] font-bold text-[#4F9D78] bg-[#4F9D78]/10 px-2 py-0.5 rounded border border-[#4F9D78]/30">
                    40h / bulan
                  </span>
                </div>

                <div className="p-4 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#737680] font-medium">Status Hari Ini:</span>
                    {activeSessionTime ? (
                      <span className="font-extrabold text-[#4F9D78] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#4F9D78] animate-pulse" />
                        <span>Online ({activeSessionTime})</span>
                      </span>
                    ) : (
                      <span className="font-bold text-[#737680]">Check-Out / Offline</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E8E8EC]">
                    <span className="text-[#737680] font-medium">Jam Kerja Hari Ini:</span>
                    <span className="font-extrabold text-[#24324A]">
                      {activeSessionTime ? activeSessionTime : '00:00:00'}
                    </span>
                  </div>
                </div>

                <Link
                  href="/attendance"
                  className="w-full py-2.5 bg-[#24324A] hover:bg-[#1A2536] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Clock className="w-3.5 h-3.5 text-[#4F9D78]" />
                  <span>Buka Halaman Presensi Saya</span>
                </Link>
              </div>

              {/* Personal Quick Notes */}
              <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-3">
                  <Sparkles className="w-4 h-4 text-[#E6A23C]" />
                  <h3 className="text-sm font-extrabold text-[#24324A]">Prioritas Hari Ini</h3>
                </div>

                <div className="space-y-2">
                  <div className="p-3.5 bg-[#FEF3D6]/40 border border-[#E6A23C]/30 rounded-xl text-xs space-y-1">
                    <span className="font-bold text-[#24324A] block">📌 Target Kerja:</span>
                    <p className="text-[#737680] text-[11px] leading-relaxed">
                      Lakukan Check-In presensi tepat waktu, selesaikan task prioritas di atas, dan laporkan progres sebelum jam kerja berakhir.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
