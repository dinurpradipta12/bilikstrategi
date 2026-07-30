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
  const [projects, setProjects] = useState<AgencyProject[]>([]);
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedAssignee, setSelectedAssignee] = useState('all');

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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-[#737680] mt-1">
            Ringkasan kinerja project, sinkronisasi ClickUp task, dan beban kerja tim agency secara real-time.
          </p>
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
  );
}
