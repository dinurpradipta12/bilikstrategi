'use client';

import React, { useState } from 'react';
import {
  CheckSquare,
  Search,
  Filter,
  Plus,
  LayoutList,
  Kanban,
  CalendarDays,
  ExternalLink,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { MOCK_TASKS, MOCK_PROJECTS, MOCK_USERS, AgencyTask } from '@/lib/mock/data';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';

import { useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';

import ConfirmModal from '@/components/ui/ConfirmModal';

type ViewMode = 'list' | 'board' | 'calendar';

export default function TasksPage() {
  const [tasks, setTasks] = useState<AgencyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AgencyTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete confirm modal state
  const [deleteTargetTask, setDeleteTargetTask] = useState<AgencyTask | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'urgent' | 'high' | 'normal' | 'low'>('normal');
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
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
    fetchTasks();
  }, []);

  // 2-Way Status Update
  const handleStatusChange = async (taskId: string, newStatus: AgencyTask['status']) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, clickup_updated_at: new Date().toISOString() } : t))
    );

    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, status: newStatus });
    }

    setToastMessage('Menyingkronkan status ke ClickUp…');
    try {
      await fetch('/api/clickup/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: newStatus }),
      });
      setToastMessage('Status task berhasil diperbarui & disinkronkan ke ClickUp!');
    } catch {
      setToastMessage('Gagal menyingkronkan status ke ClickUp');
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 2-Way Priority Update
  const handlePriorityChange = async (taskId: string, newPriority: AgencyTask['priority']) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, priority: newPriority } : t))
    );
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, priority: newPriority });
    }

    setToastMessage('Menyingkronkan prioritas ke ClickUp…');
    try {
      await fetch('/api/clickup/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, priority: newPriority }),
      });
      setToastMessage('Prioritas task berhasil diubah & disinkronkan!');
    } catch {
      setToastMessage('Gagal menyingkronkan prioritas ke ClickUp');
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setToastMessage('Menghapus task dari ClickUp…');
    try {
      const res = await fetch(`/api/clickup/tasks?taskId=${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setToastMessage('Task berhasil dihapus dari ClickUp Workspace!');
      } else {
        setToastMessage('Gagal menghapus task dari ClickUp');
        await fetchTasks();
      }
    } catch {
      setToastMessage('Terjadi kesalahan jaringan saat menghapus task');
      await fetchTasks();
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/clickup/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTaskName,
          description: newTaskDesc,
          priority: newTaskPriority,
        }),
      });

      if (res.ok) {
        setNewTaskName('');
        setNewTaskDesc('');
        setIsModalOpen(false);
        setToastMessage('Task baru berhasil dibuat di ClickUp!');
        setTimeout(() => setToastMessage(null), 3000);
        await fetchTasks();
      } else {
        alert('Gagal membuat task di ClickUp');
      }
    } catch {
      alert('Terjadi kesalahan jaringan');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.task_name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.project_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const matchesProject = projectFilter === 'all' || t.project_id === projectFilter;
    return matchesSearch && matchesStatus && matchesPriority && matchesProject;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-[#24324A] text-white text-xs font-semibold rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#4F9D78]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">ClickUp Task Management</h1>
          <p className="text-xs text-[#737680] mt-1">
            Manajemen task agency real-time dengan sinkronisasi ClickUp backend API.
          </p>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#24324A] hover:bg-[#1a2536] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Task Baru</span>
          </button>

          <button
            onClick={() => {
              setToastMessage('Menyingkronkan data terbaru dari ClickUp Workspace...');
              fetchTasks();
              setTimeout(() => setToastMessage(null), 2000);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl text-xs font-semibold text-[#24324A] hover:bg-[#EEF2F7] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#F26B5E] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <div className="flex items-center bg-[#FFFFFF] border border-[#E8E8EC] p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'list' ? 'bg-[#EEF2F7] text-[#24324A]' : 'text-[#737680] hover:text-[#202124]'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'board' ? 'bg-[#EEF2F7] text-[#24324A]' : 'text-[#737680] hover:text-[#202124]'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'calendar' ? 'bg-[#EEF2F7] text-[#24324A]' : 'text-[#737680] hover:text-[#202124]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Multi Filters Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-[#FFFFFF] p-4 border border-[#E8E8EC] rounded-xl shadow-2xs">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-[#737680] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari task name atau project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold border border-[#E8E8EC] rounded-lg bg-[#FFFFFF] text-[#24324A]"
          >
            <option value="all">Semua Status</option>
            <option value="to_do">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="revision">Revision</option>
            <option value="completed">Completed</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold border border-[#E8E8EC] rounded-lg bg-[#FFFFFF] text-[#24324A]"
          >
            <option value="all">Semua Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold border border-[#E8E8EC] rounded-lg bg-[#FFFFFF] text-[#24324A]"
          >
            <option value="all">Semua Project</option>
            {MOCK_PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* EMPTY STATE */}
      {filteredTasks.length === 0 && !loading && (
        <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl p-12 text-center space-y-3 shadow-2xs">
          <CheckSquare className="w-10 h-10 text-[#737680] mx-auto opacity-40" />
          <h3 className="text-sm font-extrabold text-[#24324A]">Belum Ada Task di ClickUp</h3>
          <p className="text-xs text-[#737680] max-w-sm mx-auto">
            Tidak ada task yang ditemukan. Klik tombol <span className="font-semibold text-[#24324A]">+ Task Baru</span> untuk membuat task baru di ClickUp Workspace.
          </p>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F7F8] border-b border-[#E8E8EC] text-[#737680] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Task Name</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">ClickUp ID</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8EC]">
                {filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => { setSelectedTask(t); setDrawerOpen(true); }}
                    className="hover:bg-[#F7F7F8] cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-semibold text-[#24324A]">
                      <span className="hover:text-[#F26B5E] block">{t.task_name}</span>
                      <div className="flex gap-1 mt-1">
                        {t.tags.map((tag) => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.2 bg-[#EEF2F7] text-[#24324A] rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#737680] font-medium">{t.project_name}</td>
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t.id, e.target.value as any)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase cursor-pointer border border-[#E8E8EC] ${
                          t.status === 'completed' ? 'bg-[#EEF2F7] text-[#4F9D78]' :
                          t.status === 'in_progress' ? 'bg-[#EEF2F7] text-[#24324A]' :
                          t.status === 'revision' ? 'bg-[#FFF0ED] text-[#D95858]' : 'bg-[#FEF3D6] text-[#E6A23C]'
                        }`}
                      >
                        <option value="to_do">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="in_review">In Review</option>
                        <option value="revision">Revision</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={t.priority}
                        onChange={(e) => handlePriorityChange(t.id, e.target.value as any)}
                        className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-[#F7F7F8] border border-[#E8E8EC]"
                      >
                        <option value="urgent">Urgent 🔴</option>
                        <option value="high">High 🟠</option>
                        <option value="normal">Normal 🔵</option>
                        <option value="low">Low ⚪</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        {t.assignee_avatars.map((av, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={av} alt="Assignee" className="w-5 h-5 rounded-full object-cover border border-[#E8E8EC]" />
                        ))}
                        <span className="text-[11px] font-medium text-[#202124]">{t.assignee_names[0]}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#737680]">
                      {new Date(t.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2 py-0.5 text-[10px] font-mono bg-[#F7F7F8] border border-[#E8E8EC] rounded text-[#737680]">
                        {t.clickup_task_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteTargetTask(t)}
                        className="p-1.5 text-[#737680] hover:text-[#D95858] hover:bg-[#FFF0ED] rounded-lg transition-colors cursor-pointer"
                        title="Hapus Task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOARD VIEW */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto">
          {['to_do', 'in_progress', 'in_review', 'completed'].map((st) => {
            const tasksInSt = filteredTasks.filter((t) => t.status === st);
            return (
              <div key={st} className="bg-[#F7F7F8] border border-[#E8E8EC] p-3 rounded-xl space-y-3 min-w-[250px]">
                <div className="flex items-center justify-between pb-2 border-b border-[#E8E8EC]">
                  <h3 className="text-xs font-bold text-[#24324A] uppercase tracking-wider">
                    {st.replace('_', ' ')} ({tasksInSt.length})
                  </h3>
                </div>

                <div className="space-y-3">
                  {tasksInSt.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => { setSelectedTask(t); setDrawerOpen(true); }}
                      className="p-3 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl hover:border-[#24324A] cursor-pointer transition-all shadow-2xs"
                    >
                      <span className="text-[9px] font-bold text-[#F26B5E] block uppercase">{t.project_name}</span>
                      <h4 className="text-xs font-bold text-[#24324A] mt-1">{t.task_name}</h4>

                      <div className="mt-3 pt-2 border-t border-[#E8E8EC] flex items-center justify-between text-[11px] text-[#737680]">
                        <span className="uppercase font-bold text-[#D95858]">{t.priority}</span>
                        <span>Due: {new Date(t.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="p-8 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs text-center py-12">
          <CalendarDays className="w-8 h-8 text-[#24324A] mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#24324A]">Calendar View Task ClickUp</h3>
          <p className="text-xs text-[#737680] mt-1">
            Menampilkan seluruh due date task berdasarkan jadwal bulan berjalan.
          </p>
        </div>
      )}

      {/* Task Detail Drawer Component */}
      <TaskDetailDrawer
        task={selectedTask}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
        onDeleteTask={handleDeleteTask}
      />

      {/* Modal Tambah Task Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-3">
              <h3 className="text-sm font-extrabold text-[#24324A]">Buat Task Baru di ClickUp</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#737680] hover:text-[#24324A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#24324A] mb-1">Nama Task *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Design Landing Page Banner"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#24324A] mb-1">Prioritas Task</label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A] bg-white"
                >
                  <option value="urgent">🔴 Urgent</option>
                  <option value="high">🟠 High</option>
                  <option value="normal">🔵 Normal</option>
                  <option value="low">⚪ Low</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#24324A] mb-1">Deskripsi Task</label>
                <textarea
                  rows={3}
                  placeholder="Detail instruksi atau kriteria perkerjaan..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E8EC]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#737680] hover:bg-[#F7F7F8] rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold bg-[#24324A] hover:bg-[#1a2536] text-white rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Membuat…' : 'Buat Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete Task */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetTask)}
        title="Hapus Task dari ClickUp"
        message={deleteTargetTask ? `Apakah Anda yakin ingin menghapus task "${deleteTargetTask.task_name}"? Task ini akan terhapus secara permanen dari ClickUp Workspace.` : ''}
        confirmText="Hapus Task"
        cancelText="Batal"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteTargetTask) {
            handleDeleteTask(deleteTargetTask.id);
            setDeleteTargetTask(null);
          }
        }}
        onCancel={() => setDeleteTargetTask(null)}
      />
    </div>
  );
}
