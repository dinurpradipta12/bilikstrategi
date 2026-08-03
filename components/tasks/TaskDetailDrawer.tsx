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
  Plus,
  UserPlus,
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
  startInEditMode?: boolean;
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
  startInEditMode = false,
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

  // Subtasks State (ClickUp Live Synced)
  const [subtasks, setSubtasks] = useState<Array<{ id: string; name: string; status: 'completed' | 'to_do' }>>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);
  const [newSubtaskName, setNewSubtaskName] = useState('');
  const [isCreatingSubtask, setIsCreatingSubtask] = useState(false);

  // Tags State
  const [tagInput, setTagInput] = useState('');
  const [showAddTagInput, setShowAddTagInput] = useState(false);

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
      const persistedSubtasks = (task as any).subtasks || (task as any).raw_data?.subtasks || [];
      const persistedComments = (task as any).comments || (task as any).raw_data?.comments || [];
      setTaskName(task.task_name || '');
      setTaskDesc(task.description || '');
      setTaskStatus(task.status || 'to_do');
      setTaskPriority(task.priority || 'normal');
      setTaskDueDate(
        task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      );
      setTaskAssigneeId(task.assignee_ids?.[0] || '276885530');
      setSubtasks(Array.isArray(persistedSubtasks) ? persistedSubtasks : []);
      setComments(Array.isArray(persistedComments) ? persistedComments : []);
      setIsEditing(startInEditMode);
      setSaveSuccessMsg(null);
    }
  }, [task, startInEditMode]);

  // Fetch real team members, ClickUp comments & subtasks when drawer opens
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
        const clickupTaskId = task?.clickup_task_id || task?.id;
        if (!clickupTaskId || String(clickupTaskId).startsWith('app-')) return;
        setLoadingComments(true);
        try {
          const res = await fetch(`/api/clickup/comments?taskId=${clickupTaskId}`);
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
          // Keep app-persisted comments.
        } finally {
          setLoadingComments(false);
        }
      }

      async function fetchSubtasks() {
        const clickupTaskId = task?.clickup_task_id || task?.id;
        if (!clickupTaskId || String(clickupTaskId).startsWith('app-')) return;
        setLoadingSubtasks(true);
        try {
          const res = await fetch(`/api/clickup/subtasks?taskId=${clickupTaskId}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.subtasks) && data.subtasks.length > 0) {
              const formatted = data.subtasks.map((st: any) => ({
                id: String(st.id),
                name: st.name || 'Subtask',
                status: st.status?.status?.toLowerCase() === 'complete' || st.status?.status?.toLowerCase() === 'completed' || st.status?.type === 'closed' ? ('completed' as const) : ('to_do' as const),
              }));
              setSubtasks(formatted);
              setLoadingSubtasks(false);
              return;
            }
          }
        } catch {
          // ignore
        } finally {
          setLoadingSubtasks(false);
        }
      }

      fetchMembers();
      fetchComments();
      fetchSubtasks();
    }
  }, [isOpen, task]);

  if (!isOpen || !task || !mounted) return null;

  const activeTask = localTask || task;

  const saveTaskToApp = async (updatedTask: AgencyTask, extra: Record<string, any> = {}) => {
    const payload = { ...updatedTask, ...extra, taskId: updatedTask.id };
    const res = await fetch('/api/supabase/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal menyimpan task aplikasi');
    }

    const data = await res.json();
    return data.task || updatedTask;
  };

  // Handle saving task edits to ClickUp API
  const handleSaveTaskEdits = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);

    try {
      const selectedMember = members.find((m) => m.id === String(taskAssigneeId));

      const updatedTask: AgencyTask = {
        ...activeTask,
        task_name: taskName,
        description: taskDesc,
        status: taskStatus,
        priority: taskPriority,
        due_date: new Date(taskDueDate).toISOString(),
        assignee_ids: selectedMember ? [selectedMember.id] : activeTask.assignee_ids,
        assignee_names: selectedMember ? [selectedMember.name] : activeTask.assignee_names,
        assignee_avatars: selectedMember ? [selectedMember.avatar] : activeTask.assignee_avatars,
        clickup_updated_at: new Date().toISOString(),
      };

      const savedTask = await saveTaskToApp(updatedTask, { subtasks, comments });
      setLocalTask(savedTask);

      if (onTaskUpdated) {
        onTaskUpdated(savedTask);
      }

      fetch('/api/clickup/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: activeTask.clickup_task_id || activeTask.id,
          name: taskName,
          description: taskDesc,
          status: taskStatus,
          priority: taskPriority,
          due_date: taskDueDate,
          assignees: taskAssigneeId ? [taskAssigneeId] : undefined,
        }),
      }).catch(() => {});

      setIsEditing(false);
      setSaveSuccessMsg('Perubahan task berhasil disimpan ke aplikasi.');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch {
      alert('Terjadi kesalahan jaringan saat memperbarui task aplikasi');
    } finally {
      setIsSaving(false);
    }
  };

  // Subtask Handlers
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskName.trim() || !activeTask) return;

    setIsCreatingSubtask(true);
    const subtaskText = newSubtaskName.trim();
    setNewSubtaskName('');

    const tempId = `st_${Date.now()}`;
    const newStItem = { id: tempId, name: subtaskText, status: 'to_do' as const };
    const updatedSubtasks = [...subtasks, newStItem];
    setSubtasks(updatedSubtasks);

    const taskWithSubtasks = { ...activeTask, subtask_count: updatedSubtasks.length } as AgencyTask;
    saveTaskToApp(taskWithSubtasks, { subtasks: updatedSubtasks }).then(setLocalTask).catch(() => {});

    try {
      const res = await fetch('/api/clickup/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId: activeTask.project_id,
          parentId: activeTask.clickup_task_id || activeTask.id,
          name: subtaskText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.subtask?.id) {
          const finalSubtasks = updatedSubtasks.map((s) => (s.id === tempId ? { ...s, id: String(data.subtask.id) } : s));
          setSubtasks(finalSubtasks);
          saveTaskToApp({ ...activeTask, subtask_count: finalSubtasks.length } as AgencyTask, { subtasks: finalSubtasks }).then(setLocalTask).catch(() => {});
        }
      }
    } catch {
      // Keep optimistic subtask item
    } finally {
      setIsCreatingSubtask(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentStatus: 'completed' | 'to_do') => {
    const nextStatus = currentStatus === 'completed' ? ('to_do' as const) : ('completed' as const);
    const updated = subtasks.map((s) => (s.id === subtaskId ? { ...s, status: nextStatus } : s));
    setSubtasks(updated);

    if (activeTask) {
      saveTaskToApp(activeTask, { subtasks: updated }).then(setLocalTask).catch(() => {});
    }

    try {
      await fetch('/api/clickup/subtasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtaskId,
          status: nextStatus === 'completed' ? 'complete' : 'to do',
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    const updated = subtasks.filter((s) => s.id !== subtaskId);
    setSubtasks(updated);

    if (activeTask) {
      saveTaskToApp({ ...activeTask, subtask_count: updated.length } as AgencyTask, { subtasks: updated }).then(setLocalTask).catch(() => {});
    }

    try {
      await fetch(`/api/clickup/subtasks?subtaskId=${subtaskId}`, {
        method: 'DELETE',
      });
    } catch {
      // ignore
    }
  };

  // Tag Handlers
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim()) return;
    const newTag = tagInput.trim().replace(/^#/, '');
    const currentTags = activeTask.tags || [];
    if (!currentTags.includes(newTag)) {
      const updatedTags = [...currentTags, newTag];
      const updatedTask = { ...activeTask, tags: updatedTags };
      setLocalTask(updatedTask);
      if (onTaskUpdated) onTaskUpdated(updatedTask);
      saveTaskToApp(updatedTask).then(setLocalTask).catch(() => {});
    }
    setTagInput('');
    setShowAddTagInput(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = (activeTask.tags || []).filter((t) => t !== tagToRemove);
    const updatedTask = { ...activeTask, tags: updatedTags };
    setLocalTask(updatedTask);
    if (onTaskUpdated) onTaskUpdated(updatedTask);
    saveTaskToApp(updatedTask).then(setLocalTask).catch(() => {});
  };

  // Assignee Handlers
  const handleAddAssignee = (memberId: string) => {
    const selectedMember = members.find((m) => m.id === memberId);
    if (!selectedMember) return;

    const currentNames = activeTask.assignee_names || [];
    const currentIds = activeTask.assignee_ids || [];
    const currentAvatars = activeTask.assignee_avatars || [];

    if (!currentIds.includes(memberId)) {
      const updatedTask = {
        ...activeTask,
        assignee_ids: [...currentIds, selectedMember.id],
        assignee_names: [...currentNames, selectedMember.name],
        assignee_avatars: [...currentAvatars, selectedMember.avatar],
      };
      setLocalTask(updatedTask);
      if (onTaskUpdated) onTaskUpdated(updatedTask);
      saveTaskToApp(updatedTask).then(setLocalTask).catch(() => {});

      fetch('/api/clickup/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: activeTask.clickup_task_id || activeTask.id,
          assignees: updatedTask.assignee_ids,
        }),
      }).catch(() => {});
    }
  };

  const handleRemoveAssignee = (index: number) => {
    const currentNames = [...(activeTask.assignee_names || [])];
    const currentIds = [...(activeTask.assignee_ids || [])];
    const currentAvatars = [...(activeTask.assignee_avatars || [])];

    currentNames.splice(index, 1);
    currentIds.splice(index, 1);
    currentAvatars.splice(index, 1);

    const updatedTask = {
      ...activeTask,
      assignee_ids: currentIds,
      assignee_names: currentNames,
      assignee_avatars: currentAvatars,
    };
    setLocalTask(updatedTask);
    if (onTaskUpdated) onTaskUpdated(updatedTask);
    saveTaskToApp(updatedTask).then(setLocalTask).catch(() => {});

    fetch('/api/clickup/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: activeTask.clickup_task_id || activeTask.id,
        assignees: currentIds,
      }),
    }).catch(() => {});
  };

  // Handle sending comment to app first; ClickUp sync runs in the background.
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSendingComment(true);
    const textToSend = commentText;
    setCommentText('');
    const newComment = {
      id: `c_${Date.now()}`,
      user: 'Dinur Pradipta',
      avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
      text: textToSend,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };
    const nextComments = [...comments, newComment];
    setComments(nextComments);

    try {
      const savedTask = await saveTaskToApp({ ...activeTask, comments_count: nextComments.length } as AgencyTask, { comments: nextComments, subtasks });
      setLocalTask(savedTask);

      fetch('/api/clickup/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: activeTask.clickup_task_id || activeTask.id,
          commentText: textToSend,
        }),
      }).catch(() => {});
    } catch {
      setComments(comments);
    } finally {
      setIsSendingComment(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(activeTask.clickup_url);
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
              title="Edit Task"
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
              title="Buka di ClickUp"
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
                  <label className="block text-[11px] font-bold text-[#202124] mb-1">PIC / Assignee Utama</label>
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
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-[#737680] uppercase tracking-wider flex items-center">
                <Tag className="w-3.5 h-3.5 mr-1 text-[#F26B5E]" /> Tags
              </h3>
              <button
                onClick={() => setShowAddTagInput(!showAddTagInput)}
                className="text-[11px] font-semibold text-[#24324A] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-[#F26B5E]" /> Tambah Tag
              </button>
            </div>

            {showAddTagInput && (
              <form onSubmit={handleAddTag} className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Ketik tag baru (e.g. Design)..."
                  className="flex-1 px-3 py-1.5 text-xs border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A]"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#24324A] text-white text-xs font-semibold rounded-lg hover:bg-[#1A2536] cursor-pointer"
                >
                  Tambah
                </button>
              </form>
            )}

            <div className="flex flex-wrap gap-1.5">
              {activeTask.tags && activeTask.tags.length > 0 ? (
                activeTask.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#EEF2F7] text-[#24324A] text-[11px] font-semibold rounded-md border border-[#E8E8EC]"
                  >
                    <span>#{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-[#737680] hover:text-[#D95858] cursor-pointer"
                      title="Hapus Tag"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-[#737680] italic">Belum ada tags</span>
              )}
            </div>
          </div>

          {/* Assignees / PIC ClickUp */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-[#737680] uppercase tracking-wider flex items-center">
                <User className="w-3.5 h-3.5 mr-1 text-[#24324A]" /> Assignees / PIC ClickUp
              </h3>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddAssignee(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="text-[11px] font-semibold text-[#24324A] bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg px-2 py-1 outline-none cursor-pointer"
              >
                <option value="">+ Tambah PIC...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {activeTask.assignee_names && activeTask.assignee_names.length > 0 ? (
                activeTask.assignee_names.map((name, idx) => (
                  <div key={name + idx} className="flex items-center gap-2 bg-[#F7F7F8] px-2.5 py-1 rounded-lg border border-[#E8E8EC] text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeTask.assignee_avatars?.[idx] || 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg'} alt={name} className="w-5 h-5 rounded-full object-cover" />
                    <span className="font-semibold text-[#202124]">{name}</span>
                    {activeTask.assignee_names.length > 1 && (
                      <button
                        onClick={() => handleRemoveAssignee(idx)}
                        className="text-[#737680] hover:text-[#D95858] cursor-pointer ml-1"
                        title="Hapus PIC"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-xs text-[#737680] italic">Belum ada PIC yang di-assign</span>
              )}
            </div>
          </div>

          {/* DYNAMIC SUBTASKS (CLICKUP SYNCHRONIZED) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-[#737680] uppercase tracking-wider flex items-center">
                <CheckSquare className="w-3.5 h-3.5 mr-1 text-[#4F9D78]" />
                Subtasks ({subtasks.length})
                {loadingSubtasks && <RefreshCw className="w-3 h-3 animate-spin text-[#4F9D78] ml-1.5" />}
              </h3>
            </div>

            {/* List of Subtasks */}
            <div className="space-y-1.5 text-xs">
              {subtasks.length === 0 ? (
                <div className="p-3 bg-[#F7F7F8] border border-dashed border-[#E8E8EC] rounded-lg text-center text-[#737680] text-xs">
                  Belum ada subtask. Tambahkan subtask baru di bawah untuk memecah pekerjaan ini.
                </div>
              ) : (
                subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="p-2.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg flex items-center justify-between gap-2 text-[#202124]"
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={st.status === 'completed'}
                        onChange={() => handleToggleSubtask(st.id, st.status)}
                        className="rounded border-[#E8E8EC] text-[#4F9D78] focus:ring-0 cursor-pointer"
                      />
                      <span className={st.status === 'completed' ? 'line-through text-[#737680] truncate' : 'font-medium truncate'}>
                        {st.name}
                      </span>
                    </label>
                    <button
                      onClick={() => handleDeleteSubtask(st.id)}
                      className="text-[#737680] hover:text-[#D95858] p-1 rounded hover:bg-[#EEF2F7] cursor-pointer"
                      title="Hapus Subtask"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}

              {/* Add New Subtask Form */}
              <form onSubmit={handleAddSubtask} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newSubtaskName}
                  onChange={(e) => setNewSubtaskName(e.target.value)}
                  placeholder="+ Tambah subtask baru..."
                  className="flex-1 px-3 py-2 text-xs border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
                />
                <button
                  type="submit"
                  disabled={isCreatingSubtask}
                  className="px-3.5 py-2 bg-[#24324A] text-white text-xs font-semibold rounded-lg hover:bg-[#1A2536] flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  {isCreatingSubtask ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 text-[#F26B5E]" />}
                  <span>Tambah</span>
                </button>
              </form>
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
        title="Hapus Task"
        message={`Apakah Anda yakin ingin menghapus task "${activeTask.task_name}"? Tindakan ini akan menghapus task dari aplikasi untuk semua user.`}
        confirmText="Hapus Task"
        cancelText="Batal"
        confirmVariant="danger"
        onConfirm={() => {
          setShowConfirmDelete(false);
          if (onDeleteTask) onDeleteTask(activeTask.id);
          onClose();
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>,
    document.body
  );
}
