'use client';

import React, { useState, useEffect } from 'react';
import {
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Filter,
  CheckSquare,
  RefreshCw,
} from 'lucide-react';
import { AgencyTask } from '@/lib/mock/data';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AgencyTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchMyTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clickup/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } else {
        setTasks([]);
      }
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();
  }, []);

  const handleStatusChange = async (taskId: string, newStatus: AgencyTask['status']) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, status: newStatus });
    }
    try {
      await fetch('/api/clickup/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: newStatus }),
      });
    } catch {
      // ignore
    }
  };

  // Filter tasks for current user
  const myTasks = tasks.filter((t) => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesStatus;
  });

  const todayTasks = myTasks.filter((t) => t.status === 'in_progress');
  const overdueTasks = myTasks.filter((t) => t.tags.includes('Overdue') || t.status === 'revision');
  const upcomingTasks = myTasks.filter((t) => t.status === 'to_do' || t.status === 'in_review');
  const completedTasks = myTasks.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">My Tasks</h1>
          <p className="text-xs text-[#737680] mt-1">
            Daftar tugas pribadi yang ditugaskan kepada Anda hari ini dan mendatang.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3 bg-[#FFFFFF] p-2 border border-[#E8E8EC] rounded-xl shadow-2xs">
          <Filter className="w-3.5 h-3.5 text-[#737680] ml-1" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-transparent border-none text-[#24324A] outline-none cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="in_progress">In Progress</option>
            <option value="to_do">To Do</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Sections */}

      {/* 1. OVERDUE TASKS */}
      {overdueTasks.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#D95858]/30 rounded-xl p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-[#D95858]">
            <AlertTriangle className="w-4 h-4" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider">Perlu Perhatian / Overdue ({overdueTasks.length})</h2>
          </div>

          <div className="divide-y divide-[#E8E8EC]">
            {overdueTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => { setSelectedTask(t); setDrawerOpen(true); }}
                className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#FFF0ED] px-2 rounded-lg transition-colors"
              >
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-[#24324A] truncate">{t.task_name}</h3>
                  <p className="text-[11px] text-[#737680]">{t.project_name}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FFF0ED] text-[#D95858] rounded uppercase">
                    {t.priority}
                  </span>
                  <span className="text-[#D95858] font-semibold text-[11px]">
                    Due: {new Date(t.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. TODAY TASKS */}
      <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-[#24324A]">
          <Clock className="w-4 h-4 text-[#F26B5E]" />
          <h2 className="text-xs font-extrabold uppercase tracking-wider">Sedang Dikerjakan Hari Ini ({todayTasks.length})</h2>
        </div>

        <div className="divide-y divide-[#E8E8EC]">
          {todayTasks.map((t) => (
            <div
              key={t.id}
              onClick={() => { setSelectedTask(t); setDrawerOpen(true); }}
              className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#F7F7F8] px-2 rounded-lg transition-colors"
            >
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-[#24324A] truncate">{t.task_name}</h3>
                <p className="text-[11px] text-[#737680]">{t.project_name}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#EEF2F7] text-[#24324A] rounded uppercase">
                  {t.status}
                </span>
                <span className="text-[#737680] text-[11px]">
                  Est: {t.time_estimate_hours}h
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. UPCOMING TASKS */}
      <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-[#24324A]">
          <Calendar className="w-4 h-4 text-[#24324A]" />
          <h2 className="text-xs font-extrabold uppercase tracking-wider">Akan Datang (Upcoming) ({upcomingTasks.length})</h2>
        </div>

        <div className="divide-y divide-[#E8E8EC]">
          {upcomingTasks.map((t) => (
            <div
              key={t.id}
              onClick={() => { setSelectedTask(t); setDrawerOpen(true); }}
              className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#F7F7F8] px-2 rounded-lg transition-colors"
            >
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-[#24324A] truncate">{t.task_name}</h3>
                <p className="text-[11px] text-[#737680]">{t.project_name}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FEF3D6] text-[#E6A23C] rounded uppercase">
                  {t.priority}
                </span>
                <span className="text-[#737680] text-[11px]">
                  {new Date(t.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. COMPLETED TASKS */}
      <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-[#4F9D78]">
          <CheckCircle2 className="w-4 h-4" />
          <h2 className="text-xs font-extrabold uppercase tracking-wider">Tugas Selesai ({completedTasks.length})</h2>
        </div>

        <div className="divide-y divide-[#E8E8EC]">
          {completedTasks.map((t) => (
            <div key={t.id} className="py-2.5 flex items-center justify-between text-xs opacity-75">
              <span className="line-through font-medium text-[#737680]">{t.task_name}</span>
              <span className="text-[10px] text-[#4F9D78] font-bold uppercase">Selesai</span>
            </div>
          ))}
        </div>
      </div>

      {/* Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
