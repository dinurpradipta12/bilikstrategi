'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from 'lucide-react';
import { AgencyTask, AgencyProject } from '@/lib/mock/data';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';

interface DayColumn {
  dayName: string;
  dateNum: string;
  fullDate: string;
  isToday: boolean;
}

const WEEK_DAYS: DayColumn[] = [
  { dayName: 'SUN', dateNum: '02', fullDate: '2026-08-02', isToday: true },
  { dayName: 'MON', dateNum: '03', fullDate: '2026-08-03', isToday: false },
  { dayName: 'TUE', dateNum: '04', fullDate: '2026-08-04', isToday: false },
  { dayName: 'WED', dateNum: '05', fullDate: '2026-08-05', isToday: false },
  { dayName: 'THU', dateNum: '06', fullDate: '2026-08-06', isToday: false },
  { dayName: 'FRI', dateNum: '07', fullDate: '2026-08-07', isToday: false },
  { dayName: 'SAT', dateNum: '08', fullDate: '2026-08-08', isToday: false },
];

const PASTEL_THEMES = [
  { bg: 'bg-[#E8F1FF]', text: 'text-[#1E56B3]', border: 'border-[#BDD7FF]', icon: '🎨' },
  { bg: 'bg-[#E3F8E9]', text: 'text-[#1D7434]', border: 'border-[#B4ECC2]', icon: '📝' },
  { bg: 'bg-[#F2E8FF]', text: 'text-[#6929C4]', border: 'border-[#DAAFFE]', icon: '🚀' },
  { bg: 'bg-[#FFE8E8]', text: 'text-[#C22929]', border: 'border-[#FFB8B8]', icon: '📦' },
];

export default function TimelinePage() {
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [projects, setProjects] = useState<AgencyProject[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTask, setSelectedTask] = useState<AgencyTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filters & Controls state
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'year'>('week');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        fetch('/api/clickup/tasks').catch(() => null),
        fetch('/api/clickup/projects').catch(() => null),
      ]);

      if (tasksRes?.ok) {
        const d = await tasksRes.json();
        setTasks(Array.isArray(d.tasks) ? d.tasks : []);
      }

      if (projectsRes?.ok) {
        const d = await projectsRes.json();
        setProjects(Array.isArray(d.projects) ? d.projects : []);
      }
    } catch {
      setTasks([]);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTasks = tasks.filter((t) => {
    const matchesProject = projectFilter === 'all' || t.project_id === projectFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      t.task_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.project_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProject && matchesStatus && matchesSearch;
  });

  // Calculate task status counts
  const totalCount = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const toDoCount = tasks.filter((t) => t.status === 'to_do').length;
  const completedCount = tasks.filter((t) => t.status === 'completed' || (t as any).status?.type === 'closed').length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header Controls Bar (Reference Style) */}
      <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Month Selector & Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-[#24324A]">Agustus, 2026</span>
              <div className="flex items-center border border-[#E8E8EC] rounded-lg bg-[#F7F7F8] p-0.5">
                <button className="p-1 text-[#737680] hover:text-[#202124] rounded cursor-pointer">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="p-1 text-[#737680] hover:text-[#202124] rounded cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#737680]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari task atau project..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A] bg-[#F7F7F8]"
              />
            </div>
          </div>

          {/* Right Controls: View Switcher, Today, Project Filter */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl p-1 text-xs font-semibold text-[#737680]">
              {(['day', 'week', 'month', 'year'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                    viewMode === mode ? 'bg-[#FFFFFF] text-[#24324A] shadow-2xs font-extrabold' : 'hover:text-[#202124]'
                  }`}
                >
                  {mode === 'day' ? 'Hari' : mode === 'week' ? 'Minggu' : mode === 'month' ? 'Bulan' : 'Tahun'}
                </button>
              ))}
            </div>

            {/* Today Button */}
            <button className="px-3.5 py-1.5 bg-[#24324A] text-white text-xs font-bold rounded-xl hover:bg-[#1A2536] shadow-xs cursor-pointer">
              Hari Ini
            </button>

            {/* Project Filter */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E8E8EC] rounded-xl bg-[#FFFFFF] text-xs font-semibold text-[#24324A]">
              <Filter className="w-3.5 h-3.5 text-[#F26B5E]" />
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="bg-transparent outline-none cursor-pointer"
              >
                <option value="all">Semua Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filter Status Tabs (Reference Style Pill Badges) */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-[#E8E8EC] text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'all' ? 'bg-[#24324A] text-white' : 'bg-[#F7F7F8] text-[#737680] border border-[#E8E8EC] hover:bg-[#EEF2F7]'
            }`}
          >
            <span>Semua Task</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px]">{totalCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'in_progress' ? 'bg-[#24324A] text-white' : 'bg-[#F7F7F8] text-[#737680] border border-[#E8E8EC] hover:bg-[#EEF2F7]'
            }`}
          >
            <span>In Progress</span>
            <span className="px-1.5 py-0.2 bg-[#F26B5E]/20 text-[#F26B5E] rounded text-[10px] font-bold">{inProgressCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('to_do')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'to_do' ? 'bg-[#24324A] text-white' : 'bg-[#F7F7F8] text-[#737680] border border-[#E8E8EC] hover:bg-[#EEF2F7]'
            }`}
          >
            <span>To Do / Upcoming</span>
            <span className="px-1.5 py-0.2 bg-[#737680]/20 text-[#737680] rounded text-[10px] font-bold">{toDoCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'completed' ? 'bg-[#24324A] text-white' : 'bg-[#F7F7F8] text-[#737680] border border-[#E8E8EC] hover:bg-[#EEF2F7]'
            }`}
          >
            <span>Completed</span>
            <span className="px-1.5 py-0.2 bg-[#4F9D78]/20 text-[#4F9D78] rounded text-[10px] font-bold">{completedCount}</span>
          </button>
        </div>
      </div>

      {/* MAIN CALENDAR TIMELINE SCHEDULE BOARD (IDENTICAL TO REFERENCE) */}
      <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs overflow-hidden">
        {/* Days Header Columns */}
        <div className="grid grid-cols-7 border-b border-[#E8E8EC] bg-[#FFFFFF] text-center text-xs font-bold text-[#737680]">
          {WEEK_DAYS.map((day) => (
            <div
              key={day.fullDate}
              className={`py-3 border-r border-[#E8E8EC] last:border-r-0 flex flex-col items-center justify-center gap-1 ${
                day.isToday ? 'bg-[#EEF2F7]/60' : ''
              }`}
            >
              <span className="text-[10px] tracking-wider uppercase font-semibold">{day.dayName}</span>
              <span
                className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-extrabold ${
                  day.isToday ? 'bg-[#24324A] text-white shadow-xs' : 'text-[#202124]'
                }`}
              >
                {day.dateNum}
              </span>
            </div>
          ))}
        </div>

        {/* Schedule Board Body with Vertical Column Grid Lines */}
        <div className="relative min-h-[480px] p-4 bg-[#FFFFFF]">
          {/* Vertical Grid Column Lines */}
          <div className="absolute inset-0 grid grid-cols-7 divide-x divide-[#E8E8EC]/50 pointer-events-none" />

          {/* Schedule Bar Rows Container */}
          {loading ? (
            <div className="relative z-10 p-12 text-center text-xs text-[#737680]">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#F26B5E] mb-2" />
              <span>Memuat kalender timeline schedule ClickUp...</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="relative z-10 p-12 text-center text-xs text-[#737680]">
              Tidak ada schedule task yang sesuai dengan filter.
            </div>
          ) : (
            <div className="relative z-10 space-y-3">
              {filteredTasks.map((task, idx) => {
                const theme = PASTEL_THEMES[idx % PASTEL_THEMES.length];
                const dueD = task.due_date ? new Date(task.due_date).getDate() : 5;
                const startD = task.start_date ? new Date(task.start_date).getDate() : Math.max(2, dueD - 3);

                // Map day number 2-8 to col index 0-6
                const startCol = Math.max(0, Math.min(6, startD - 2));
                const endCol = Math.max(startCol, Math.min(6, dueD - 2));
                const colSpan = Math.max(1, endCol - startCol + 1);

                return (
                  <div key={task.id} className="grid grid-cols-7 gap-2">
                    <div
                      style={{ gridColumnStart: startCol + 1, gridColumnEnd: `span ${colSpan}` }}
                      onClick={() => {
                        setSelectedTask(task);
                        setDrawerOpen(true);
                      }}
                      className={`group ${theme.bg} ${theme.border} border rounded-xl p-2.5 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm flex-shrink-0">{theme.icon}</span>
                        <div className="truncate">
                          <span className={`text-xs font-bold block truncate ${theme.text}`}>
                            {task.task_name}
                          </span>
                          <span className="text-[10px] opacity-80 block truncate">
                            {task.project_name} • {task.assignee_names[0] || 'Member'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${theme.bg} ${theme.text} border ${theme.border}`}>
                          {colSpan} Hari
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
