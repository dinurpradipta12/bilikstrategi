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
  AlertTriangle,
  Send,
  CornerDownRight,
  Trash2,
} from 'lucide-react';
import { AgencyTask, MOCK_USERS, MOCK_ACTIVITY_LOGS } from '@/lib/mock/data';

import ConfirmModal from '@/components/ui/ConfirmModal';

interface TaskDetailDrawerProps {
  task: AgencyTask | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (taskId: string, newStatus: AgencyTask['status']) => void;
  onPriorityChange?: (taskId: string, newPriority: AgencyTask['priority']) => void;
  onDeleteTask?: (taskId: string) => void;
}

export default function TaskDetailDrawer({
  task,
  isOpen,
  onClose,
  onStatusChange,
  onPriorityChange,
  onDeleteTask,
}: TaskDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Array<{ id: string; user: string; text: string; time: string }>>([
    { id: 'c1', user: 'Clara Bella', text: 'Render 3D KV sudah disesuaikan dengan lighting warm tone.', time: '10:15' },
    { id: 'c2', user: 'Dimas Pratama', text: 'Tolong persiapkan versi kompresi untuk preview di WhatsApp.', time: '10:45' },
  ]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !task || !mounted) return null;

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const newComment = {
      id: `c_${Date.now()}`,
      user: MOCK_USERS[0].full_name,
      text: commentText,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setComments([...comments, newComment]);
    setCommentText('');
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(task.clickup_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-35 flex justify-end bg-black/50 backdrop-blur-xs">
      {/* Backdrop overlay click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-[#FFFFFF] h-full shadow-2xl flex flex-col border-l border-[#E8E8EC] z-10 animate-slide-left">
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#E8E8EC] bg-[#F7F7F8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-[#EEF2F7] text-[#24324A] rounded">
              {task.clickup_task_id}
            </span>
            <span className="text-xs text-[#737680]">{task.project_name}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyUrl}
              className="p-1.5 rounded-lg border border-[#E8E8EC] text-[#737680] hover:text-[#202124] hover:bg-[#FFFFFF] text-xs flex items-center gap-1"
              title="Salin URL Task"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Tersalin!' : 'Copy Link'}</span>
            </button>

            <a
              href={task.clickup_url}
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

            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#E8E8EC] text-[#737680] ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div>
            <h2 className="text-xl font-extrabold text-[#24324A] leading-snug">{task.task_name}</h2>
            <p className="text-xs text-[#737680] mt-2 leading-relaxed bg-[#F7F7F8] p-3 rounded-lg border border-[#E8E8EC]">
              {task.description || 'Tidak ada deskripsi detail tambahan.'}
            </p>
          </div>

          {/* Controls Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-xs">
            <div>
              <span className="text-[#737680] block text-[10px] uppercase font-bold">Status</span>
              <select
                value={task.status}
                onChange={(e) => onStatusChange && onStatusChange(task.id, e.target.value as any)}
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
                value={task.priority}
                onChange={(e) => onPriorityChange && onPriorityChange(task.id, e.target.value as any)}
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
                {new Date(task.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
              </span>
            </div>

            <div>
              <span className="text-[#737680] block text-[10px] uppercase font-bold">Time Tracked</span>
              <span className="mt-1 font-semibold text-[#4F9D78] block">
                {task.time_tracked_hours} jam / {task.time_estimate_hours}h est
              </span>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-xs font-bold text-[#737680] uppercase tracking-wider mb-2 flex items-center">
              <Tag className="w-3.5 h-3.5 mr-1 text-[#F26B5E]" /> Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-[#EEF2F7] text-[#24324A] text-[11px] font-semibold rounded-md border border-[#E8E8EC]">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Assignees */}
          <div>
            <h3 className="text-xs font-bold text-[#737680] uppercase tracking-wider mb-2 flex items-center">
              <User className="w-3.5 h-3.5 mr-1 text-[#24324A]" /> Assignees
            </h3>
            <div className="flex items-center gap-2">
              {task.assignee_names.map((name, idx) => (
                <div key={name} className="flex items-center gap-1.5 bg-[#F7F7F8] px-2.5 py-1 rounded-lg border border-[#E8E8EC] text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={task.assignee_avatars[idx]} alt={name} className="w-5 h-5 rounded-full object-cover" />
                  <span className="font-semibold text-[#202124]">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <h3 className="text-xs font-bold text-[#737680] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center">
                <CheckSquare className="w-3.5 h-3.5 mr-1 text-[#4F9D78]" /> Subtasks ({task.subtask_count})
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
            <h3 className="text-xs font-bold text-[#24324A] flex items-center">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-[#F26B5E]" />
              Komentar Task & Synchronized ClickUp Chat ({comments.length})
            </h3>

            {/* Existing Comments List */}
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="p-3 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#24324A]">{c.user}</span>
                    <span className="text-[10px] text-[#737680]">{c.time}</span>
                  </div>
                  <p className="text-[#202124]">{c.text}</p>
                </div>
              ))}
            </div>

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
                className="px-4 py-2 bg-[#24324A] text-white text-xs font-semibold rounded-xl hover:bg-[#1A2536] flex items-center gap-1 shadow-2xs"
              >
                <Send className="w-3.5 h-3.5 text-[#F26B5E]" />
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
