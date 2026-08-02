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
  Building2,
} from 'lucide-react';
import { MOCK_PROJECTS, MOCK_TASKS, MOCK_USERS, MOCK_CLIENTS, MOCK_ACTIVITY_LOGS } from '@/lib/mock/data';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';

type ProjectTab = 'overview' | 'tasks' | 'timeline' | 'team' | 'files' | 'activity' | 'feedback';

interface Milestone {
  id: string;
  name: string;
  date: string;
  start_date?: string;
  due_date?: string;
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

interface ActivityLogItem {
  id: string;
  user_name: string;
  user_avatar?: string;
  action: string;
  entity_name: string;
  details?: string;
  timestamp: string;
}

interface ProjectMeta {
  description: string;
  status?: 'planning' | 'in_progress' | 'on_hold' | 'completed';
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
  activityLogs: ActivityLogItem[];
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
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [timelineViewMode, setTimelineViewMode] = useState<'week' | 'month'>('week');

  // Client Edit Options State
  const [clientMode, setClientMode] = useState<'select' | 'manual'>('select');
  const [existingClientsList, setExistingClientsList] = useState<any[]>([]);
  const [selectedListingClientId, setSelectedListingClientId] = useState<string>('');

  // Modals state
  const [isEditOverviewOpen, setIsEditOverviewOpen] = useState(false);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [isAddFeedbackOpen, setIsAddFeedbackOpen] = useState(false);
  const [isAddLogOpen, setIsAddLogOpen] = useState(false);
  const [filterUser, setFilterUser] = useState<string>('all');

  // Project Meta persistent state
  const [meta, setMeta] = useState<ProjectMeta>({
    description: 'Deskripsi deliverable & scope pekerjaan project ini belum diatur. Gunakan tombol Edit untuk memperbarui.',
    milestones: [
      { id: 'm1', name: 'Kickoff Meeting & Brief Approval', date: '2026-08-05', start_date: '2026-08-01', due_date: '2026-08-05', status: 'completed' },
      { id: 'm2', name: 'Konsep Visual & Key Visual Approval', date: '2026-08-12', start_date: '2026-08-06', due_date: '2026-08-12', status: 'completed' },
      { id: 'm3', name: 'Produksi Asset 3D & Deliverables', date: '2026-08-24', start_date: '2026-08-13', due_date: '2026-08-24', status: 'in_progress' },
      { id: 'm4', name: 'Final Launch & Handover Ke Klien', date: '2026-08-31', start_date: '2026-08-25', due_date: '2026-08-31', status: 'pending' },
    ],
    clientInfo: {
      name: 'Client Partner',
      company_name: 'Agency Client Group',
      industry: 'Brand & Creative',
      email: 'contact@clientcompany.com',
    },
    teamMembers: [
      { id: 'u1', name: 'Dinur Pradipta', role: 'Project Lead', email: 'dinur@bilikstrategi.id', avatar_url: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg' },
      { id: 'u2', name: 'Dinur mp', role: 'Member', email: 'contact.dinurpradipta@gmail.com', avatar_url: 'https://ui-avatars.com/api/?name=Dinur%20mp&background=24324A&color=F26B5E&font-size=0.4&bold=true' },
      { id: 'u3', name: 'Syaiful Akhsin', role: 'Senior Designer', email: 'syaiful@bilikstrategi.id', avatar_url: 'https://ui-avatars.com/api/?name=Syaiful%20Akhsin&background=24324A&color=F26B5E&font-size=0.4&bold=true' },
    ],
    files: [
      { id: 'f1', name: 'Brief_Project_Scope_v1.pdf', url: 'https://app.clickup.com', type: 'PDF Document', added_at: '2026-07-10' },
      { id: 'f2', name: 'Key_Visual_Design_Asset.figma', url: 'https://figma.com', type: 'Figma Design', added_at: '2026-07-18' },
    ],
    feedback: [
      { id: 'fb1', author: 'Budi Santoso', company: 'Nusantara Retail Group', comment: 'Desain visual awal sangat menarik! Ditunggu hasil render 3D berikutnya.', date: '2026-07-20', rating: 5 },
    ],
    activityLogs: [
      {
        id: 'act-1',
        user_name: 'Dinur Pradipta',
        user_avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
        action: 'BUAT TASK',
        entity_name: 'contoh task dulu edit 2',
        details: 'Membuat task baru di ClickUp List',
        timestamp: '2026-08-02T00:15:00Z',
      },
      {
        id: 'act-2',
        user_name: 'Dinur mp',
        user_avatar: 'https://ui-avatars.com/api/?name=Dinur%20mp&background=24324A&color=F26B5E&font-size=0.4&bold=true',
        action: 'SELESAIKAN MILESTONE',
        entity_name: 'Kickoff Meeting & Brief Approval',
        details: 'Mengubah status milestone menjadi Selesai (100%)',
        timestamp: '2026-08-01T14:30:00Z',
      },
      {
        id: 'act-3',
        user_name: 'Syaiful Akhsin',
        user_avatar: 'https://ui-avatars.com/api/?name=Syaiful%20Akhsin&background=24324A&color=F26B5E&font-size=0.4&bold=true',
        action: 'TAMBAH SUBTASK',
        entity_name: 'Penyusunan referensi visual moodboard',
        details: 'Menambahkan subtask baru ke ClickUp Task',
        timestamp: '2026-07-31T10:00:00Z',
      },
    ],
  });

  interface ClickUpMember {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar: string;
  }

  const [clickupMembers, setClickupMembers] = useState<ClickUpMember[]>([]);
  const [selectedClickUpMemberId, setSelectedClickUpMemberId] = useState<string>('');

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

    // Load REAL Client Listing from ClickUp API & Custom Saved Clients (NO MOCK DATA)
    async function loadRealClients() {
      const map = new Map<string, any>();

      // 1. Fetch real ClickUp projects / client groups
      try {
        const res = await fetch('/api/clickup/projects');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.projects)) {
            data.projects.forEach((p: any, idx: number) => {
              const cName = p.client_name || p.name;
              if (cName && !map.has(cName.toLowerCase())) {
                map.set(cName.toLowerCase(), {
                  id: `c_cu_${p.id || idx}`,
                  name: cName === 'Agency Client Group' ? 'Client Partner' : `PIC ${cName}`,
                  company_name: cName,
                  industry: 'Brand & Creative',
                  email: `contact@${cName.toLowerCase().replace(/\s+/g, '')}.com`,
                });
              }
            });
          }
        }
      } catch {
        // ignore
      }

      // 2. Merge custom clients created by user from localStorage
      const savedCustomStr = localStorage.getItem('bilik_custom_clients');
      if (savedCustomStr) {
        try {
          const customList = JSON.parse(savedCustomStr);
          if (Array.isArray(customList)) {
            customList.forEach((c) => {
              if (c.company_name) {
                map.set(c.company_name.toLowerCase(), c);
              }
            });
          }
        } catch {
          // ignore
        }
      }

      const all = Array.from(map.values());
      setExistingClientsList(all);
      if (all.length > 0) {
        setSelectedListingClientId(all[0].id || all[0].company_name);
      }
    }
    loadRealClients();

    // Fetch ClickUp team members & sync profile pictures
    async function fetchClickUpMembers() {
      try {
        const res = await fetch('/api/clickup/teams');
        if (res.ok) {
          const data = await res.json();
          if (data.members && data.members.length > 0) {
            const formatted: ClickUpMember[] = data.members.map((m: any) => {
              const name = m.username || (m.email ? m.email.split('@')[0] : 'Team Member');
              const avatar = m.profilePicture
                ? m.profilePicture
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=24324A&color=F26B5E&font-size=0.4&bold=true`;
              return {
                id: String(m.id),
                name,
                email: m.email || '',
                role: m.role_key || (m.role === 1 ? 'owner' : m.role === 2 ? 'admin' : 'member'),
                avatar,
              };
            });
            setClickupMembers(formatted);
            if (formatted[0]?.id) {
              setSelectedClickUpMemberId(formatted[0].id);
            }

            // Sync existing meta.teamMembers avatar_url with live ClickUp profile picture
            setMeta((prev) => {
              const updatedTeam = prev.teamMembers.map((tm) => {
                const match = formatted.find(
                  (f) =>
                    f.id === tm.id ||
                    (f.email && tm.email && f.email.toLowerCase() === tm.email.toLowerCase()) ||
                    f.name.toLowerCase() === tm.name.toLowerCase()
                );
                if (match) {
                  return { ...tm, avatar_url: match.avatar, email: match.email || tm.email };
                }
                return tm;
              });
              return { ...prev, teamMembers: updatedTeam };
            });
          }
        }
      } catch {
        // ignore
      }
    }

    fetchClickUpMembers();
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

  const currentProject = {
    ...(realProject || {
      id: projectId,
      clickup_list_id: projectId,
      name: 'Project ' + projectId,
      description: meta.description,
      client_name: meta.clientInfo.company_name,
      start_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      progress_percentage: 0,
      total_tasks: realTasks.length,
      completed_tasks: realTasks.filter((t: any) => t.status?.type === 'closed' || t.status === 'completed').length,
      team_lead_name: meta.teamMembers[0]?.name || 'Agency Team',
    }),
    status: meta.status || realProject?.status || 'in_progress',
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
            <span className="text-[#737680] block text-[11px] mb-1">Status Overall (Klik untuk Ubah)</span>
            <select
              value={currentProject.status}
              onChange={(e) => {
                const newStatus = e.target.value as any;
                const newLog = {
                  id: 'act-' + Date.now(),
                  user_name: 'Dinur Pradipta',
                  user_avatar: 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
                  action: 'UBAH STATUS',
                  entity_name: currentProject.name,
                  details: `Status project diubah menjadi "${newStatus.replace('_', ' ').toUpperCase()}"`,
                  timestamp: new Date().toISOString(),
                };
                const updatedMeta = {
                  ...meta,
                  status: newStatus,
                  activityLogs: [newLog, ...meta.activityLogs],
                };
                updateMeta(updatedMeta);
              }}
              className={`px-3 py-1 text-xs font-extrabold rounded-lg border appearance-none cursor-pointer outline-none transition-all ${
                currentProject.status === 'completed'
                  ? 'bg-[#E3F8E9] text-[#1D7434] border-[#B4ECC2]'
                  : currentProject.status === 'in_progress'
                  ? 'bg-[#EEF2F7] text-[#24324A] border-[#BDD7FF]'
                  : currentProject.status === 'on_hold'
                  ? 'bg-[#FFE8E8] text-[#C22929] border-[#FFB8B8]'
                  : 'bg-[#FEF3D6] text-[#E6A23C] border-[#FCE4B3]'
              }`}
            >
              <option value="in_progress">🚀 In Progress (Sedang Berjalan)</option>
              <option value="planning">📝 Planning (Perencanaan)</option>
              <option value="on_hold">⏸️ On Hold (Tertunda)</option>
              <option value="completed">✅ Completed (Selesai 100%)</option>
            </select>
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

      {/* TAB 3: TIMELINE / CALENDAR SCHEDULE ROADMAP */}
      {activeTab === 'timeline' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-6">
          {/* Timeline Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E8EC] pb-4">
            <div>
              <h3 className="text-base font-extrabold text-[#24324A] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#F26B5E]" />
                <span>Project Timeline & Schedule Calendar</span>
              </h3>
              <p className="text-xs text-[#737680] mt-0.5">
                Jadwal Roadmap: <span className="font-semibold text-[#202124]">{currentProject.start_date}</span> s/d <span className="font-semibold text-[#202124]">{currentProject.due_date}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* View Mode Switcher: ONLY 'Minggu' and 'Bulan' */}
              <div className="flex items-center bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl p-1 text-xs font-semibold text-[#737680]">
                <button
                  onClick={() => setTimelineViewMode('week')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    timelineViewMode === 'week' ? 'bg-[#FFFFFF] text-[#24324A] shadow-2xs font-extrabold' : 'hover:text-[#202124]'
                  }`}
                >
                  Minggu
                </button>
                <button
                  onClick={() => setTimelineViewMode('month')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    timelineViewMode === 'month' ? 'bg-[#FFFFFF] text-[#24324A] shadow-2xs font-extrabold' : 'hover:text-[#202124]'
                  }`}
                >
                  Bulan
                </button>
              </div>

              <button
                onClick={() => setIsEditOverviewOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#24324A] text-white text-xs font-semibold rounded-xl hover:bg-[#1A2536] transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#F26B5E]" />
                <span>Kelola / Tambah Milestone</span>
              </button>
            </div>
          </div>

          {/* VIEW MODE 1: MINGGU (WEEK VIEW BOARD) */}
          {timelineViewMode === 'week' && (
            <div className="border border-[#E8E8EC] rounded-2xl overflow-hidden bg-[#FFFFFF]">
              {/* Days Header Row */}
              <div className="grid grid-cols-7 border-b border-[#E8E8EC] bg-[#FFFFFF] text-center text-xs font-bold text-[#737680]">
                {[
                  { dayName: 'SUN', dateNum: '02', isToday: true },
                  { dayName: 'MON', dateNum: '03', isToday: false },
                  { dayName: 'TUE', dateNum: '04', isToday: false },
                  { dayName: 'WED', dateNum: '05', isToday: false },
                  { dayName: 'THU', dateNum: '06', isToday: false },
                  { dayName: 'FRI', dateNum: '07', isToday: false },
                  { dayName: 'SAT', dateNum: '08', isToday: false },
                ].map((day) => (
                  <div
                    key={day.dayName}
                    className={`py-3 border-r border-[#E8E8EC] last:border-r-0 flex flex-col items-center justify-center gap-1 ${
                      day.isToday ? 'bg-[#EEF2F7]/60' : ''
                    }`}
                  >
                    <span className="text-[10px] tracking-wider uppercase font-semibold">{day.dayName}</span>
                    <span
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-extrabold ${
                        day.isToday ? 'bg-[#24324A] text-white shadow-xs' : 'text-[#202124]'
                      }`}
                    >
                      {day.dateNum}
                    </span>
                  </div>
                ))}
              </div>

              {/* Schedule Board Body */}
              <div className="relative min-h-[380px] p-4 bg-[#FFFFFF]">
                <div className="absolute inset-0 grid grid-cols-7 divide-x divide-[#E8E8EC]/50 pointer-events-none" />

                <div className="relative z-10 space-y-3">
                  {meta.milestones.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#737680]">
                      Belum ada milestone roadmap. Klik &quot;Kelola / Tambah Milestone&quot; untuk menambahkan.
                    </div>
                  ) : (
                    meta.milestones.map((m, idx) => {
                      const themes = [
                        { bg: 'bg-[#E8F1FF]', text: 'text-[#1E56B3]', border: 'border-[#BDD7FF]', icon: '🎨' },
                        { bg: 'bg-[#E3F8E9]', text: 'text-[#1D7434]', border: 'border-[#B4ECC2]', icon: '📝' },
                        { bg: 'bg-[#F2E8FF]', text: 'text-[#6929C4]', border: 'border-[#DAAFFE]', icon: '🚀' },
                        { bg: 'bg-[#FFE8E8]', text: 'text-[#C22929]', border: 'border-[#FFB8B8]', icon: '📦' },
                      ];
                      const theme = themes[idx % themes.length];

                      const startD = m.start_date ? parseInt(m.start_date.split('-')[2] || '1', 10) : 1;
                      const endD = m.due_date ? parseInt(m.due_date.split('-')[2] || '31', 10) : (m.date ? parseInt(m.date.split('-')[2] || '15', 10) : 15);

                      const startCol = Math.max(0, Math.min(6, startD - 2));
                      const endCol = Math.max(startCol, Math.min(6, endD - 2));
                      const colSpan = Math.max(1, endCol - startCol + 1);

                      return (
                        <div key={m.id} className="grid grid-cols-7 gap-2">
                          <div
                            style={{ gridColumnStart: startCol + 1, gridColumnEnd: `span ${colSpan}` }}
                            onClick={() => toggleMilestoneStatus(m.id)}
                            className={`group ${theme.bg} ${theme.border} border rounded-xl p-2.5 flex items-center justify-between shadow-2xs hover:shadow-md transition-all cursor-pointer`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm flex-shrink-0">{theme.icon}</span>
                              <div className="truncate">
                                <span className={`text-xs font-bold block truncate ${theme.text}`}>
                                  {m.name}
                                </span>
                                <span className="text-[10px] opacity-80 block truncate">
                                  {m.start_date || m.date} s/d {m.due_date || m.date}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${theme.bg} ${theme.text} border ${theme.border}`}>
                                {m.status === 'completed' ? '🟢 Selesai' : m.status === 'in_progress' ? '🔵 In Progress' : '⚪ Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: BULAN (FULL MONTHLY CALENDAR WITH ONE CONTINUOUS SPANNING BAR OVERLAY) */}
          {timelineViewMode === 'month' && (
            <div className="border border-[#E8E8EC] rounded-2xl overflow-hidden bg-[#FFFFFF]">
              <div className="grid grid-cols-7 border-b border-[#E8E8EC] bg-[#F7F7F8] text-center text-xs font-bold text-[#737680] py-3 uppercase tracking-wider">
                <span>SUN</span>
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
              </div>

              <div className="divide-y divide-[#E8E8EC]">
                {[
                  {
                    weekIndex: 0,
                    days: [
                      { dateNum: 26, isCurrentMonth: false, monthDay: 0 },
                      { dateNum: 27, isCurrentMonth: false, monthDay: 0 },
                      { dateNum: 28, isCurrentMonth: false, monthDay: 0 },
                      { dateNum: 29, isCurrentMonth: false, monthDay: 0 },
                      { dateNum: 30, isCurrentMonth: false, monthDay: 0 },
                      { dateNum: 31, isCurrentMonth: false, monthDay: 0 },
                      { dateNum: 1, isCurrentMonth: true, monthDay: 1 },
                    ],
                  },
                  {
                    weekIndex: 1,
                    days: [
                      { dateNum: 2, isCurrentMonth: true, isToday: true, monthDay: 2 },
                      { dateNum: 3, isCurrentMonth: true, monthDay: 3 },
                      { dateNum: 4, isCurrentMonth: true, monthDay: 4 },
                      { dateNum: 5, isCurrentMonth: true, monthDay: 5 },
                      { dateNum: 6, isCurrentMonth: true, monthDay: 6 },
                      { dateNum: 7, isCurrentMonth: true, monthDay: 7 },
                      { dateNum: 8, isCurrentMonth: true, monthDay: 8 },
                    ],
                  },
                  {
                    weekIndex: 2,
                    days: [
                      { dateNum: 9, isCurrentMonth: true, monthDay: 9 },
                      { dateNum: 10, isCurrentMonth: true, monthDay: 10 },
                      { dateNum: 11, isCurrentMonth: true, monthDay: 11 },
                      { dateNum: 12, isCurrentMonth: true, monthDay: 12 },
                      { dateNum: 13, isCurrentMonth: true, monthDay: 13 },
                      { dateNum: 14, isCurrentMonth: true, monthDay: 14 },
                      { dateNum: 15, isCurrentMonth: true, monthDay: 15 },
                    ],
                  },
                  {
                    weekIndex: 3,
                    days: [
                      { dateNum: 16, isCurrentMonth: true, monthDay: 16 },
                      { dateNum: 17, isCurrentMonth: true, monthDay: 17 },
                      { dateNum: 18, isCurrentMonth: true, monthDay: 18 },
                      { dateNum: 19, isCurrentMonth: true, monthDay: 19 },
                      { dateNum: 20, isCurrentMonth: true, monthDay: 20 },
                      { dateNum: 21, isCurrentMonth: true, monthDay: 21 },
                      { dateNum: 22, isCurrentMonth: true, monthDay: 22 },
                    ],
                  },
                  {
                    weekIndex: 4,
                    days: [
                      { dateNum: 23, isCurrentMonth: true, monthDay: 23 },
                      { dateNum: 24, isCurrentMonth: true, monthDay: 24 },
                      { dateNum: 25, isCurrentMonth: true, monthDay: 25 },
                      { dateNum: 26, isCurrentMonth: true, monthDay: 26 },
                      { dateNum: 27, isCurrentMonth: true, monthDay: 27 },
                      { dateNum: 28, isCurrentMonth: true, monthDay: 28 },
                      { dateNum: 29, isCurrentMonth: true, monthDay: 29 },
                    ],
                  },
                  {
                    weekIndex: 5,
                    days: [
                      { dateNum: 30, isCurrentMonth: true, monthDay: 30 },
                      { dateNum: 31, isCurrentMonth: true, monthDay: 31 },
                      { dateNum: 1, isCurrentMonth: false, monthDay: 0 },
                      { dateNum: 2, isCurrentMonth: false, monthDay: 0 },
                      { dateNum: 3, isCurrentMonth: false, monthDay: 0 },
                      { dateNum: 4, isCurrentMonth: false, monthDay: 0 },
                      { dateNum: 5, isCurrentMonth: false, monthDay: 0 },
                    ],
                  },
                ].map((week) => (
                  <div key={week.weekIndex} className="relative min-h-[100px]">
                    <div className="grid grid-cols-7 divide-x divide-[#E8E8EC] absolute inset-0 bg-[#FFFFFF]">
                      {week.days.map((day, dIdx) => (
                        <div
                          key={dIdx}
                          className={`p-2 flex flex-col justify-between ${
                            !day.isCurrentMonth
                              ? 'bg-[#F7F7F8]/40 text-[#A0A3BD]'
                              : day.isToday
                              ? 'bg-[#EEF2F7]/50'
                              : 'bg-[#FFFFFF]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-extrabold ${
                                day.isToday ? 'bg-[#24324A] text-white shadow-xs' : 'text-[#202124]'
                              }`}
                            >
                              {day.dateNum}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="relative z-10 pt-8 pb-2 px-1 space-y-1.5">
                      {meta.milestones.map((m, mIdx) => {
                        const themes = [
                          { bg: 'bg-[#E8F1FF]', text: 'text-[#1E56B3]', border: 'border-[#BDD7FF]', icon: '🎨' },
                          { bg: 'bg-[#E3F8E9]', text: 'text-[#1D7434]', border: 'border-[#B4ECC2]', icon: '📝' },
                          { bg: 'bg-[#F2E8FF]', text: 'text-[#6929C4]', border: 'border-[#DAAFFE]', icon: '🚀' },
                          { bg: 'bg-[#FFE8E8]', text: 'text-[#C22929]', border: 'border-[#FFB8B8]', icon: '📦' },
                        ];
                        const theme = themes[mIdx % themes.length];

                        const startD = m.start_date ? parseInt(m.start_date.split('-')[2] || '1', 10) : 1;
                        const endD = m.due_date ? parseInt(m.due_date.split('-')[2] || '31', 10) : 15;

                        const activeColsInWeek: number[] = [];
                        week.days.forEach((day, colIdx) => {
                          if (day.isCurrentMonth && day.monthDay >= startD && day.monthDay <= endD) {
                            activeColsInWeek.push(colIdx);
                          }
                        });

                        if (activeColsInWeek.length === 0) return null;

                        const startCol = activeColsInWeek[0];
                        const endCol = activeColsInWeek[activeColsInWeek.length - 1];
                        const colSpan = endCol - startCol + 1;

                        return (
                          <div key={m.id} className="grid grid-cols-7 gap-1">
                            <div
                              style={{ gridColumnStart: startCol + 1, gridColumnEnd: `span ${colSpan}` }}
                              onClick={() => toggleMilestoneStatus(m.id)}
                              className={`${theme.bg} ${theme.text} ${theme.border} border rounded-xl px-2.5 py-1 text-[10px] font-extrabold flex items-center justify-between shadow-2xs hover:shadow-md transition-all cursor-pointer`}
                              title={m.name}
                            >
                              <div className="flex items-center gap-1 min-w-0 truncate">
                                <span className="text-xs flex-shrink-0">{theme.icon}</span>
                                <span className="truncate">{m.name}</span>
                              </div>

                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${theme.border} ${theme.bg} flex-shrink-0 ml-1`}>
                                {colSpan} Hari
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real ClickUp Tasks Timeline Section */}
          {realTasks.length > 0 && (
            <div className="pt-4 border-t border-[#E8E8EC] space-y-3">
              <h4 className="text-xs font-extrabold text-[#24324A] uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-[#F26B5E]" />
                <span>Task Live ClickUp Schedule ({realTasks.length})</span>
              </h4>

              <div className="border border-[#E8E8EC] rounded-2xl p-4 bg-[#FFFFFF] relative min-h-[160px]">
                <div className="absolute inset-0 grid grid-cols-7 divide-x divide-[#E8E8EC]/40 pointer-events-none" />
                <div className="relative z-10 space-y-2.5">
                  {realTasks.map((t) => {
                    const dueD = t.due_date ? new Date(t.due_date).getDate() : 5;
                    const startD = t.start_date ? new Date(t.start_date).getDate() : Math.max(2, dueD - 3);

                    const startCol = Math.max(0, Math.min(6, startD - 2));
                    const endCol = Math.max(startCol, Math.min(6, dueD - 2));
                    const colSpan = Math.max(1, endCol - startCol + 1);

                    const isComplete = t.status === 'completed' || (t as any).status?.type === 'closed';

                    return (
                      <div key={t.id} className="grid grid-cols-7 gap-2">
                        <div
                          style={{ gridColumnStart: startCol + 1, gridColumnEnd: `span ${colSpan}` }}
                          onClick={() => {
                            setSelectedTask(t);
                            setIsTaskDrawerOpen(true);
                          }}
                          className={`p-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs border cursor-pointer ${
                            isComplete
                              ? 'bg-[#E3F8E9] text-[#1D7434] border-[#B4ECC2]'
                              : 'bg-[#E8F1FF] text-[#1E56B3] border-[#BDD7FF]'
                          }`}
                        >
                          <span className="truncate mr-2">{t.task_name}</span>
                          <span className="text-[10px] opacity-80 font-mono flex-shrink-0">
                            Due: {new Date(t.due_date).getDate()} Ags
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
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

      {/* TAB 6: ACTIVITY LOG & AUDIT TRAIL */}
      {activeTab === 'activity' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E8EC] pb-4">
            <div>
              <h3 className="text-base font-extrabold text-[#24324A] flex items-center gap-2">
                <History className="w-5 h-5 text-[#F26B5E]" />
                <span>Riwayat & Audit Trail Aktivitas Project</span>
              </h3>
              <p className="text-xs text-[#737680] mt-0.5">
                Pencatatan real-time seluruh aktivitas & updates per user di project ini.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Filter per user */}
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-[#E8E8EC] rounded-lg bg-[#F7F7F8] text-[#24324A] outline-none cursor-pointer"
              >
                <option value="all">Semua Member Tim</option>
                {clickupMembers.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setIsAddLogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#24324A] text-white text-xs font-semibold rounded-lg hover:bg-[#1A2536] transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-[#F26B5E]" />
                <span>Catat Aktivitas</span>
              </button>
            </div>
          </div>

          {/* Activity Log Feed */}
          {(() => {
            const logsToDisplay = (meta.activityLogs || []).filter(
              (act) => filterUser === 'all' || act.user_name.toLowerCase() === filterUser.toLowerCase()
            );

            if (logsToDisplay.length === 0) {
              return (
                <div className="p-8 text-center text-xs text-[#737680] border border-dashed border-[#E8E8EC] rounded-xl">
                  Belum ada aktivitas tercatat untuk filter ini. Klik &quot;Catat Aktivitas&quot; di atas untuk menambahkan catatan log baru.
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {logsToDisplay.map((act) => (
                  <div
                    key={act.id}
                    className="p-4 border border-[#E8E8EC] rounded-xl bg-[#FFFFFF] hover:bg-[#F7F7F8] transition-colors flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          act.user_avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(act.user_name)}&background=24324A&color=F26B5E&font-size=0.4&bold=true`
                        }
                        alt={act.user_name}
                        className="w-9 h-9 rounded-full object-cover border border-[#E8E8EC] flex-shrink-0"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#24324A]">{act.user_name}</span>
                          <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-[#EEF2F7] text-[#24324A] border border-[#E8E8EC]">
                            {act.action}
                          </span>
                          <span className="font-semibold text-[#202124]">{act.entity_name}</span>
                        </div>
                        {act.details && <p className="text-[#737680] text-[11px] leading-relaxed">{act.details}</p>}
                        <span className="text-[10px] font-mono text-[#737680] block pt-0.5">
                          {new Date(act.timestamp).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const updatedLogs = meta.activityLogs.filter((l) => l.id !== act.id);
                        updateMeta({ ...meta, activityLogs: updatedLogs });
                      }}
                      className="p-1 text-[#737680] hover:text-[#D95858] cursor-pointer"
                      title="Hapus Log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
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
        defaultListId={projectId}
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
                  <label className="block text-xs font-bold text-[#202124] mb-1">Status Project Overall</label>
                  <select
                    value={meta.status || currentProject.status}
                    onChange={(e) => setMeta({ ...meta, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8EC] rounded-lg font-bold text-[#24324A] focus:outline-none focus:border-[#24324A]"
                  >
                    <option value="in_progress">🚀 In Progress (Sedang Berjalan)</option>
                    <option value="planning">📝 Planning (Perencanaan)</option>
                    <option value="on_hold">⏸️ On Hold (Tertunda)</option>
                    <option value="completed">✅ Completed (Selesai 100%)</option>
                  </select>
                </div>

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
            <div className="w-full max-w-lg bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8EC] bg-[#F7F7F8]">
                <h2 className="text-sm font-bold text-[#24324A] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#F26B5E]" />
                  <span>Atur Informasi Klien Project</span>
                </h2>
                <button onClick={() => setIsEditClientOpen(false)} className="p-1 text-[#737680] hover:text-[#202124]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {/* 2 Clear Options Tab Buttons */}
                <div className="grid grid-cols-2 p-1 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl font-bold">
                  <button
                    type="button"
                    onClick={() => setClientMode('select')}
                    className={`py-2 px-3 rounded-lg text-xs transition-all cursor-pointer ${
                      clientMode === 'select'
                        ? 'bg-[#FFFFFF] text-[#24324A] shadow-2xs font-extrabold'
                        : 'text-[#737680] hover:text-[#202124]'
                    }`}
                  >
                    1. Pilih dari Daftar Klien
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode('manual')}
                    className={`py-2 px-3 rounded-lg text-xs transition-all cursor-pointer ${
                      clientMode === 'manual'
                        ? 'bg-[#FFFFFF] text-[#24324A] shadow-2xs font-extrabold'
                        : 'text-[#737680] hover:text-[#202124]'
                    }`}
                  >
                    2. Input Manual Klien Baru
                  </button>
                </div>

                {/* OPTION 1: PILIH DARI DAFTAR KLIEN */}
                {clientMode === 'select' && (
                  <div className="space-y-4 pt-1">
                    <div>
                      <label className="block font-bold text-[#24324A] mb-1">
                        Pilih Klien dari Client Listing *
                      </label>
                      <select
                        value={selectedListingClientId}
                        onChange={(e) => {
                          const cId = e.target.value;
                          setSelectedListingClientId(cId);
                          const chosen = existingClientsList.find((c) => c.id === cId || c.company_name === cId);
                          if (chosen) {
                            setMeta({
                              ...meta,
                              clientInfo: {
                                name: chosen.name || `PIC ${chosen.company_name}`,
                                company_name: chosen.company_name,
                                industry: chosen.industry || 'Digital Agency',
                                email: chosen.email || 'contact@clientcompany.com',
                              },
                            });
                          }
                        }}
                        className="w-full px-3 py-2.5 border border-[#E8E8EC] rounded-xl bg-[#FFFFFF] font-semibold text-[#24324A] focus:outline-none focus:border-[#24324A]"
                      >
                        {existingClientsList.length === 0 ? (
                          <option value="">Belum ada klien terdaftar</option>
                        ) : (
                          existingClientsList.map((c) => (
                            <option key={c.id || c.company_name} value={c.id || c.company_name}>
                              {c.company_name} ({c.name}) - {c.industry}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="p-3.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl space-y-1.5">
                      <p className="text-[11px] font-bold text-[#24324A]">Preview Data Klien Terpilih:</p>
                      <p className="text-[11px] text-[#737680]">PIC: <strong className="text-[#202124]">{meta.clientInfo.name}</strong></p>
                      <p className="text-[11px] text-[#737680]">Perusahaan: <strong className="text-[#202124]">{meta.clientInfo.company_name}</strong></p>
                      <p className="text-[11px] text-[#737680]">Industri: <strong className="text-[#202124]">{meta.clientInfo.industry}</strong></p>
                      <p className="text-[11px] text-[#737680]">Email: <strong className="text-[#F26B5E]">{meta.clientInfo.email}</strong></p>
                    </div>
                  </div>
                )}

                {/* OPTION 2: INPUT MANUAL KLIEN BARU (AUTO-SAVE TO CLIENT LISTING) */}
                {clientMode === 'manual' && (
                  <div className="space-y-3 pt-1">
                    <p className="text-[11px] text-[#737680]">
                      * Data klien baru yang dimasukkan akan <strong>otomatis tersimpan ke Client Listing (`/clients`)</strong> secara permanen.
                    </p>
                    <div>
                      <label className="block font-semibold text-[#202124] mb-1">Nama Klien PIC *</label>
                      <input
                        type="text"
                        required
                        value={meta.clientInfo.name}
                        onChange={(e) => setMeta({ ...meta, clientInfo: { ...meta.clientInfo, name: e.target.value } })}
                        placeholder="Contoh: Budi Santoso"
                        className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#202124] mb-1">Perusahaan / Brand *</label>
                      <input
                        type="text"
                        required
                        value={meta.clientInfo.company_name}
                        onChange={(e) => setMeta({ ...meta, clientInfo: { ...meta.clientInfo, company_name: e.target.value } })}
                        placeholder="Contoh: PT Tokopedia Indonesia"
                        className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#202124] mb-1">Industri</label>
                      <input
                        type="text"
                        value={meta.clientInfo.industry}
                        onChange={(e) => setMeta({ ...meta, clientInfo: { ...meta.clientInfo, industry: e.target.value } })}
                        placeholder="Contoh: E-Commerce / FMCG"
                        className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#202124] mb-1">Email Kontak</label>
                      <input
                        type="email"
                        value={meta.clientInfo.email}
                        onChange={(e) => setMeta({ ...meta, clientInfo: { ...meta.clientInfo, email: e.target.value } })}
                        placeholder="contact@brand.com"
                        className="w-full px-3 py-2 border border-[#E8E8EC] rounded-xl"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E8EC]">
                  <button
                    type="button"
                    onClick={() => setIsEditClientOpen(false)}
                    className="px-4 py-2 text-[#737680] hover:bg-[#F7F7F8] rounded-xl cursor-pointer font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Save meta to project
                      updateMeta(meta);

                      // If manual mode, automatically push to Client Listing (localStorage)
                      if (clientMode === 'manual' && meta.clientInfo.company_name) {
                        const newCustomClient = {
                          id: 'c_custom_' + Date.now(),
                          name: meta.clientInfo.name || `PIC ${meta.clientInfo.company_name}`,
                          company_name: meta.clientInfo.company_name,
                          email: meta.clientInfo.email || `contact@${meta.clientInfo.company_name.toLowerCase().replace(/\s+/g, '')}.id`,
                          phone: '+62 812-0000-0000',
                          logo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(meta.clientInfo.company_name)}&background=24324A&color=fff`,
                          status: 'active',
                          industry: meta.clientInfo.industry || 'Digital Agency',
                          clickup_folder_id: 'folder_custom_' + Date.now(),
                          overall_progress: 0,
                          notes: `Didaftarkan otomatis dari Project ${realProject?.name || ''}`,
                          start_date: new Date().toISOString().split('T')[0],
                          account_manager_id: 'u1',
                          active_projects_count: 1,
                          completed_projects_count: 0,
                          total_tasks_count: 0,
                        };

                        const savedCustomStr = localStorage.getItem('bilik_custom_clients');
                        let customList = [];
                        if (savedCustomStr) {
                          try { customList = JSON.parse(savedCustomStr); } catch {}
                        }
                        if (!customList.some((c: any) => c.company_name.toLowerCase() === meta.clientInfo.company_name.toLowerCase())) {
                          localStorage.setItem('bilik_custom_clients', JSON.stringify([newCustomClient, ...customList]));
                        }
                      }

                      setIsEditClientOpen(false);
                    }}
                    className="px-5 py-2 font-bold text-white bg-[#24324A] hover:bg-[#1A2536] rounded-xl shadow-xs cursor-pointer"
                  >
                    Simpan Info Klien
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 3: EDIT TEAM MEMBERS MODAL (SELECT FROM CLICKUP) */}
      {isEditTeamOpen &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8EC] bg-[#F7F7F8]">
                <h2 className="text-sm font-bold text-[#24324A] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#F26B5E]" />
                  <span>Tambah Anggota Tim (Pilih dari ClickUp)</span>
                </h2>
                <button onClick={() => setIsEditTeamOpen(false)} className="p-1 text-[#737680] hover:text-[#202124]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e: any) => {
                  e.preventDefault();
                  const form = e.target;
                  const chosenMember = clickupMembers.find((m) => m.id === selectedClickUpMemberId);

                  const newMember: TeamMemberItem = {
                    id: chosenMember?.id || 'tm-' + Date.now(),
                    name: chosenMember?.name || form.memberName?.value || 'Anggota Tim',
                    role: form.memberRole.value || chosenMember?.role || 'Member',
                    email: chosenMember?.email || form.memberEmail?.value || '',
                    avatar_url: chosenMember?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                  };

                  if (!meta.teamMembers.some((tm) => tm.id === newMember.id || tm.name === newMember.name)) {
                    updateMeta({ ...meta, teamMembers: [...meta.teamMembers, newMember] });
                  }
                  setIsEditTeamOpen(false);
                }}
                className="p-6 space-y-4 text-xs"
              >
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">
                    Pilih Anggota Tim ClickUp Workspace *
                  </label>
                  <select
                    value={selectedClickUpMemberId}
                    onChange={(e) => setSelectedClickUpMemberId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E8E8EC] rounded-lg bg-[#FFFFFF] focus:outline-none focus:border-[#24324A]"
                  >
                    {clickupMembers.length === 0 ? (
                      <option value="">Memuat anggota tim ClickUp...</option>
                    ) : (
                      clickupMembers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role}) - {u.email}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Peran / Role di Project *</label>
                  <input
                    name="memberRole"
                    required
                    defaultValue="Project Lead & Specialist"
                    placeholder="Contoh: Senior UI/UX Designer, Creative Lead, Copywriter"
                    className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E8EC]">
                  <button
                    type="button"
                    onClick={() => setIsEditTeamOpen(false)}
                    className="px-4 py-2 text-[#737680] hover:bg-[#F7F7F8] rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 font-semibold text-white bg-[#24324A] hover:bg-[#1A2536] rounded-lg shadow-xs cursor-pointer"
                  >
                    Tambah Member ClickUp
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

      {/* MODAL 6: CATAT AKTIVITAS KUSTOM MODAL */}
      {isAddLogOpen &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8EC] bg-[#F7F7F8]">
                <h2 className="text-sm font-bold text-[#24324A] flex items-center gap-2">
                  <History className="w-4 h-4 text-[#F26B5E]" />
                  <span>Catat Aktivitas Project Kustom</span>
                </h2>
                <button onClick={() => setIsAddLogOpen(false)} className="p-1 text-[#737680] hover:text-[#202124]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e: any) => {
                  e.preventDefault();
                  const form = e.target;
                  const chosenMember = clickupMembers.find((m) => m.name === form.userSelect.value) || clickupMembers[0];

                  const newLog: ActivityLogItem = {
                    id: 'act-' + Date.now(),
                    user_name: chosenMember?.name || form.userSelect.value || 'Dinur Pradipta',
                    user_avatar: chosenMember?.avatar || 'https://attachments.clickup.com/profilePictures/276885530_r2L.jpg',
                    action: form.actionType.value,
                    entity_name: form.entityName.value,
                    details: form.details.value,
                    timestamp: new Date().toISOString(),
                  };

                  updateMeta({ ...meta, activityLogs: [newLog, ...meta.activityLogs] });
                  setIsAddLogOpen(false);
                }}
                className="p-6 space-y-4 text-xs"
              >
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Pilih Member / User *</label>
                  <select name="userSelect" className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg bg-[#FFFFFF]">
                    {clickupMembers.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.role}) - {m.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Jenis Aktivitas *</label>
                  <select name="actionType" className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg bg-[#FFFFFF]">
                    <option value="UPDATE TASK">UPDATE TASK</option>
                    <option value="CHANGE STATUS">CHANGE STATUS</option>
                    <option value="TAMBAH SUBTASK">TAMBAH SUBTASK</option>
                    <option value="SELESAIKAN MILESTONE">SELESAIKAN MILESTONE</option>
                    <option value="POST COMMENT">POST COMMENT</option>
                    <option value="UPLOAD FILE">UPLOAD FILE</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Nama Task / Target *</label>
                  <input
                    name="entityName"
                    required
                    placeholder="Contoh: Finalisasi Design Visual Banner 3D"
                    className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Catatan Detail Update</label>
                  <textarea
                    name="details"
                    rows={3}
                    placeholder="Tulis rincian perbaikan atau update yang dilakukan..."
                    className="w-full px-3 py-2 border border-[#E8E8EC] rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E8EC]">
                  <button
                    type="button"
                    onClick={() => setIsAddLogOpen(false)}
                    className="px-4 py-2 text-[#737680] hover:bg-[#F7F7F8] rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 font-semibold text-white bg-[#24324A] hover:bg-[#1A2536] rounded-lg shadow-xs cursor-pointer"
                  >
                    Simpan Aktivitas
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
      {/* TASK DETAIL DRAWER */}
      <TaskDetailDrawer
        task={selectedTask}
        isOpen={isTaskDrawerOpen}
        onClose={() => setIsTaskDrawerOpen(false)}
      />
    </div>
  );
}
