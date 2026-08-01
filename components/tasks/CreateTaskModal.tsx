'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { X, Calendar, Tag, AlertCircle, CheckCircle2, UserCheck, Briefcase } from 'lucide-react';
import { MOCK_PROJECTS, MOCK_USERS, MOCK_TASKS, AgencyTask } from '@/lib/mock/data';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: (task: AgencyTask) => void;
}

export default function CreateTaskModal({ isOpen, onClose, onTaskCreated }: CreateTaskModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      task_name: '',
      project_id: MOCK_PROJECTS[0]?.id || '',
      description: '',
      priority: 'normal',
      assignee_id: MOCK_USERS[2]?.id || '',
      due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      tags: 'Design, Urgent',
    },
  });

  if (!isOpen || !mounted) return null;

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const selectedProject = MOCK_PROJECTS.find((p) => p.id === data.project_id) || MOCK_PROJECTS[0];
    const selectedUser = MOCK_USERS.find((u) => u.id === data.assignee_id) || MOCK_USERS[2];

    const newTask: AgencyTask = {
      id: `tsk-${Date.now()}`,
      clickup_task_id: `cu-${Math.floor(100000 + Math.random() * 900000)}`,
      project_id: selectedProject.id,
      project_name: selectedProject.name,
      task_name: data.task_name,
      description: data.description,
      status: 'to_do',
      priority: data.priority,
      assignee_ids: [selectedUser.id],
      assignee_names: [selectedUser.full_name],
      assignee_avatars: [selectedUser.avatar_url],
      start_date: new Date().toISOString(),
      due_date: new Date(data.due_date).toISOString(),
      tags: data.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      custom_fields: [{ name: 'Source', value: 'Bilik Workspace App' }],
      time_estimate_hours: 8,
      time_tracked_hours: 0,
      subtask_count: 0,
      comments_count: 0,
      clickup_url: 'https://app.clickup.com',
      clickup_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    MOCK_TASKS.unshift(newTask);

    if (onTaskCreated) {
      onTaskCreated(newTask);
    }

    setIsSubmitting(false);
    setSuccessToast(true);
    setTimeout(() => {
      setSuccessToast(false);
      reset();
      onClose();
    }, 1000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-xl bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xl overflow-hidden relative z-[101]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8EC] bg-[#F7F7F8]">
          <h2 className="text-base font-semibold text-[#24324A] flex items-center">
            <Briefcase className="w-4 h-4 text-[#F26B5E] mr-2" />
            Buat Task ClickUp Baru
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#EEF2F7] text-[#737680]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert */}
        {successToast && (
          <div className="m-4 p-3 bg-[#EEF2F7] border border-[#4F9D78] text-[#4F9D78] text-sm rounded-lg flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Task berhasil dibuat dan disinkronkan ke ClickUp!
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#202124] mb-1">Nama Task *</label>
            <input
              type="text"
              {...register('task_name', { required: 'Nama task tidak boleh kosong' })}
              placeholder="Contoh: Desain Visual Banner Campaign Q3"
              className="w-full px-3 py-2 text-sm border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
            />
            {errors.task_name && (
              <p className="mt-1 text-xs text-[#D95858] flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                {errors.task_name.message as string}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#202124] mb-1">Project & List *</label>
              <select
                {...register('project_id')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
              >
                {MOCK_PROJECTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.client_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202124] mb-1">PIC / Assignee</label>
              <select
                {...register('assignee_id')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
              >
                {MOCK_USERS.filter((u) => u.role !== 'client').map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#202124] mb-1">Priority</label>
              <select
                {...register('priority')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
              >
                <option value="urgent">Urgent 🔴</option>
                <option value="high">High 🟠</option>
                <option value="normal">Normal 🔵</option>
                <option value="low">Low ⚪</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202124] mb-1">Due Date</label>
              <input
                type="date"
                {...register('due_date')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202124] mb-1">Tags (pisahkan koma)</label>
            <input
              type="text"
              {...register('tags')}
              placeholder="Design, Urgent, Social Media"
              className="w-full px-3 py-2 text-sm border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202124] mb-1">Deskripsi & Brief</label>
            <textarea
              rows={3}
              {...register('description')}
              placeholder="Tuliskan catatan brief singkat atau spesifikasi task..."
              className="w-full px-3 py-2 text-sm border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E8EC]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#737680] hover:bg-[#F7F7F8] rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#24324A] hover:bg-[#1A2536] rounded-lg transition-colors shadow-xs"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan & Sync Task'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
