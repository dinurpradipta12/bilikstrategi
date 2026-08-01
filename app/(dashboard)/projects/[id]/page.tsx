'use client';

export const runtime = 'edge';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Briefcase,
  CheckSquare,
  Clock,
  Users,
  FileText,
  History,
  MessageSquare,
  Calendar,
  ChevronLeft,
  ExternalLink,
  Plus,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Trash2,
  X,
  UserPlus,
  Link as LinkIcon,
  Download,
  Star,
} from 'lucide-react';
import { MOCK_PROJECTS, MOCK_TASKS, MOCK_USERS, MOCK_CLIENTS, MOCK_ACTIVITY_LOGS } from '@/lib/mock/data';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';

type ProjectTab = 'overview' | 'tasks' | 'timeline' | 'team' | 'files' | 'activity' | 'feedback';

interface Milestone {
  id: string;
  name: string;
  date: string;
  status: 'completed' | 'in_progress' | 'pending';
}

interface TeamMemberItem {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar_url: string;
}

interface FileAssetItem {
  id: string;
  name: string;
  url: string;
  type: string;
  added_at: string;
}

interface FeedbackItem {
  id: string;
  author: string;
  company: string;
  comment: string;
  date: string;
  rating: number;
}

interface ProjectMeta {
  description: string;
  milestones: Milestone[];
  clientInfo: {
    name: string;
    company_name: string;
    industry: string;
    email: string;
  };
  teamMembers: TeamMemberItem[];
  files: FileAssetItem[];
  feedback: FeedbackItem[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [mounted, setMounted] = useState(false);

  const [realProject, setRealProject] = useState<any>(null);
  const [realTasks, setRealTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Modals state
  const [isEditOverviewOpen, setIsEditOverviewOpen] = useState(false);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [isAddFeedbackOpen, setIsAddFeedbackOpen] = useState(false);

  // Project Meta persistent state
  const [meta, setMeta] = useState<ProjectMeta>({
    description: 'Deskripsi deliverable & scope pekerjaan project ini belum diatur. Gunakan tombol Edit untuk memperbarui.',
    milestones: [
      { id: 'm1', name: 'Kickoff Meeting & Brief Approval', date: '2026-06-15', status: 'completed' },
      { id: 'm2', name: 'Konsep Visual & Key Visual Approval', date: '2026-07-01', status: 'completed' },
      { id: 'm3', name: 'Produksi Asset 3D & Deliverables', date: '2026-08-15', status: 'in_progress' },
      { id: 'm4', name: 'Final Launch & Handover Ke Klien', date: '2026-08-31', status: 'pending' },
    ],
    clientInfo: {
      name: 'Client Partner',
      company_name: 'Agency Client Group',
      industry: 'Brand & Creative',
      email: 'contact@clientcompany.com',
    },
    teamMembers: [
      { id: 'u1', name: 'Dinur Pradipta', role: 'Project Lead', email: 'dinur@bilikstrategi.id', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
      { id: 'u2', name: 'Syaiful Akhsin', role: 'Senior Designer', email: 'syaiful@bilikstrategi.id', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
      { id: 'u3', name: 'Budi Santoso', role: 'Copywriter & Content', email: 'budi@bilikstrategi.id', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
    ],
    files: [
      { id: 'f1', name: 'Brief_Project_Scope_v1.pdf', url: 'https://app.clickup.com', type: 'PDF Document', added_at: '2026-07-10' },
      { id: 'f2', name: 'Key_Visual_Design_Asset.figma', url: 'https://figma.com', type: 'Figma Design', added_at: '2026-07-18' },
    ],
    feedback: [
      { id: 'fb1', author: 'Budi Santoso', company: 'Nusantara Retail Group', comment: 'Desain visual awal sangat menarik! Ditunggu hasil render 3D berikutnya.', date: '2026-07-20', rating: 5 },
    ],
  });

  useEffect(() => {
    setMounted(true);

    // Load persistent meta from localStorage
    if (projectId) {
      const savedMeta = localStorage.getItem(`bilik_project_meta_${projectId}`);
      if (savedMeta) {
        try {
          setMeta(JSON.parse(savedMeta));
        } catch {
          // ignore error
        }
      }
    }
  }, [projectId]);

  // Save meta to localStorage whenever meta changes
  const updateMeta = (newMeta: ProjectMeta) => {
    setMeta(newMeta);
    if (projectId) {
      localStorage.setItem(`bilik_project_meta_${projectId}`, JSON.stringify(newMeta));
    }
  };

  // Fetch ClickUp projects & tasks
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch('/api/clickup/projects');
        if (res.ok) {
          const data = await res.json();
          const found = data.projects?.find((p: any) => p.id === projectId || p.clickup_list_id === projectId);
          if (found) {
            setRealProject(found);
            if (found.description && found.description !== 'Project di ClickUp Workspace') {
              setMeta((prev) => ({ ...prev, description: found.description }));
            }
          } else {
            // fallback mock match
            const mock = MOCK_PROJECTS.find((p) => p.id === projectId);
            if (mock) {
              setRealProject(mock);
            } else {
              setRealProject({
                id: projectId,
                clickup_list_id: projectId,
                name: 'Project ClickUp #' + projectId,
                description: 'Project di ClickUp Workspace',
                client_name: 'Internal Agency',
                status: 'planning',
                start_date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
                progress_percentage: 0,
                total_tasks: 0,
                completed_tasks: 0,
                overdue_tasks: 0,
                team_lead_name: 'Agency Lead',
              });
            }
          }
        }

        // Fetch tasks
        const taskRes = await fetch(`/api/clickup/tasks?listId=${projectId}`);
        if (taskRes.ok) {
          const taskData = await taskRes.json();
          if (taskData.tasks) {
            setRealTasks(taskData.tasks);
          }
        }
      } catch {
        // fallback
        const mock = MOCK_PROJECTS.find((p) => p.id === projectId) || MOCK_PROJECTS[0];
        setRealProject(mock);
        setRealTasks(MOCK_TASKS.filter((t) => t.project_id === mock.id));
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const currentProject = realProject || {
    id: projectId,
    clickup_list_id: projectId,
    name: 'Project ' + projectId,
    description: meta.description,
    client_name: meta.clientInfo.company_name,
    status: 'in_progress',
    start_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    progress_percentage: 0,
    total_tasks: realTasks.length,
    completed_tasks: realTasks.filter((t: any) => t.status?.type === 'closed' || t.status === 'completed').length,
    team_lead_name: meta.teamMembers[0]?.name || 'Agency Team',
  };

  // Toggle milestone status inline
  const toggleMilestoneStatus = (milestoneId: string) => {
    const updatedMilestones = meta.milestones.map((m) => {
      if (m.id === milestoneId) {
        const nextStatus: 'completed' | 'in_progress' | 'pending' =
          m.status === 'completed' ? 'in_progress' : m.status === 'in_progress' ? 'pending' : 'completed';
        return { ...m, status: nextStatus };
      }
      return m;
    });
    updateMeta({ ...meta, milestones: updatedMilestones });
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Back Navigation */}
      <div>
        <Link href="/projects" className="inline-flex items-center text-xs font-semibold text-[#737680] hover:text-[#202124]">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Kembali ke Daftar Project
        </Link>
      </div>

      {/* Project Header Banner */}
      <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-[#FFF0ED] text-[#F26B5E] rounded uppercase">
                {meta.clientInfo.company_name || currentProject.client_name}
              </span>
              <span className="text-xs text-[#737680] font-mono">ClickUp List ID: {currentProject.clickup_list_id}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#24324A]">{currentProject.name}</h1>
            <p className="text-xs text-[#737680] max-w-3xl leading-relaxed">{meta.description || currentProject.description}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditOverviewOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-[#E8E8EC] text-xs font-semibold text-[#24324A] rounded-xl hover:bg-[#F7F7F8] transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#F26B5E]" />
              <span>Edit Project Overview</span>
            </button>
            <a
              href={`https://app.clickup.com/v/l/${currentProject.clickup_list_id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#24324A] text-white text-xs font-semibold rounded-xl hover:bg-[#1A2536] transition-colors shadow-xs"
            >
              <span>Buka di ClickUp</span>
              <ExternalLink className="w-3.5 h-3.5 text-white" />
            </a>
          </div>
        </div>

        {/* Project Key Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#E8E8EC] text-xs">
          <div>
            <span className="text-[#737680] block text-[11px]">Team Lead PIC</span>
            <span className="font-semibold text-[#202124]">{currentProject.team_lead_name}</span>
          </div>
          <div>
            <span className="text-[#737680] block text-[11px]">Batas Waktu (Due Date)</span>
            <span className="font-semibold text-[#202124]">{currentProject.due_date}</span>
          </div>
          <div>
            <span className="text-[#737680] block text-[11px]">Penyelesaian Task</span>
            <span className="font-semibold text-[#4F9D78]">
              {realTasks.filter((t: any) => t.status?.type === 'closed' || t.status === 'completed' || t.status === 'closed').length} / {realTasks.length} Selesai ({realTasks.length > 0 ? Math.round((realTasks.filter((t: any) => t.status?.type === 'closed' || t.status === 'completed' || t.status === 'closed').length / realTasks.length) * 100) : 0}%)
            </span>
          </div>
          <div>
            <span className="text-[#737680] block text-[11px]">Status Overall</span>
            <span className="font-bold text-[#24324A] capitalize">{currentProject.status.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E8E8EC] overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: Briefcase },
          { id: 'tasks', label: `Tasks (${realTasks.length})`, icon: CheckSquare },
          { id: 'timeline', label: 'Timeline', icon: Calendar },
          { id: 'team', label: `Team Members (${meta.teamMembers.length})`, icon: Users },
          { id: 'files', label: `Files & Assets (${meta.files.length})`, icon: Paperclip },
          { id: 'activity', label: 'Activity Log', icon: History },
          { id: 'feedback', label: `Client Feedback (${meta.feedback.length})`, icon: MessageSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ProjectTab)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-[#F26B5E] text-[#F26B5E]'
                  : 'border-transparent text-[#737680] hover:text-[#202124]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#24324A]">Deskripsi Deliverable & Scope</h3>
                <button
                  onClick={() => setIsEditOverviewOpen(true)}
                  className="text-xs font-semibold text-[#F26B5E] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Scope & Milestone</span>
                </button>
              </div>
              <p className="text-xs text-[#737680] leading-relaxed whitespace-pre-line">{meta.description}</p>

              <div className="pt-4 border-t border-[#E8E8EC]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-[#24324A]">Milestone Utama Project</h4>
                  <span className="text-[10px] text-[#737680]">Klik ikon centang untuk mengubah status milestone</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  {meta.milestones.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => toggleMilestoneStatus(m.id)}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                        m.status === 'completed'
                          ? 'border-[#E8E8EC] bg-[#F7F7F8] text-[#4F9D78]'
                          : m.status === 'in_progress'
                          ? 'border-[#FEF3D6] bg-[#FFFBF0] text-[#24324A]'
                          : 'border-[#E8E8EC] bg-[#FFFFFF] text-[#737680]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {m.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-[#4F9D78] flex-shrink-0" />
                        ) : m.status === 'in_progress' ? (
                          <Clock className="w-4 h-4 text-[#E6A23C] flex-shrink-0" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-[#E8E8EC] block flex-shrink-0" />
                        )}
                        <span className={`font-semibold ${m.status === 'completed' ? 'line-through text-[#737680]' : ''}`}>
                          {m.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[#737680] font-medium">{m.date}</span>
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                          m.status === 'completed' ? 'bg-[#EEF2F7] text-[#4F9D78]' :
                          m.status === 'in_progress' ? 'bg-[#FEF3D6] text-[#E6A23C]' : 'bg-[#EEF2F7] text-[#737680]'
                        }`}>
                          {m.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#24324A]">Informasi Klien</h3>
                <button
                  onClick={() => setIsEditClientOpen(true)}
                  className="text-xs font-semibold text-[#F26B5E] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Info Klien</span>
                </button>
              </div>
              <div className="text-xs space-y-2.5">
                <p><strong className="text-[#202124] block text-[11px] text-[#737680]">NAMA KLIEN PIC:</strong> <span className="font-semibold text-[#24324A]">{meta.clientInfo.name}</span></p>
                <p><strong className="text-[#202124] block text-[11px] text-[#737680]">PERUSAHAAN:</strong> <span className="font-semibold text-[#24324A]">{meta.clientInfo.company_name}</span></p>
                <p><strong className="text-[#202124] block text-[11px] text-[#737680]">INDUSTRI:</strong> <span className="font-semibold text-[#24324A]">{meta.clientInfo.industry}</span></p>
                <p><strong className="text-[#202124] block text-[11px] text-[#737680]">EMAIL KONTAK:</strong> <span className="font-semibold text-[#F26B5E]">{meta.clientInfo.email}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TASKS */}
      {activeTab === 'tasks' && (
        <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#24324A]">Task Project ClickUp ({realTasks.length})</h3>
              <p className="text-xs text-[#737680]">Task disinkronkan secara real-time dari ClickUp Workspace</p>
            </div>
            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#24324A] text-white text-xs font-semibold rounded-lg hover:bg-[#1A2536] transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Task Baru</span>
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-[#737680]">Memuat task dari ClickUp...</div>
          ) : realTasks.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#737680] border border-dashed border-[#E8E8EC] rounded-xl">
              Belum ada task di project ini. Klik &quot;Tambah Task Baru&quot; untuk membuat task.
            </div>
          ) : (
            <div className="divide-y divide-[#E8E8EC]">
              {realTasks.map((t: any) => (
                <div key={t.id} className="py-3.5 flex items-center justify-between gap-4 hover:bg-[#F7F7F8] px-2 rounded-lg transition-colors">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-[#202124] flex items-center gap-2">
                      <span>{t.name || t.task_name}</span>
                      {t.priority && (
                        <span className="text-[10px] font-mono text-[#737680]">[{t.priority?.priority || t.priority}]</span>
                      )}
                    </h4>
                    <p className="text-[11px] text-[#737680] max-w-xl truncate">{t.description || t.text_content || 'Tanpa deskripsi'}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                      (t.status?.type === 'closed' || t.status === 'completed' || t.status === 'closed') ? 'bg-[#EEF2F7] text-[#4F9D78]' : 'bg-[#EEF2F7] text-[#24324A]'
                    }`}>
                      {t.status?.status || t.status || 'to do'}
                    </span>
                    {t.url && (
                      <a href={t.url} target="_blank" rel="noreferrer" className="text-[#F26B5E] hover:underline text-[11px] flex items-center gap-1">
                        <span>ClickUp</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="p-8 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs text-center py-12 space-y-3">
          <Calendar className="w-8 h-8 text-[#F26B5E] mx-auto" />
          <h3 className="text-sm font-bold text-[#24324A]">Project Timeline & Schedule</h3>
          <p className="text-xs text-[#737680]">Periode Estimasi Project: {currentProject.start_date} s/d {currentProject.due_date}</p>
          <div className="max-w-xl mx-auto pt-4 text-xs space-y-2 text-left bg-[#F7F7F8] p-4 rounded-xl border border-[#E8E8EC]">
            {meta.milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b border-[#E8E8EC] pb-2 last:border-0 last:pb-0">
                <span className="font-semibold text-[#202124]">{m.name}</span>
                <span className="text-[#737680] text-[11px] font-mono">{m.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TEAM MEMBERS */}
      {activeTab === 'team' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#24324A]">Anggota Tim Terlibat ({meta.teamMembers.length})</h3>
            <button
              onClick={() => setIsEditTeamOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#24324A] text-white text-xs font-semibold rounded-lg hover:bg-[#1A2536] transition-colors cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Kelola Tim Project</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meta.teamMembers.map((u) => (
              <div key={u.id} className="p-4 border border-[#E8E8EC] rounded-xl flex items-center justify-between bg-[#FFFFFF] hover:border-[#24324A] transition-all">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.avatar_url} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-[#E8E8EC]" />
                  <div>
                    <p className="text-xs font-bold text-[#202124]">{u.name}</p>
                    <p className="text-[11px] text-[#F26B5E] font-medium">{u.role}</p>
                    <p className="text-[10px] text-[#737680]">{u.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const filtered = meta.teamMembers.filter((item) => item.id !== u.id);
                    updateMeta({ ...meta, teamMembers: filtered });
                  }}
                  className="p-1.5 text-[#737680] hover:text-[#D95858] hover:bg-[#FFF0ED] rounded-lg transition-colors cursor-pointer"
                  title="Hapus dari Tim"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: FILES & ASSETS */}
      {activeTab === 'files' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#24324A]">Lampiran & Asset Project ({meta.files.length})</h3>
            <button
              onClick={() => setIsAddFileOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#24324A] text-white text-xs font-semibold rounded-lg hover:bg-[#1A2536] transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah File / Asset</span>
            </button>
          </div>

          {meta.files.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#737680] border border-dashed border-[#E8E8EC] rounded-xl">
              Belum ada file/asset. Klik &quot;Tambah File / Asset&quot; untuk menambahkan link dokumen atau desain.
            </div>
          ) : (
            <div className="space-y-2.5 text-xs">
              {meta.files.map((file) => (
                <div key={file.id} className="p-3.5 border border-[#E8E8EC] rounded-xl flex items-center justify-between bg-[#FFFFFF] hover:bg-[#F7F7F8] transition-colors">
                  <div className="flex items-center gap-3">
                    <Paperclip className="w-4 h-4 text-[#F26B5E] flex-shrink-0" />
                    <div>
                      <a href={file.url} target="_blank" rel="noreferrer" className="font-semibold text-[#202124] hover:text-[#F26B5E]">
                        {file.name}
                      </a>
                      <span className="text-[10px] text-[#737680] block">{file.type} • Ditambahkan pada {file.added_at}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#F26B5E] bg-[#FFF0ED] rounded-md hover:bg-[#FEE5E2] transition-colors flex items-center gap-1"
                    >
                      <span>Buka Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => {
                        const updatedFiles = meta.files.filter((f) => f.id !== file.id);
                        updateMeta({ ...meta, files: updatedFiles });
                      }}
                      className="p-1.5 text-[#737680] hover:text-[#D95858] hover:bg-[#FFF0ED] rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: ACTIVITY LOG */}
      {activeTab === 'activity' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#24324A]">Riwayat Aktivitas Project</h3>
          <div className="space-y-3 text-xs">
            {MOCK_ACTIVITY_LOGS.map((act) => (
              <div key={act.id} className="p-3.5 border-b border-[#E8E8EC] last:border-0">
                <p><strong className="text-[#202124]">{act.user_name}:</strong> {act.action} - <span className="font-medium text-[#24324A]">{act.entity_name}</span></p>
                <span className="text-[10px] text-[#737680]">{act.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: CLIENT FEEDBACK */}
      {activeTab === 'feedback' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#24324A]">Catatan Feedback Klien ({meta.feedback.length})</h3>
            <button
              onClick={() => setIsAddFeedbackOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#24324A] text-white text-xs font-semibold rounded-lg hover:bg-[#1A2536] transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Feedback Klien</span>
            </button>
          </div>

          {meta.feedback.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#737680] border border-dashed border-[#E8E8EC] rounded-xl">
              Belum ada feedback. Klik &quot;Tambah Feedback Klien&quot; untuk mencatat respon klien.
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {meta.feedback.map((fb) => (
                <div key={fb.id} className="p-4 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#24324A]">{fb.author} <span className="font-normal text-[#737680]">({fb.company})</span></p>
                      <span className="text-[10px] text-[#737680]">{fb.date}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#E6A23C]">
                      {Array.from({ length: fb.rating || 5 }).map((_, idx) => (
                        <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                  </div>
                  <p className="text-[#202124] italic leading-relaxed">&quot;{fb.comment}&quot;</p>
                  <button
                    onClick={() => {
                      const updatedFb = meta.feedback.filter((item) => item.id !== fb.id);
                      updateMeta({ ...meta, feedback: updatedFb });
                    }}
                    className="absolute top-3 right-3 text-[#737680] hover:text-[#D95858]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE TASK MODAL */}
      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onTaskCreated={(newTask) => {
          setRealTasks((prev) => [newTask, ...prev]);
        }}
      />

      {/* MODAL 1: EDIT OVERVIEW & SCOPE MODAL */}
      {isEditOverviewOpen &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-xl bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8EC] bg-[#F7F7F8]">
                <h2 className="text-sm font-bold text-[#24324A] flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#F26B5E]" />
                  <span>Edit Project Scope & Milestones</span>
                </h2>
                <button onClick={() => setIsEditOverviewOpen(false)} className="p-1 text-[#737680] hover:text-[#202124]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-semibold text-[#202124] mb-1">Deskripsi Deliverable & Scope Pekerjaan</label>
                  <textarea
                    rows={4}
                    value={meta.description}
                    onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A]"
                    placeholder="Tuliskan scope deliverable project..."
                  />
                </div>

                <div className="pt-3 border-t border-[#E8E8EC] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#24324A]">Kelola Milestone Project</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const newMs: Milestone = {
                          id: 'ms-' + Date.now(),
                          name: 'Milestone Baru',
                          date: new Date().toISOString().split('T')[0],
                          status: 'pending',
                        };
                        setMeta({ ...meta, milestones: [...meta.milestones, newMs] });
                      }}
                      className="text-[11px] font-semibold text-[#F26B5E] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Milestone</span>
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    {meta.milestones.map((m, idx) => (
                      <div key={m.id} className="p-3 border border-[#E8E8EC] rounded-lg space-y-2 bg-[#F7F7F8]">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={m.name}
                            onChange={(e) => {
                              const updated = [...meta.milestones];
                              updated[idx].name = e.target.value;
                              setMeta({ ...meta, milestones: updated });
                            }}
                            className="flex-1 px-2.5 py-1 text-xs border border-[#E8E8EC] rounded bg-[#FFFFFF]"
                            placeholder="Nama Milestone"
                          />
                          <input
                            type="date"
                            value={m.date}
                            onChange={(e) => {
                              const updated = [...meta.milestones];
                              updated[idx].date = e.target.value;
                              setMeta({ ...meta, milestones: updated });
                            }}
                            className="px-2 py-1 text-xs border border-[#E8E8EC] rounded bg-[#FFFFFF]"
                          />
                          <select
                            value={m.status}
                            onChange={(e) => {
                              const updated = [...meta.milestones];
                              updated[idx].status = e.target.value as any;
                              setMeta({ ...meta, milestones: updated });
                            }}
                            className="px-2 py-1 text-xs border border-[#E8E8EC] rounded bg-[#FFFFFF]"
                          >
                            <option value="completed">Completed</option>
                            <option value="in_progress">In Progress</option>
                            <option value="pending">Pending</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = meta.milestones.filter((item) => item.id !== m.id);
                              setMeta({ ...meta, milestones: updated });
                            }}
                            className="p-1 text-[#737680] hover:text-[#D95858]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8E8EC]">
                  <button
                    onClick={() => setIsEditOverviewOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-[#737680] hover:bg-[#F7F7F8] rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      updateMeta(meta);
                      setIsEditOverviewOpen(false);
                    }}
                    className="px-5 py-2 text-xs font-semibold text-white bg-[#24324A] hover:bg-[#1A2536] rounded-lg shadow-xs"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 2: EDIT CLIENT INFO MODAL */}
      {isEditClientOpen &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8EC] bg-[#F7F7F8]">
                <h2 className="text-sm font-bold text-[#24324A] flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#F26B5E]" />
                  <span>Edit Informasi Klien Project</span>
                </h2>
                <button onClick={() => setIsEditClientOpen(false)} className="p-1 text-[#737680] hover:text-[#202124]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Nama Klien PIC</label>
                  <input
                    type="text"
                    value={meta.clientInfo.name}
                    onChange={(e) => setMeta({ ...meta, clientInfo: { ...meta.clientInfo, name: e.target.value } })}
                    className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Perusahaan / Brand</label>
                  <input
                    type="text"
                    value={meta.clientInfo.company_name}
                    onChange={(e) => setMeta({ ...meta, clientInfo: { ...meta.clientInfo, company_name: e.target.value } })}
                    className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Industri</label>
                  <input
                    type="text"
                    value={meta.clientInfo.industry}
                    onChange={(e) => setMeta({ ...meta, clientInfo: { ...meta.clientInfo, industry: e.target.value } })}
                    className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Email Kontak</label>
                  <input
                    type="email"
                    value={meta.clientInfo.email}
                    onChange={(e) => setMeta({ ...meta, clientInfo: { ...meta.clientInfo, email: e.target.value } })}
                    className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E8EC]">
                  <button onClick={() => setIsEditClientOpen(false)} className="px-4 py-2 text-[#737680] hover:bg-[#F7F7F8] rounded-lg">
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      updateMeta(meta);
                      setIsEditClientOpen(false);
                    }}
                    className="px-5 py-2 font-semibold text-white bg-[#24324A] hover:bg-[#1A2536] rounded-lg shadow-xs"
                  >
                    Simpan Info Klien
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 3: EDIT TEAM MEMBERS MODAL */}
      {isEditTeamOpen &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8EC] bg-[#F7F7F8]">
                <h2 className="text-sm font-bold text-[#24324A] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#F26B5E]" />
                  <span>Tambah Anggota Tim Project</span>
                </h2>
                <button onClick={() => setIsEditTeamOpen(false)} className="p-1 text-[#737680] hover:text-[#202124]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e: any) => {
                  e.preventDefault();
                  const form = e.target;
                  const newMember: TeamMemberItem = {
                    id: 'tm-' + Date.now(),
                    name: form.memberName.value,
                    role: form.memberRole.value,
                    email: form.memberEmail.value,
                    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                  };
                  updateMeta({ ...meta, teamMembers: [...meta.teamMembers, newMember] });
                  setIsEditTeamOpen(false);
                }}
                className="p-6 space-y-4 text-xs"
              >
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Nama Anggota Tim *</label>
                  <input name="memberName" required placeholder="Contoh: Dimas Pratama" className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Peran / Role di Project *</label>
                  <input name="memberRole" required placeholder="Contoh: Senior UI/UX Designer" className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Email</label>
                  <input name="memberEmail" type="email" placeholder="dimas@bilikstrategi.id" className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg" />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E8EC]">
                  <button type="button" onClick={() => setIsEditTeamOpen(false)} className="px-4 py-2 text-[#737680] hover:bg-[#F7F7F8] rounded-lg">
                    Batal
                  </button>
                  <button type="submit" className="px-5 py-2 font-semibold text-white bg-[#24324A] hover:bg-[#1A2536] rounded-lg shadow-xs">
                    Tambah Member
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 4: ADD FILE & ASSET MODAL */}
      {isAddFileOpen &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8EC] bg-[#F7F7F8]">
                <h2 className="text-sm font-bold text-[#24324A] flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-[#F26B5E]" />
                  <span>Tambah Lampiran File / Link Asset</span>
                </h2>
                <button onClick={() => setIsAddFileOpen(false)} className="p-1 text-[#737680] hover:text-[#202124]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e: any) => {
                  e.preventDefault();
                  const form = e.target;
                  const newFile: FileAssetItem = {
                    id: 'file-' + Date.now(),
                    name: form.fileName.value,
                    url: form.fileUrl.value,
                    type: form.fileType.value,
                    added_at: new Date().toISOString().split('T')[0],
                  };
                  updateMeta({ ...meta, files: [...meta.files, newFile] });
                  setIsAddFileOpen(false);
                }}
                className="p-6 space-y-4 text-xs"
              >
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Nama File / Asset *</label>
                  <input name="fileName" required placeholder="Contoh: Final_Banner_Campaign_3D.figma" className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Link URL / Cloud File *</label>
                  <input name="fileUrl" required type="url" placeholder="https://figma.com/@..." className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Tipe File</label>
                  <select name="fileType" className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg bg-[#FFFFFF]">
                    <option value="Figma Design">Figma Design</option>
                    <option value="PDF Document">PDF Document</option>
                    <option value="Google Drive / Link">Google Drive / Link</option>
                    <option value="Image Asset">Image Asset</option>
                    <option value="3D Model / Video">3D Model / Video</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E8EC]">
                  <button type="button" onClick={() => setIsAddFileOpen(false)} className="px-4 py-2 text-[#737680] hover:bg-[#F7F7F8] rounded-lg">
                    Batal
                  </button>
                  <button type="submit" className="px-5 py-2 font-semibold text-white bg-[#24324A] hover:bg-[#1A2536] rounded-lg shadow-xs">
                    Simpan File Asset
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 5: ADD CLIENT FEEDBACK MODAL */}
      {isAddFeedbackOpen &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8EC] bg-[#F7F7F8]">
                <h2 className="text-sm font-bold text-[#24324A] flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#F26B5E]" />
                  <span>Catat Feedback Klien Baru</span>
                </h2>
                <button onClick={() => setIsAddFeedbackOpen(false)} className="p-1 text-[#737680] hover:text-[#202124]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e: any) => {
                  e.preventDefault();
                  const form = e.target;
                  const newFb: FeedbackItem = {
                    id: 'fb-' + Date.now(),
                    author: form.author.value,
                    company: form.company.value,
                    comment: form.comment.value,
                    rating: parseInt(form.rating.value, 10),
                    date: new Date().toISOString().split('T')[0],
                  };
                  updateMeta({ ...meta, feedback: [...meta.feedback, newFb] });
                  setIsAddFeedbackOpen(false);
                }}
                className="p-6 space-y-4 text-xs"
              >
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Nama Pemberi Feedback *</label>
                  <input name="author" required defaultValue={meta.clientInfo.name} className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Perusahaan / Brand</label>
                  <input name="company" defaultValue={meta.clientInfo.company_name} className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Catatan Feedback / Revisi *</label>
                  <textarea name="comment" required rows={3} placeholder="Tuliskan catatan dari klien..." className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Rating Kepuasan</label>
                  <select name="rating" className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg bg-[#FFFFFF]">
                    <option value="5">⭐⭐⭐⭐⭐ 5/5 (Sangat Puas)</option>
                    <option value="4">⭐⭐⭐⭐ 4/5 (Bagus)</option>
                    <option value="3">⭐⭐⭐ 3/5 (Cukup)</option>
                    <option value="2">⭐⭐ 2/5 (Perlu Perbaikan)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E8EC]">
                  <button type="button" onClick={() => setIsAddFeedbackOpen(false)} className="px-4 py-2 text-[#737680] hover:bg-[#F7F7F8] rounded-lg">
                    Batal
                  </button>
                  <button type="submit" className="px-5 py-2 font-semibold text-white bg-[#24324A] hover:bg-[#1A2536] rounded-lg shadow-xs">
                    Simpan Feedback
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
