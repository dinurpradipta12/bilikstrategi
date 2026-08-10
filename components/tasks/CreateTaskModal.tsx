'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { X, AlertCircle, CheckCircle2, Briefcase, RefreshCw } from 'lucide-react';
import { AgencyTask } from '@/lib/mock/data';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultListId?: string;
  onTaskCreated?: (task: AgencyTask) => void;
}

interface ClickUpMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

interface ProjectOption {
  id: string;
  name: string;
  client_name?: string;
  clickup_list_id?: string;
  source: 'app' | 'clickup';
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
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [members, setMembers] = useState<ClickUpMember[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

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
      assignee_id: '',
      due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      tags: '',
    },
  });

  // Fetch app projects first, then merge ClickUp lists when available.
  useEffect(() => {
    if (isOpen) {
      async function fetchProjects() {
        setLoadingProjects(true);
        try {
          const [appRes, clickupRes] = await Promise.all([
            fetch('/api/supabase/projects', { cache: 'no-store' }).catch(() => null),
            fetch('/api/clickup/projects', { cache: 'no-store' }).catch(() => null),
          ]);

          const projectMap = new Map<string, ProjectOption>();

          if (appRes?.ok) {
            const data = await appRes.json();
            const appProjects = Array.isArray(data.projects) ? data.projects : [];
            appProjects.forEach((p: any) => {
              const id = String(p.id || p.clickup_list_id || '');
              if (!id) return;
              projectMap.set(id, {
                id,
                name: p.name || 'Project Aplikasi',
                client_name: p.client_name || p.status || 'Aplikasi',
                clickup_list_id: p.clickup_list_id ? String(p.clickup_list_id) : undefined,
                source: 'app',
              });
            });
          }

          if (clickupRes?.ok) {
            const data = await clickupRes.json();
            const clickupProjects = Array.isArray(data.projects) ? data.projects : [];
            clickupProjects.forEach((p: any) => {
              const id = String(p.clickup_list_id || p.id || '');
              if (!id || projectMap.has(id)) return;
              projectMap.set(id, {
                id,
                name: p.name || 'Project ClickUp',
                client_name: p.client_name || 'ClickUp',
                clickup_list_id: id,
                source: 'clickup',
              });
            });
          }

          const mergedProjects = Array.from(projectMap.values());
          setProjects(mergedProjects);

          if (defaultListId) {
            setValue('project_id', defaultListId);
          } else if (mergedProjects[0]?.id) {
            setValue('project_id', mergedProjects[0].id);
          }

          if (mergedProjects.length === 0) {
            const cachedProjectsRaw = localStorage.getItem('bilik_agency_projects_db');
            if (cachedProjectsRaw) {
              try {
                const cachedProjects = JSON.parse(cachedProjectsRaw);
                if (Array.isArray(cachedProjects)) {
                  const cachedOptions: ProjectOption[] = cachedProjects
                    .map((p: any) => ({
                      id: String(p.id || p.clickup_list_id || ''),
                      name: p.name || 'Project Aplikasi',
                      client_name: p.client_name || p.status || 'Aplikasi',
                      clickup_list_id: p.clickup_list_id ? String(p.clickup_list_id) : undefined,
                      source: 'app' as const,
                    }))
                    .filter((p) => p.id);
                  setProjects(cachedOptions);
                  if (defaultListId) {
                    setValue('project_id', defaultListId);
                  } else if (cachedOptions[0]?.id) {
                    setValue('project_id', cachedOptions[0].id);
                  }
                }
              } catch {
                // ignore malformed cache
              }
            }
          }
        } catch {
          // ignore
        } finally {
          setLoadingProjects(false);
        }
      }

      async function fetchMembers() {
        setLoadingMembers(true);
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
              if (formatted[0]?.id) {
                setValue('assignee_id', formatted[0].id);
              }
            }
          }
        } catch {
          // ignore
        } finally {
          setLoadingMembers(false);
        }
      }

      fetchProjects();
      fetchMembers();
    }
  }, [isOpen, defaultListId, setValue]);

  if (!isOpen || !mounted) return null;

  const onSubmit = async (data: any) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const selectedProject = projects.find((p) => p.id === data.project_id);
      const selectedMember = members.find((m) => m.id === String(data.assignee_id));
      const now = new Date().toISOString();
      const localId = `app-${crypto.randomUUID()}`;
      const createdTask: AgencyTask = {
        id: localId,
        clickup_task_id: localId,
        project_id: data.project_id,
        project_name: selectedProject?.name || 'Project Aplikasi',
        task_name: data.task_name,
        description: data.description,
        status: 'to_do',
        priority: data.priority,
        assignee_ids: selectedMember ? [selectedMember.id] : [],
        assignee_names: selectedMember ? [selectedMember.name] : [],
        assignee_avatars: selectedMember ? [selectedMember.avatar] : [],
        assignee_emails: selectedMember?.email ? [selectedMember.email] : [],
        start_date: now,
        due_date: new Date(data.due_date).toISOString(),
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        custom_fields: [],
        time_estimate_hours: 8,
        time_tracked_hours: 0,
        parent_id: null,
        subtask_count: 0,
        comments_count: 0,
        clickup_url: '',
        clickup_updated_at: now,
        created_at: now,
      };

      const appRes = await fetch('/api/supabase/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createdTask),
      });

      if (!appRes.ok) {
        const errData = await appRes.json().catch(() => ({}));
        alert(`Gagal membuat task di aplikasi: ${errData.error || appRes.statusText}`);
        setIsSubmitting(false);
        return;
      }

      const appData = await appRes.json();
      const savedTask: AgencyTask = appData.task || createdTask;

      if (onTaskCreated) {
        onTaskCreated(savedTask);
      }

      // ClickUp is deliberately background-only. The app task above remains
      // the single visible record while its ClickUp id is attached in place.
      void (async () => {
        try {
          const clickupRes = await fetch('/api/clickup/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              listId: selectedProject?.clickup_list_id || data.project_id,
              name: data.task_name,
              description: data.description,
              priority: data.priority,
              assignees: data.assignee_id ? [data.assignee_id] : undefined,
              due_date: data.due_date,
              notification_silent: true,
            }),
          });
          if (!clickupRes.ok) return;

          const resData = await clickupRes.json();
          if (!resData?.task?.id) return;

          const appUpdateRes = await fetch('/api/supabase/tasks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...savedTask,
              ...resData.task,
              id: savedTask.id,
              clickup_task_id: resData.task.clickup_task_id || resData.task.id,
              project_id: data.project_id,
              project_name: selectedProject?.name || savedTask.project_name,
              notification_silent: true,
            }),
          });

          if (appUpdateRes.ok && onTaskCreated) {
            const appUpdateData = await appUpdateRes.json();
            if (appUpdateData?.task) onTaskCreated(appUpdateData.task);
          }
        } catch {
          // The app record remains usable when ClickUp is unavailable.
        }
      })();

      setSuccessToast(true);
      setTimeout(() => {
        setSuccessToast(false);
        reset();
        onClose();
      }, 1000);
    } catch {
      alert('Terjadi kesalahan jaringan saat membuat task di aplikasi');
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
            Buat Task Baru
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#EEF2F7] text-[#737680] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert */}
        {successToast && (
          <div className="m-4 p-3 bg-[#EEF2F7] border border-[#4F9D78] text-[#4F9D78] text-sm rounded-lg flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Task berhasil dibuat.
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
                Project * {loadingProjects && <RefreshCw className="w-3 h-3 inline animate-spin text-[#F26B5E] ml-1" />}
              </label>
              <select
                {...register('project_id', { required: 'Pilih project' })}
                className="w-full px-3 py-2 text-sm border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
              >
                {projects.length === 0 ? (
                  <option value={defaultListId || ''}>{loadingProjects ? 'Memuat project aplikasi...' : 'Tidak ada project aplikasi'}</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.client_name || (p.source === 'app' ? 'Aplikasi' : 'ClickUp')})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202124] mb-1">
                PIC / Assignee ClickUp * {loadingMembers && <RefreshCw className="w-3 h-3 inline animate-spin text-[#F26B5E] ml-1" />}
              </label>
              <select
                {...register('assignee_id')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A] bg-[#FFFFFF]"
              >
                {members.length === 0 ? (
                  <option value="">Tidak ada assignee ClickUp</option>
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
              {isSubmitting ? 'Menyimpan ke aplikasi...' : 'Simpan Task'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
