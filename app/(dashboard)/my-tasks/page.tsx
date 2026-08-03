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
  Edit3,
  Trash2,
  User,
} from 'lucide-react';
import { AgencyTask } from '@/lib/mock/data';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { supabase } from '@/lib/supabase/client';

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AgencyTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openTaskInEditMode, setOpenTaskInEditMode] = useState(false);
  const [deleteTargetTask, setDeleteTargetTask] = useState<AgencyTask | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const resolveClickUpTaskId = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId || item.clickup_task_id === taskId);
    return task?.clickup_task_id || taskId;
  };

  const fetchMyTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/supabase/tasks', { cache: 'no-store' });
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

  useEffect(() => {
    const channel = supabase
      .channel('my_tasks_task_cache')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_cache' }, () => {
        fetchMyTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusChange = async (taskId: string, newStatus: AgencyTask['status']) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, status: newStatus });
    }
    try {
      await fetch('/api/supabase/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: newStatus }),
      });
      fetch('/api/clickup/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: resolveClickUpTaskId(taskId), status: newStatus }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTargetTask) return;

    const target = deleteTargetTask;
    const clickupTaskId = resolveClickUpTaskId(target.id);
    setIsDeletingTask(true);
    setTasks((prev) => prev.filter((task) => task.id !== target.id && task.clickup_task_id !== clickupTaskId));

    try {
      await fetch(`/api/supabase/tasks?taskId=${encodeURIComponent(target.id)}`, { method: 'DELETE' });
      if (!clickupTaskId.startsWith('app-')) {
        await fetch(`/api/clickup/tasks?taskId=${encodeURIComponent(clickupTaskId)}`, { method: 'DELETE' }).catch(() => {});
      }
      setDeleteTargetTask(null);
      setDrawerOpen(false);
      setSelectedTask(null);
    } finally {
      setIsDeletingTask(false);
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
                key={`${t.id}-${t.clickup_task_id || 'app'}`}
                onClick={() => { setSelectedTask(t); setOpenTaskInEditMode(false); setDrawerOpen(true); }}
                className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#FFF0ED] px-2 rounded-lg transition-colors"
              >
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-[#24324A] truncate">{t.task_name}</h3>
                  <p className="text-[11px] text-[#737680]">{t.project_name}</p>
                  <p className="text-[11px] text-[#737680] flex items-center gap-1 mt-0.5">
                    {t.assignee_avatars?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.assignee_avatars[0]} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                    <span>{t.assignee_names?.[0] || 'Belum ada PIC'}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 text-xs shrink-0">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FFF0ED] text-[#D95858] rounded uppercase">
                    {t.priority}
                  </span>
                  <span className="text-[#D95858] font-semibold text-[11px]">
                    Due: {new Date(t.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-1 border-l border-[#E8E8EC] pl-2" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => { setSelectedTask(t); setOpenTaskInEditMode(true); setDrawerOpen(true); }}
                      className="p-1.5 text-[#737680] hover:text-[#24324A] hover:bg-[#EEF2F7] rounded-lg transition-colors"
                      title="Edit Task"
                      aria-label={`Edit ${t.task_name}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetTask(t)}
                      className="p-1.5 text-[#737680] hover:text-[#D95858] hover:bg-[#FFF0ED] rounded-lg transition-colors"
                      title="Hapus Task"
                      aria-label={`Hapus ${t.task_name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
              key={`${t.id}-${t.clickup_task_id || 'app'}`}
              onClick={() => { setSelectedTask(t); setOpenTaskInEditMode(false); setDrawerOpen(true); }}
              className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#F7F7F8] px-2 rounded-lg transition-colors"
            >
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-[#24324A] truncate">{t.task_name}</h3>
                  <p className="text-[11px] text-[#737680]">{t.project_name}</p>
                  <p className="text-[11px] text-[#737680] flex items-center gap-1 mt-0.5">
                    {t.assignee_avatars?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.assignee_avatars[0]} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                    <span>{t.assignee_names?.[0] || 'Belum ada PIC'}</span>
                  </p>
                </div>
              <div className="flex flex-wrap items-center justify-end gap-2 text-xs shrink-0">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#EEF2F7] text-[#24324A] rounded uppercase">
                  {t.status}
                </span>
                <span className="text-[#737680] text-[11px]">
                  Est: {t.time_estimate_hours}h
                </span>
                <div className="flex items-center gap-1 border-l border-[#E8E8EC] pl-2" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => { setSelectedTask(t); setOpenTaskInEditMode(true); setDrawerOpen(true); }}
                    className="p-1.5 text-[#737680] hover:text-[#24324A] hover:bg-[#EEF2F7] rounded-lg transition-colors"
                    title="Edit Task"
                    aria-label={`Edit ${t.task_name}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTargetTask(t)}
                    className="p-1.5 text-[#737680] hover:text-[#D95858] hover:bg-[#FFF0ED] rounded-lg transition-colors"
                    title="Hapus Task"
                    aria-label={`Hapus ${t.task_name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
              key={`${t.id}-${t.clickup_task_id || 'app'}`}
              onClick={() => { setSelectedTask(t); setOpenTaskInEditMode(false); setDrawerOpen(true); }}
              className="py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#F7F7F8] px-2 rounded-lg transition-colors"
            >
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-[#24324A] truncate">{t.task_name}</h3>
                  <p className="text-[11px] text-[#737680]">{t.project_name}</p>
                  <p className="text-[11px] text-[#737680] flex items-center gap-1 mt-0.5">
                    {t.assignee_avatars?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.assignee_avatars[0]} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                    <span>{t.assignee_names?.[0] || 'Belum ada PIC'}</span>
                  </p>
                </div>
              <div className="flex flex-wrap items-center justify-end gap-2 text-xs shrink-0">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FEF3D6] text-[#E6A23C] rounded uppercase">
                  {t.priority}
                </span>
                <span className="text-[#737680] text-[11px]">
                  {new Date(t.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                </span>
                <div className="flex items-center gap-1 border-l border-[#E8E8EC] pl-2" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => { setSelectedTask(t); setOpenTaskInEditMode(true); setDrawerOpen(true); }}
                    className="p-1.5 text-[#737680] hover:text-[#24324A] hover:bg-[#EEF2F7] rounded-lg transition-colors"
                    title="Edit Task"
                    aria-label={`Edit ${t.task_name}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTargetTask(t)}
                    className="p-1.5 text-[#737680] hover:text-[#D95858] hover:bg-[#FFF0ED] rounded-lg transition-colors"
                    title="Hapus Task"
                    aria-label={`Hapus ${t.task_name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
            <div key={`${t.id}-${t.clickup_task_id || 'app'}`} className="py-2.5 flex items-center justify-between gap-4 text-xs opacity-75">
              <div className="min-w-0">
                <span className="line-through font-medium text-[#737680] block">{t.task_name}</span>
                <span className="text-[11px] text-[#737680] flex items-center gap-1 mt-0.5">
                  <User className="w-3 h-3" />
                  {t.assignee_names?.[0] || 'Belum ada PIC'}
                </span>
              </div>
              <span className="text-[10px] text-[#4F9D78] font-bold uppercase shrink-0">Selesai</span>
            </div>
          ))}
        </div>
      </div>

      {/* Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setOpenTaskInEditMode(false); }}
        startInEditMode={openTaskInEditMode}
        onStatusChange={handleStatusChange}
        onDeleteTask={(taskId) => {
          const target = tasks.find((task) => task.id === taskId || task.clickup_task_id === taskId) || selectedTask;
          if (target) setDeleteTargetTask(target);
        }}
        onTaskUpdated={(updatedTask) => {
          setSelectedTask(updatedTask);
          setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
          setOpenTaskInEditMode(false);
        }}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTargetTask)}
        title="Hapus Task"
        message={deleteTargetTask ? `Apakah Anda yakin ingin menghapus task "${deleteTargetTask.task_name}" dari aplikasi dan ClickUp?` : ''}
        confirmText="Hapus Task"
        cancelText="Batal"
        confirmVariant="danger"
        loading={isDeletingTask}
        onConfirm={handleDeleteTask}
        onCancel={() => setDeleteTargetTask(null)}
      />
    </div>
  );
}
