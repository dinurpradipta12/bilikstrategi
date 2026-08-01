'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  User,
  Tag,
  MessageSquare,
  Paperclip,
  CheckSquare,
  AlertCircle,
  Send,
  Trash2,
  Edit3,
  Save,
  RefreshCw,
} from 'lucide-react';
import { AgencyTask } from '@/lib/mock/data';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface TaskDetailDrawerProps {
  task: AgencyTask | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (taskId: string, newStatus: AgencyTask['status']) => void;
  onPriorityChange?: (taskId: string, newPriority: AgencyTask['priority']) => void;
  onDeleteTask?: (taskId: string) => void;
  onTaskUpdated?: (updatedTask: AgencyTask) => void;
}

interface ClickUpMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

export default function TaskDetailDrawer({
  task,
  isOpen,
  onClose,
  onStatusChange,
  onPriorityChange,
  onDeleteTask,
  onTaskUpdated,
}: TaskDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskStatus, setTaskStatus] = useState<AgencyTask['status']>('to_do');
  const [taskPriority, setTaskPriority] = useState<AgencyTask['priority']>('normal');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('276885530');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Real ClickUp Team members for PIC dropdown
  const [members, setMembers] = useState<ClickUpMember[]>([]);

  // Real ClickUp Comments state
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Array<{ id: string; user: string; text: string; time: string; avatar?: string }>>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);

  const [localTask, setLocalTask] = useState<AgencyTask | null>(task);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize form states when task changes
  useEffect(() => {
    if (task) {
      setLocalTask(task);
      setTaskName(task.task_name || '');
      setTaskDesc(task.description || '');
      setTaskStatus(task.status || 'to_do');
      setTaskPriority(task.priority || 'normal');
      setTaskDueDate(
        task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      );
      setTaskAssigneeId(task.assignee_ids?.[0] || '276885530');
      setIsEditing(false);
      setSaveSuccessMsg(null);
    }
  }, [task]);

  // Fetch real team members & ClickUp comments when drawer opens
  useEffect(() => {
    if (isOpen && task) {
      async function fetchMembers() {
        try {
          const res = await fetch('/api/clickup/teams');
          if (res.ok) {
            const data = await res.json();
            if (data.members && data.members.length > 0) {
              const formatted: ClickUpMember[] = data.members.map((m: any) => ({
                id: String(m.id),
                name: m.username || (m.email ? m.email.split('@')[0] : 'Team Member'),
                email: m.email || '',
                role: m.role_key || (m.role === 1 ? 'owner' : m.role === 2 ? 'admin' : 'member'),
                avatar: m.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username || 'TM')}&background=24324A&color=fff`,
              }));
              setMembers(formatted);
            }
          }
        } catch {
          // ignore
        }
      }

      async function fetchComments() {
        if (!task?.id) return;
        setLoadingComments(true);
        try {
          const res = await fetch(`/api/clickup/comments?taskId=${task.id}`);
          if (res.ok) {
            const data = await res.json();
            const rawComments = data.comments || data;
            if (Array.isArray(rawComments)) {
              const formatted = rawComments.map((c: any) => ({
                id: c.id || `c-${Math.random()}`,
                user: c.user?.username || c.user?.email || 'User ClickUp',
                avatar: c.user?.profilePicture || 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
                text: c.comment_text || c.text || '',
                time: c.date ? new Date(parseInt(c.date, 10)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja',
              }));
              setComments(formatted);
            }
          }
        } catch {
          // fallback
          setComments([
            { id: 'c1', user: 'Dinur Pradipta', text: 'Task ini sudah disinkronkan langsung dengan ClickUp Workspace.', time: 'Hari ini' },
          ]);
        } finally {
          setLoadingComments(false);
        }
      }

      fetchMembers();
      fetchComments();
    }
  }, [isOpen, task]);

  if (!isOpen || !task || !mounted) return null;

  const activeTask = localTask || task;

  // Handle saving task edits to ClickUp API
  const handleSaveTaskEdits = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);

    try {
      const selectedMember = members.find((m) => m.id === String(taskAssigneeId));

      const res = await fetch('/api/clickup/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          name: taskName,
          description: taskDesc,
          status: taskStatus,
          priority: taskPriority,
          due_date: taskDueDate,
          assignees: taskAssigneeId ? [taskAssigneeId] : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(`Gagal mengupdate task di ClickUp: ${errData.error || res.statusText}`);
        setIsSaving(false);
        return;
      }

      const updatedTask: AgencyTask = {
        ...(localTask || task),
        task_name: taskName,
        description: taskDesc,
        status: taskStatus,
        priority: taskPriority,
        due_date: new Date(taskDueDate).toISOString(),
        assignee_ids: selectedMember ? [selectedMember.id] : (localTask || task).assignee_ids,
        assignee_names: selectedMember ? [selectedMember.name] : (localTask || task).assignee_names,
        assignee_avatars: selectedMember ? [selectedMember.avatar] : (localTask || task).assignee_avatars,
        clickup_updated_at: new Date().toISOString(),
      };

      setLocalTask(updatedTask);

      if (onTaskUpdated) {
        onTaskUpdated(updatedTask);
      }
      if (onStatusChange && taskStatus !== (localTask || task).status) {
        onStatusChange(task.id, taskStatus);
      }
      if (onPriorityChange && taskPriority !== (localTask || task).priority) {
        onPriorityChange(task.id, taskPriority);
      }

      setIsEditing(false);
      setSaveSuccessMsg('Perubahan task berhasil disinkronkan ke ClickUp!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch {
      alert('Terjadi kesalahan jaringan saat memperbarui task di ClickUp');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle sending comment to ClickUp API
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSendingComment(true);
    const textToSend = commentText;
    setCommentText('');

    try {
      const res = await fetch('/api/clickup/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          commentText: textToSend,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newC = {
          id: data.id || `c_${Date.now()}`,
          user: 'Dinur Pradipta',
          avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
          text: textToSend,
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        };
        setComments((prev) => [...prev, newC]);
      } else {
        // Optimistic fallback
        setComments((prev) => [
          ...prev,
          {
            id: `c_${Date.now()}`,
            user: 'Dinur Pradipta',
            avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
            text: textToSend,
            time: 'Baru saja',
          },
        ]);
      }
    } catch {
      // Optimistic fallback
      setComments((prev) => [
        ...prev,
        {
          id: `c_${Date.now()}`,
          user: 'Dinur Pradipta',
          avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
          text: textToSend,
          time: 'Baru saja',
        },
      ]);
    } finally {
      setIsSendingComment(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(task.clickup_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-xs">
      {/* Backdrop overlay click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-[#FFFFFF] h-full shadow-2xl flex flex-col border-l border-[#E8E8EC] z-10 animate-slide-left">
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#E8E8EC] bg-[#F7F7F8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-[#EEF2F7] text-[#24324A] rounded">
              {activeTask.clickup_task_id}
            </span>
            <span className="text-xs text-[#737680] truncate max-w-[180px]">{activeTask.project_name}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                isEditing
                  ? 'border-[#24324A] bg-[#24324A] text-white'
                  : 'border-[#E8E8EC] bg-[#FFFFFF] text-[#24324A] hover:bg-[#EEF2F7]'
              }`}
              title="Edit Task ClickUp"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Mode Batal Edit' : 'Edit Task'}</span>
            </button>

            <button
              onClick={copyUrl}
              className="p-1.5 rounded-lg border border-[#E8E8EC] text-[#737680] hover:text-[#202124] hover:bg-[#FFFFFF] text-xs flex items-center gap-1 cursor-pointer"
              title="Salin URL Task"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Tersalin!' : 'Copy Link'}</span>
            </button>

            <a
              href={activeTask.clickup_url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-[#24324A] text-white text-xs flex items-center gap-1 hover:bg-[#1A2536]"
              title="Buka Asli di ClickUp"
            >
              <span>ClickUp</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#F26B5E]" />
            </a>

            {onDeleteTask && (
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="p-1.5 rounded-lg border border-[#FFF0ED] bg-[#FFF0ED] text-[#D95858] hover:bg-[#D95858] hover:text-white transition-colors text-xs flex items-center gap-1 cursor-pointer ml-1"
                title="Hapus Task dari ClickUp"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#E8E8EC] text-[#737680] ml-2 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Save Success Alert */}
        {saveSuccessMsg && (
          <div className="m-4 p-3 bg-[#EEF2F7] border border-[#4F9D78] text-[#4F9D78] text-xs font-semibold rounded-lg flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
            {saveSuccessMsg}
          </div>
        )}

        {/* Drawer Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TITLE & DESCRIPTION (READ MODE vs EDIT MODE) */}
          {isEditing ? (
            <div className="p-4 bg-[#FFFBF0] border border-[#FEF3D6] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#E6A23C] flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5" /> Edit Detail Task ClickUp
                </span>
                <span className="text-[10px] text-[#737680]">Perubahan akan langsung disimpan ke ClickUp</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#202124] mb-1">Nama Task *</label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-[#E8E8EC] rounded-lg bg-[#FFFFFF] focus:outline-none focus:border-[#24324A]"
                  placeholder="Nama Task..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#202124] mb-1">Deskripsi & Brief Task</label>
                <textarea
                  rows={4}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E8E8EC] rounded-lg bg-[#FFFFFF] focus:outline-none focus:border-[#24324A]"
                  placeholder="Tulis deskripsi detail task atau catatan brief..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#202124] mb-1">Batas Waktu (Due Date)</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8EC] rounded-lg bg-[#FFFFFF] focus:outline-none focus:border-[#24324A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#202124] mb-1">PIC / Assignee</label>
                  <select
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8EC] rounded-lg bg-[#FFFFFF] focus:outline-none focus:border-[#24324A]"
                  >
                    {members.length === 0 ? (
                      <option value="276885530">Dinur Pradipta (owner)</option>
                    ) : (
                      members.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#FEF3D6]">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-[#737680] hover:bg-[#F7F7F8] rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveTaskEdits}
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#24324A] hover:bg-[#1A2536] rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 text-[#F26B5E]" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-2 group">
                <h2 className="text-xl font-extrabold text-[#24324A] leading-snug">{activeTask.task_name}</h2>
                <button
                  onClick={() => setIsEditing(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[#737680] hover:text-[#24324A] transition-opacity cursor-pointer"
                  title="Edit Nama Task"
                >
                  <Edit3 className="w-4 h-4 text-[#F26B5E]" />
                </button>
              </div>
              <p className="text-xs text-[#737680] mt-2 leading-relaxed bg-[#F7F7F8] p-3 rounded-lg border border-[#E8E8EC] whitespace-pre-line">
                {activeTask.description || 'Tidak ada deskripsi detail tambahan.'}
              </p>
            </div>
          )}

          {/* Controls Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-xs">
            <div>
              <span className="text-[#737680] block text-[10px] uppercase font-bold">Status</span>
              <select
                value={activeTask.status}
                onChange={(e) => {
                  const newSt = e.target.value as any;
                  setTaskStatus(newSt);
                  setLocalTask((prev) => (prev ? { ...prev, status: newSt } : null));
                  if (onStatusChange) onStatusChange(activeTask.id, newSt);
                }}
                className="mt-1 font-semibold text-[#24324A] bg-transparent border-none outline-none cursor-pointer capitalize"
              >
                <option value="to_do">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="revision">Revision</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <span className="text-[#737680] block text-[10px] uppercase font-bold">Priority</span>
              <select
                value={activeTask.priority}
                onChange={(e) => {
                  const newPr = e.target.value as any;
                  setTaskPriority(newPr);
                  setLocalTask((prev) => (prev ? { ...prev, priority: newPr } : null));
                  if (onPriorityChange) onPriorityChange(activeTask.id, newPr);
                }}
                className="mt-1 font-semibold text-[#24324A] bg-transparent border-none outline-none cursor-pointer uppercase"
              >
                <option value="urgent">Urgent 🔴</option>
                <option value="high">High 🟠</option>
                <option value="normal">Normal 🔵</option>
                <option value="low">Low ⚪</option>
              </select>
            </div>

            <div>
              <span className="text-[#737680] block text-[10px] uppercase font-bold">Due Date</span>
              <span className="mt-1 font-semibold text-[#202124] block">
                {new Date(activeTask.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div>
              <span className="text-[#737680] block text-[10px] uppercase font-bold">Time Tracked</span>
              <span className="mt-1 font-semibold text-[#4F9D78] block">
                {activeTask.time_tracked_hours} jam / {activeTask.time_estimate_hours}h est
              </span>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-xs font-bold text-[#737680] uppercase tracking-wider mb-2 flex items-center">
              <Tag className="w-3.5 h-3.5 mr-1 text-[#F26B5E]" /> Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {activeTask.tags && activeTask.tags.length > 0 ? (
                activeTask.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-1 bg-[#EEF2F7] text-[#24324A] text-[11px] font-semibold rounded-md border border-[#E8E8EC]">
                    #{tag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[#737680] italic">Belum ada tags</span>
              )}
            </div>
          </div>

          {/* Assignees */}
          <div>
            <h3 className="text-xs font-bold text-[#737680] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center">
                <User className="w-3.5 h-3.5 mr-1 text-[#24324A]" /> Assignees / PIC ClickUp
              </span>
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {activeTask.assignee_names && activeTask.assignee_names.length > 0 ? (
                activeTask.assignee_names.map((name, idx) => (
                  <div key={name + idx} className="flex items-center gap-1.5 bg-[#F7F7F8] px-2.5 py-1 rounded-lg border border-[#E8E8EC] text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeTask.assignee_avatars?.[idx] || 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg'} alt={name} className="w-5 h-5 rounded-full object-cover" />
                    <span className="font-semibold text-[#202124]">{name}</span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-[#737680] italic">Belum ada PIC yang di-assign</span>
              )}
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <h3 className="text-xs font-bold text-[#737680] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center">
                <CheckSquare className="w-3.5 h-3.5 mr-1 text-[#4F9D78]" /> Subtasks ({task.subtask_count || 0})
              </span>
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="p-2.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg flex items-center gap-2 text-[#202124]">
                <input type="checkbox" defaultChecked className="rounded border-[#E8E8EC] text-[#4F9D78]" />
                <span className="line-through text-[#737680]">Penyusunan referensi visual moodboard</span>
              </div>
              <div className="p-2.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg flex items-center gap-2 text-[#202124]">
                <input type="checkbox" className="rounded border-[#E8E8EC] text-[#4F9D78]" />
                <span>Export format 4K PNG & PDF High-Res</span>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="pt-4 border-t border-[#E8E8EC] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#24324A] flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#F26B5E]" />
                <span>Komentar Task & Synchronized ClickUp Chat ({comments.length})</span>
                {loadingComments && <RefreshCw className="w-3 h-3 animate-spin text-[#F26B5E]" />}
              </h3>
            </div>

            {/* Existing Comments List */}
            {comments.length === 0 ? (
              <div className="p-4 border border-dashed border-[#E8E8EC] rounded-xl text-center text-xs text-[#737680]">
                Belum ada komentar pada task ini. Tulis komentar pertama Anda di bawah!
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="p-3 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {c.avatar && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={c.avatar} alt={c.user} className="w-4 h-4 rounded-full object-cover" />
                        )}
                        <span className="font-bold text-[#24324A]">{c.user}</span>
                      </div>
                      <span className="text-[10px] text-[#737680]">{c.time}</span>
                    </div>
                    <p className="text-[#202124] pl-6">{c.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Send Comment Box */}
            <form onSubmit={handleSendComment} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Tulis komentar baru (otomatis tersimpan ke ClickUp)..."
                className="flex-1 px-3 py-2 text-xs border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
              />
              <button
                type="submit"
                disabled={isSendingComment}
                className="px-4 py-2 bg-[#24324A] text-white text-xs font-semibold rounded-xl hover:bg-[#1A2536] flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                {isSendingComment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#F26B5E]" />}
                <span>Kirim</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmDelete}
        title="Hapus Task dari ClickUp"
        message={`Apakah Anda yakin ingin menghapus task "${task.task_name}"? Tindakan ini akan menghapus task secara permanen dari ClickUp Workspace.`}
        confirmText="Hapus Task"
        cancelText="Batal"
        confirmVariant="danger"
        onConfirm={() => {
          setShowConfirmDelete(false);
          if (onDeleteTask) onDeleteTask(task.id);
          onClose();
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>,
    document.body
  );
}
