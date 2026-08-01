'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { X, AlertCircle, CheckCircle2, Briefcase, RefreshCw } from 'lucide-react';
import { MOCK_USERS, AgencyTask } from '@/lib/mock/data';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultListId?: string;
  onTaskCreated?: (task: AgencyTask) => void;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  defaultListId,
  onTaskCreated,
}: CreateTaskModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; client_name: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      task_name: '',
      project_id: defaultListId || '',
      description: '',
      priority: 'normal',
      assignee_id: '276885530',
      due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      tags: 'Design, Urgent',
    },
  });

  // Fetch real ClickUp lists/projects
  useEffect(() => {
    if (isOpen) {
      async function fetchProjects() {
        setLoadingProjects(true);
        try {
          const res = await fetch('/api/clickup/projects');
          if (res.ok) {
            const data = await res.json();
            if (data.projects && data.projects.length > 0) {
              setProjects(data.projects);
              // Set default selection if not already set
              if (defaultListId) {
                setValue('project_id', defaultListId);
              } else if (data.projects[0]?.id) {
                setValue('project_id', data.projects[0].id);
              }
            }
          }
        } catch {
          // ignore
        } finally {
          setLoadingProjects(false);
        }
      }
      fetchProjects();
    }
  }, [isOpen, defaultListId, setValue]);

  if (!isOpen || !mounted) return null;

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const selectedProject = projects.find((p) => p.id === data.project_id);

      const res = await fetch('/api/clickup/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId: data.project_id,
          name: data.task_name,
          description: data.description,
          priority: data.priority,
          due_date: data.due_date,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(`Gagal membuat task di ClickUp: ${errData.error || res.statusText}`);
        setIsSubmitting(false);
        return;
      }

      const resData = await res.json();
      const createdTask: AgencyTask = resData.task || {
        id: `tsk-${Date.now()}`,
        clickup_task_id: resData.raw?.id || `cu-${Date.now()}`,
        project_id: data.project_id,
        project_name: selectedProject?.name || 'ClickUp Project',
        task_name: data.task_name,
        description: data.description,
        status: 'to_do',
        priority: data.priority,
        assignee_ids: ['276885530'],
        assignee_names: ['Dinur Pradipta'],
        assignee_avatars: ['https://attachments.clickup.com/profilePictures/276885530_r2L.jpg'],
        start_date: new Date().toISOString(),
        due_date: new Date(data.due_date).toISOString(),
        tags: data.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        custom_fields: [],
        time_estimate_hours: 8,
        time_tracked_hours: 0,
        subtask_count: 0,
        comments_count: 0,
        clickup_url: 'https://app.clickup.com',
        clickup_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      if (onTaskCreated) {
        onTaskCreated(createdTask);
      }

      setSuccessToast(true);
      setTimeout(() => {
        setSuccessToast(false);
        reset();
        onClose();
      }, 1000);
    } catch {
      alert('Terjadi kesalahan jaringan saat membuat task di ClickUp');
    } finally {
      setIsSubmitting(false);
    }
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
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#EEF2F7] text-[#737680] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert */}
        {successToast && (
          <div className="m-4 p-3 bg-[#EEF2F7] border border-[#4F9D78] text-[#4F9D78] text-sm rounded-lg flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Task berhasil dibuat dan disinkronkan langsung ke ClickUp Workspace!
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
              <label className="block text-xs font-semibold text-[#202124] mb-1">
                Project & List ClickUp * {loadingProjects && <RefreshCw className="w-3 h-3 inline animate-spin text-[#F26B5E] ml-1" />}
              </label>
              <select
                {...register('project_id', { required: 'Pilih project / list ClickUp' })}
                className="w-full px-3 py-2 text-sm border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
              >
                {projects.length === 0 ? (
                  <option value={defaultListId || ''}>{loadingProjects ? 'Memuat project ClickUp...' : 'Tidak ada project ClickUp'}</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.client_name || 'ClickUp Space'})
                    </option>
                  ))
                )}
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
              className="px-4 py-2 text-xs font-medium text-[#737680] hover:bg-[#F7F7F8] rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#24324A] hover:bg-[#1A2536] rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Menyimpan ke ClickUp...' : 'Simpan & Sync Task'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
