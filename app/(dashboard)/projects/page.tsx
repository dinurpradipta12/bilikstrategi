'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Briefcase,
  LayoutList,
  Kanban,
  GanttChartSquare,
  CalendarDays,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Users,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { RefreshCw, X, Trash2 } from 'lucide-react';
import { AgencyProject } from '@/lib/mock/data';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  mergeAppProjectWithClickUp,
  projectsRepresentSameEntity,
  uniqueProjectsByReference,
} from '@/lib/projects/dedupe';
import ProjectDetailClient from '@/components/projects/ProjectDetailClient';

type ViewMode = 'list' | 'board' | 'timeline' | 'calendar';

const PROJECT_STATUSES = new Set(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']);

function projectText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function projectNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function projectDetailHref(projectId: string) {
  return `/projects?projectId=${encodeURIComponent(projectId)}`;
}

function normalizeAppProject(value: any): AgencyProject {
  const projectId = projectText(value?.id || value?.clickup_list_id, `project-${Date.now()}`);
  const statusValue = projectText(value?.status, 'planning');
  const today = new Date().toISOString().split('T')[0];
  const defaultDueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  return {
    id: projectId,
    name: projectText(value?.name, 'Project'),
    description: projectText(value?.description || value?.content, ''),
    client_id: projectText(value?.client_id, 'c1'),
    client_name: projectText(value?.client_name || value?.client?.company_name, 'Bilik Strategi Workspace'),
    status: PROJECT_STATUSES.has(statusValue) ? statusValue as AgencyProject['status'] : 'planning',
    clickup_space_id: projectText(value?.clickup_space_id, ''),
    clickup_folder_id: projectText(value?.clickup_folder_id, ''),
    clickup_list_id: projectText(value?.clickup_list_id || value?.list_id, projectId),
    team_lead_id: projectText(value?.team_lead_id, 'u1'),
    team_lead_name: projectText(value?.team_lead_name, 'Dinur Pradipta'),
    member_ids: Array.isArray(value?.member_ids) ? value.member_ids.map((id: unknown) => projectText(id)) : [],
    start_date: projectText(value?.start_date, today),
    due_date: projectText(value?.due_date, defaultDueDate),
    total_tasks: Math.max(0, projectNumber(value?.total_tasks ?? value?.task_count)),
    completed_tasks: Math.max(0, projectNumber(value?.completed_tasks)),
    overdue_tasks: Math.max(0, projectNumber(value?.overdue_tasks)),
    progress_percentage: Math.min(100, Math.max(0, projectNumber(value?.progress_percentage ?? value?.progress))),
  };
}

function ProjectsListPage() {
  const [projects, setProjects] = useState<AgencyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Delete confirm modal state
  const [deleteTargetProject, setDeleteTargetProject] = useState<{ id: string; name: string } | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newClientName, setNewClientName] = useState('Bilik Strategi Workspace');
  const [newStatus, setNewStatus] = useState('in_progress');
  const [newTeamLeadName, setNewTeamLeadName] = useState('Dinur Pradipta');
  const [newStartDate, setNewStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newDueDate, setNewDueDate] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch('/api/supabase/clients')
      .then((r) => r.json())
      .then((data) => {
        if (data.clients && Array.isArray(data.clients)) {
          setClientsList(data.clients);
        }
      })
      .catch(() => {});
  }, []);

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return dateStr || '-';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // 1. Fetch Projects (combining Supabase DB, Shared Server Store, and ClickUp)
  const fetchProjects = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    const appProjects: AgencyProject[] = [];
    let clickupProjects: AgencyProject[] = [];
    const deletedIdsRaw = typeof window !== 'undefined' ? localStorage.getItem('bilik_deleted_project_ids') : null;
    const deletedIds: string[] = deletedIdsRaw ? JSON.parse(deletedIdsRaw) : [];

    // The application database is canonical. ClickUp is only used to enrich
    // matching projects with task/progress data in the background.
    try {
      const apiRes = await fetch('/api/supabase/projects', { cache: 'no-store' });
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (Array.isArray(apiData.projects)) {
          appProjects.push(...apiData.projects.map(normalizeAppProject));
        }
      }
    } catch {}

    // Direct Supabase fallback is only added when the API store did not return
    // the same application project.
    try {
      const { data: dbData } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbData && dbData.length > 0) {
        dbData.forEach((dp: any) => {
          const normalizedProject = normalizeAppProject(dp);
          if (!appProjects.some((project) => project.id === normalizedProject.id)) appProjects.push(normalizedProject);
        });
      }
    } catch {}

    // ClickUp lists are kept as fallback records only when no application
    // project represents the same list/name.
    try {
      const cuRes = await fetch('/api/clickup/projects');
      if (cuRes.ok) {
        const cuData = await cuRes.json();
        clickupProjects = Array.isArray(cuData.projects) ? cuData.projects.map(normalizeAppProject) : [];
      }
    } catch {}

    const canonicalAppProjects = uniqueProjectsByReference(appProjects);
    const canonicalClickUpProjects = uniqueProjectsByReference(clickupProjects);
    const matchedClickUpIds = new Set<string>();
    const mergedProjects = canonicalAppProjects.map((appProject) => {
      const clickupProject = canonicalClickUpProjects.find((candidate) => projectsRepresentSameEntity(appProject, candidate));
      if (!clickupProject) return appProject;

      matchedClickUpIds.add(projectText(clickupProject.id || clickupProject.clickup_list_id));
      return mergeAppProjectWithClickUp(appProject, clickupProject);
    });

    const clickupOnlyProjects = canonicalClickUpProjects.filter(
      (clickupProject) => !matchedClickUpIds.has(projectText(clickupProject.id || clickupProject.clickup_list_id)),
    );
    const cleanProjects = [...mergedProjects, ...clickupOnlyProjects].filter((project) => !deletedIds.includes(project.id));
    setProjects(cleanProjects);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bilik_agency_projects_db', JSON.stringify(cleanProjects));
    }
    if (!isSilent) setLoading(false);
  };

  useEffect(() => {
    fetchProjects(false);

    // Silent background interval (15s)
    const interval = setInterval(() => {
      fetchProjects(true);
    }, 15000);

    // BroadcastChannel: Silent background sync
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('bilik_projects_channel');
        bc.onmessage = () => {
          fetchProjects(true);
        };
      } catch {}
    }

    if (!isSupabaseConfigured) {
      return () => {
        clearInterval(interval);
        if (bc) bc.close();
      };
    }

    // Supabase Realtime Channel: Silent background sync
    const channel = supabase
      .channel('realtime_projects_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          fetchProjects(true);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
  }, []);

  // Create Project: App First Realtime (never fails on ClickUp auth)
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setSubmitting(true);

    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'b0eebc99-9c0b-4ef8-bb6d-' + Date.now().toString(16).padStart(12, '0');
    };

    const newId = generateUUID();
    const newProjectObj: AgencyProject = {
      id: newId,
      name: newProjectName.trim(),
      client_id: 'c1',
      client_name: newClientName.trim() || 'Bilik Strategi Workspace',
      clickup_space_id: '',
      clickup_folder_id: '',
      clickup_list_id: newId,
      team_lead_id: 'u1',
      team_lead_name: newTeamLeadName.trim() || 'Dinur Pradipta',
      member_ids: [],
      status: newStatus as any,
      progress_percentage: 0,
      total_tasks: 0,
      completed_tasks: 0,
      overdue_tasks: 0,
      start_date: newStartDate || new Date().toISOString().split('T')[0],
      due_date: newDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      description: newProjectDesc.trim() || 'Project Baru Bilik Strategi',
    };

    // 1. Immediately save to Shared Server Store & DB API
    try {
      await fetch('/api/supabase/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProjectObj),
      });
    } catch (err) {
      console.warn('[ProjectsPage] Could not save project to server store:', err);
    }

    // 2. Fire-and-forget ClickUp sync in background (never blocks the app).
    // Persist the returned ClickUp list ID so later refreshes merge both records.
    fetch('/api/clickup/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProjectName, content: newProjectDesc, due_date: newDueDate }),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json().catch(() => null);
        const clickupListId = result?.id || result?.list_id || result?.list?.id;
        if (!clickupListId) return;

        const normalizedClickUpListId = String(clickupListId);
        setProjects((current) => {
          const next = current.map((project) => project.id === newId ? { ...project, clickup_list_id: normalizedClickUpListId } : project);
          if (typeof window !== 'undefined') localStorage.setItem('bilik_agency_projects_db', JSON.stringify(next));
          return next;
        });

        await fetch('/api/supabase/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', id: newId, clickup_list_id: normalizedClickUpListId, notification_silent: true }),
        });
      })
      .catch(() => {});

    // 3. Update local state & storage
    const updated = [newProjectObj, ...projects.filter((p) => p.id !== newId)];
    setProjects(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bilik_agency_projects_db', JSON.stringify(updated));

      if ('BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('bilik_projects_channel');
          bc.postMessage({ type: 'PROJECTS_UPDATED' });
          bc.close();
        } catch {}
      }
    }

    setNewProjectName('');
    setNewProjectDesc('');
    setIsModalOpen(false);
    setSubmitting(false);
  };

  // Permanently delete project from UI & persist in localStorage
  const handleDeleteProject = async (listId: string, projectName: string) => {
    const updated = projects.filter((p) => p.id !== listId && p.clickup_list_id !== listId);
    setProjects(updated);

    try {
      const deletedIdsRaw = localStorage.getItem('bilik_deleted_project_ids');
      const deletedIds: string[] = deletedIdsRaw ? JSON.parse(deletedIdsRaw) : [];
      if (!deletedIds.includes(listId)) {
        deletedIds.push(listId);
        localStorage.setItem('bilik_deleted_project_ids', JSON.stringify(deletedIds));
      }
      localStorage.setItem('bilik_agency_projects_db', JSON.stringify(updated));

      await fetch('/api/supabase/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: listId }),
      });
    } catch {
      // ignore storage error
    }

    // Broadcast
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('bilik_projects_channel');
        bc.postMessage({ type: 'PROJECTS_UPDATED' });
        bc.close();
      } catch {}
    }

    // 3. Try deleting from ClickUp API in background
    try {
      await fetch(`/api/clickup/projects?listId=${encodeURIComponent(listId)}`, {
        method: 'DELETE',
      });
    } catch {
      // ignore network error
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.client_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Project Management</h1>
          <p className="text-xs text-[#737680] mt-1">
            Kelola seluruh project agency, progress deliverable, dan hubungan Folder/List ClickUp.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#24324A] hover:bg-[#1a2536] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Project Baru</span>
          </button>

          <button
            onClick={() => fetchProjects(false)}
            className="p-2 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl text-xs font-semibold text-[#24324A] hover:bg-[#EEF2F7] transition-colors"
            title="Sync Data ClickUp"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#F26B5E] ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#FFFFFF] border border-[#E8E8EC] p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'list' ? 'bg-[#EEF2F7] text-[#24324A]' : 'text-[#737680] hover:text-[#202124]'
              }`}
              title="List View"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'board' ? 'bg-[#EEF2F7] text-[#24324A]' : 'text-[#737680] hover:text-[#202124]'
              }`}
              title="Board View"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'timeline' ? 'bg-[#EEF2F7] text-[#24324A]' : 'text-[#737680] hover:text-[#202124]'
              }`}
              title="Timeline View"
            >
              <GanttChartSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Timeline</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'calendar' ? 'bg-[#EEF2F7] text-[#24324A]' : 'text-[#737680] hover:text-[#202124]'
              }`}
              title="Calendar View"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FFFFFF] p-4 border border-[#E8E8EC] rounded-xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#737680] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari project atau client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A]"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold border border-[#E8E8EC] rounded-lg bg-[#FFFFFF] text-[#24324A] focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="in_progress">In Progress</option>
            <option value="planning">Planning</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* EMPTY STATE */}
      {filteredProjects.length === 0 && !loading && (
        <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl p-12 text-center space-y-3 shadow-2xs">
          <Briefcase className="w-10 h-10 text-[#737680] mx-auto opacity-40" />
          <h3 className="text-sm font-extrabold text-[#24324A]">Belum Ada Project di ClickUp</h3>
          <p className="text-xs text-[#737680] max-w-sm mx-auto">
            Tidak ada project atau list yang ditemukan. Klik tombol <span className="font-semibold text-[#24324A]">+ Project Baru</span> untuk membuat project baru di ClickUp Workspace.
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
                  <th className="py-3 px-4">Nama Project</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Team Lead</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4 text-center">Tasks</th>
                  <th className="py-3 px-4 text-right">ClickUp Ref</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8EC]">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-[#F7F7F8] transition-colors group">
                    <td className="py-3.5 px-4 font-semibold text-[#24324A]">
                      <a href={projectDetailHref(project.id)} className="hover:text-[#F26B5E] flex items-center gap-1.5 cursor-pointer">
                        {project.name}
                        <ChevronRight className="w-3.5 h-3.5 text-[#737680] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <span className="text-[11px] font-normal text-[#737680] block truncate max-w-xs">{project.description}</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#202124] font-medium">{project.client_name || 'Bilik Strategi Workspace'}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                        project.status === 'in_progress' ? 'bg-[#EEF2F7] text-[#24324A]' :
                        project.status === 'completed' ? 'bg-[#EEF2F7] text-[#4F9D78]' :
                        project.status === 'planning' ? 'bg-[#FEF3D6] text-[#E6A23C]' : 'bg-[#FFF0ED] text-[#D95858]'
                      }`}>
                        {project.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 w-36">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-[#EEF2F7] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#4F9D78] h-full rounded-full" style={{ width: `${project.progress_percentage}%` }}></div>
                        </div>
                        <span className="text-[11px] font-bold text-[#202124]">{project.progress_percentage}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#202124] font-medium">{project.team_lead_name || 'Dinur Pradipta'}</td>
                    <td className="py-3.5 px-4 text-[#737680]">
                      {formatDateDisplay(project.due_date)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium">
                      <span className="text-[#4F9D78] font-bold">{project.completed_tasks}</span>/{project.total_tasks}
                      {project.overdue_tasks > 0 && (
                        <span className="ml-1 text-[10px] text-[#D95858] font-bold">({project.overdue_tasks} overdue)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2 py-0.5 text-[10px] font-mono bg-[#F7F7F8] border border-[#E8E8EC] rounded text-[#737680]">
                        {project.clickup_list_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setDeleteTargetProject({ id: project.id, name: project.name })}
                        className="p-1.5 text-[#737680] hover:text-[#D95858] hover:bg-[#FFF0ED] rounded-lg transition-colors cursor-pointer"
                        title="Hapus Project dari ClickUp"
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

      {/* BOARD / KANBAN VIEW */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['planning', 'in_progress', 'completed'].map((status) => {
            const projectsInStatus = filteredProjects.filter((p) => p.status === status);
            return (
              <div key={status} className="bg-[#F7F7F8] border border-[#E8E8EC] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#E8E8EC]">
                  <h3 className="text-xs font-bold text-[#24324A] uppercase tracking-wider">
                    {status.replace('_', ' ')} ({projectsInStatus.length})
                  </h3>
                </div>

                <div className="space-y-3">
                  {projectsInStatus.map((p) => (
                    <a
                      key={p.id}
                      href={projectDetailHref(p.id)}
                      className="block p-4 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl hover:border-[#24324A] transition-all shadow-2xs group cursor-pointer"
                    >
                      <span className="text-[10px] font-bold text-[#F26B5E] uppercase tracking-wider block">{p.client_name || 'Bilik Strategi Workspace'}</span>
                      <h4 className="text-sm font-bold text-[#24324A] mt-1 group-hover:text-[#F26B5E] transition-colors">{p.name}</h4>
                      <p className="text-xs text-[#737680] mt-1 line-clamp-2">{p.description}</p>

                      <div className="mt-4 pt-3 border-t border-[#E8E8EC] flex items-center justify-between text-xs text-[#737680]">
                        <span>Due: {formatDateDisplay(p.due_date)}</span>
                        <span className="font-bold text-[#4F9D78]">{p.progress_percentage}% Done</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TIMELINE / GANTT VIEW PREVIEW */}
      {viewMode === 'timeline' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#24324A]">Gantt Timeline Project Agency</h3>
          <div className="space-y-4">
            {filteredProjects.map((p) => (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#24324A]">{p.name}</span>
                  <span className="text-[#737680]">{p.start_date} s/d {formatDateDisplay(p.due_date)}</span>
                </div>
                <div className="w-full bg-[#EEF2F7] h-4 rounded-lg overflow-hidden relative">
                  <div
                    className="bg-[#24324A] h-full rounded-lg text-[9px] font-bold text-white flex items-center px-2"
                    style={{ width: `${Math.max(20, p.progress_percentage)}%` }}
                  >
                    {p.progress_percentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CALENDAR VIEW PREVIEW */}
      {viewMode === 'calendar' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs text-center py-12">
          <CalendarDays className="w-8 h-8 text-[#24324A] mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#24324A]">Jadwal Calendar Deliverable</h3>
          <p className="text-xs text-[#737680] mt-1 max-w-sm mx-auto">
            Semua due date project ini disinkronkan secara otomatis dengan ClickUp List & Calendar View.
          </p>
        </div>
      )}

      {/* Modal Tambah Project Baru */}
      {isModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 relative z-[101] my-8">
            <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#24324A]">Buat Project Baru</h3>
                <p className="text-[11px] text-[#737680]">Lengkapi detail project untuk membuat List di ClickUp & Supabase DB</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#737680] hover:text-[#24324A] p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#24324A] mb-1">Nama Project / List *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rebranding Campaign 2026"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#24324A] mb-1">Klien / Partner Agency *</label>
                  <select
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A] bg-white"
                  >
                    <option value="Bilik Strategi Workspace">Bilik Strategi Workspace (Internal)</option>
                    {clientsList.map((c) => (
                      <option key={c.id || c.company_name} value={c.company_name || c.name}>
                        {c.company_name || c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#24324A] mb-1">Status Initial Project</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A] bg-white font-semibold"
                  >
                    <option value="in_progress">🚀 In Progress (Sedang Berjalan)</option>
                    <option value="planning">📝 Planning (Perencanaan)</option>
                    <option value="on_hold">⏸️ On Hold (Tertunda)</option>
                    <option value="completed">✅ Completed (Selesai)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#24324A] mb-1">Team Lead PIC *</label>
                  <select
                    value={newTeamLeadName}
                    onChange={(e) => setNewTeamLeadName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A] bg-white font-semibold"
                  >
                    <option value="Dinur Pradipta">Dinur Pradipta</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#24324A] mb-1">Deadline / Due Date *</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#24324A] mb-1">Tanggal Mulai (Start Date)</label>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#24324A] mb-1">Deskripsi & Scope Pekerjaan</label>
                <textarea
                  rows={3}
                  placeholder="Deskripsi singkat deliverable & scope project..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl focus:outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8E8EC]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#737680] hover:bg-[#F7F7F8] rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold bg-[#24324A] hover:bg-[#1a2536] text-white rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting ? 'Menyimpan…' : 'Buat Project'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Confirm Delete Project */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetProject)}
        title="Hapus Project dari ClickUp"
        message={deleteTargetProject ? `Apakah Anda yakin ingin menghapus project "${deleteTargetProject.name}"? Project/List ini beserta task di dalamnya akan terhapus dari ClickUp.` : ''}
        confirmText="Hapus Project"
        cancelText="Batal"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteTargetProject) {
            handleDeleteProject(deleteTargetProject.id, deleteTargetProject.name);
            setDeleteTargetProject(null);
          }
        }}
        onCancel={() => setDeleteTargetProject(null)}
      />
    </div>
  );
}

function ProjectsRouteContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathProjectId = pathname.match(/^\/projects\/([^/]+)\/?$/)?.[1] || '';
  const projectId = searchParams.get('projectId') || (pathProjectId ? decodeURIComponent(pathProjectId) : '');

  if (projectId) {
    return <ProjectDetailClient id={projectId} />;
  }

  return <ProjectsListPage />;
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-sm text-[#737680]">Memuat project...</div>}>
      <ProjectsRouteContent />
    </Suspense>
  );
}
