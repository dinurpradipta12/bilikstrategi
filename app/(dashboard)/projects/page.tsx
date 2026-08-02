'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
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

type ViewMode = 'list' | 'board' | 'timeline' | 'calendar';

export default function ProjectsPage() {
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
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Fetch Projects (combining Supabase DB, Shared Server Store, and ClickUp)
  const fetchProjects = async () => {
    setLoading(true);
    let combinedProjects: AgencyProject[] = [];
    const deletedIdsRaw = typeof window !== 'undefined' ? localStorage.getItem('bilik_deleted_project_ids') : null;
    const deletedIds: string[] = deletedIdsRaw ? JSON.parse(deletedIdsRaw) : [];

    // a. Fetch from shared server API store
    try {
      const apiRes = await fetch('/api/supabase/projects', { cache: 'no-store' });
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (Array.isArray(apiData.projects)) {
          combinedProjects.push(...apiData.projects);
        }
      }
    } catch {}

    // b. Fetch from Supabase direct table
    try {
      const { data: dbData } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbData && dbData.length > 0) {
        dbData.forEach((dp: any) => {
          if (!combinedProjects.some((cp) => cp.id === String(dp.id))) {
            combinedProjects.push({
              id: String(dp.id),
              name: dp.name || 'Project',
              client_id: dp.client_id || 'c1',
              client_name: dp.client_name || 'Bilik Strategi Workspace',
              clickup_space_id: '',
              clickup_folder_id: '',
              clickup_list_id: String(dp.id),
              team_lead_id: 'u1',
              team_lead_name: 'Dinur Pradipta',
              member_ids: [],
              status: dp.status || 'in_progress',
              progress_percentage: dp.progress || 0,
              total_tasks: 0,
              completed_tasks: 0,
              overdue_tasks: 0,
              start_date: dp.start_date || new Date().toISOString().split('T')[0],
              due_date: dp.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
              description: dp.description || '',
            });
          }
        });
      }
    } catch {}

    // c. Fetch ClickUp Projects
    try {
      const cuRes = await fetch('/api/clickup/projects');
      if (cuRes.ok) {
        const cuData = await cuRes.json();
        const cuProjects: AgencyProject[] = Array.isArray(cuData.projects) ? cuData.projects : [];
        cuProjects.forEach((cp) => {
          if (!combinedProjects.some((p) => p.id === cp.id)) {
            combinedProjects.push(cp);
          }
        });
      }
    } catch {}

    const cleanProjects = combinedProjects.filter((p) => !deletedIds.includes(p.id));
    setProjects(cleanProjects);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bilik_agency_projects_db', JSON.stringify(cleanProjects));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();

    // 1. Fast background interval (5s)
    const interval = setInterval(() => {
      fetchProjects();
    }, 5000);

    // 2. BroadcastChannel
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('bilik_projects_channel');
        bc.onmessage = () => {
          fetchProjects();
        };
      } catch {}
    }

    if (!isSupabaseConfigured) {
      return () => {
        clearInterval(interval);
        if (bc) bc.close();
      };
    }

    // 3. Supabase Realtime Channel
    const channel = supabase
      .channel('realtime_projects_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          fetchProjects();
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
      client_name: 'Bilik Strategi Workspace',
      clickup_space_id: '',
      clickup_folder_id: '',
      clickup_list_id: newId,
      team_lead_id: 'u1',
      team_lead_name: 'Dinur Pradipta',
      member_ids: [],
      status: 'in_progress',
      progress_percentage: 0,
      total_tasks: 0,
      completed_tasks: 0,
      overdue_tasks: 0,
      start_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      description: newProjectDesc.trim() || 'Project Baru Bilik Strategi',
    };

    // 1. Immediately save to Supabase DB & Server Store
    try {
      await supabase.from('projects').upsert([{
        id: newId,
        name: newProjectName.trim(),
        description: newProjectDesc.trim(),
        status: 'in_progress',
        client_name: 'Bilik Strategi Workspace',
        progress: 0,
      }]);

      await fetch('/api/supabase/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProjectObj),
      });
    } catch (err) {
      console.warn('[ProjectsPage] Could not save project to Supabase:', err);
    }

    // 2. Fire-and-forget ClickUp sync in background (never blocks user)
    fetch('/api/clickup/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProjectName, content: newProjectDesc }),
    }).catch(() => {});

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
  const handleDeleteProject = async (listId: string, name: string) => {
    // 1. Optimistic removal from state
    setProjects((prev) => prev.filter((p) => p.id !== listId));

    // 2. Persist deleted ID in localStorage so it never comes back
    try {
      const deletedIdsRaw = localStorage.getItem('bilik_deleted_project_ids');
      const deletedIds: string[] = deletedIdsRaw ? JSON.parse(deletedIdsRaw) : [];
      if (!deletedIds.includes(listId)) {
        deletedIds.push(listId);
        localStorage.setItem('bilik_deleted_project_ids', JSON.stringify(deletedIds));
      }

      await supabase.from('projects').delete().eq('id', listId);
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
            onClick={fetchProjects}
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
                      <Link href={`/projects/${project.id}`} className="hover:text-[#F26B5E] flex items-center gap-1.5">
                        {project.name}
                        <ChevronRight className="w-3.5 h-3.5 text-[#737680] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                      <span className="text-[11px] font-normal text-[#737680] block truncate max-w-xs">{project.description}</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#202124] font-medium">{project.client_name}</td>
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
                    <td className="py-3.5 px-4 text-[#202124] font-medium">{project.team_lead_name}</td>
                    <td className="py-3.5 px-4 text-[#737680]">
                      {new Date(project.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="block p-4 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl hover:border-[#24324A] transition-all shadow-2xs group"
                    >
                      <span className="text-[10px] font-bold text-[#F26B5E] uppercase tracking-wider block">{p.client_name}</span>
                      <h4 className="text-sm font-bold text-[#24324A] mt-1 group-hover:text-[#F26B5E] transition-colors">{p.name}</h4>
                      <p className="text-xs text-[#737680] mt-1 line-clamp-2">{p.description}</p>

                      <div className="mt-4 pt-3 border-t border-[#E8E8EC] flex items-center justify-between text-xs text-[#737680]">
                        <span>Due: {new Date(p.due_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}</span>
                        <span className="font-bold text-[#4F9D78]">{p.progress_percentage}% Done</span>
                      </div>
                    </Link>
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
                  <span className="text-[#737680]">{p.start_date} s/d {p.due_date}</span>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 relative z-[101]">
            <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-3">
              <h3 className="text-sm font-extrabold text-[#24324A]">Buat Project Baru di ClickUp</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#737680] hover:text-[#24324A]">
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

              <div>
                <label className="block font-semibold text-[#24324A] mb-1">Deskripsi Project</label>
                <textarea
                  rows={3}
                  placeholder="Deskripsi singkat scope pekerjaan..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
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
