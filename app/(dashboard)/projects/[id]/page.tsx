'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { MOCK_PROJECTS, MOCK_TASKS, MOCK_USERS, MOCK_CLIENTS, MOCK_ACTIVITY_LOGS } from '@/lib/mock/data';

type ProjectTab = 'overview' | 'tasks' | 'timeline' | 'team' | 'files' | 'activity' | 'feedback';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');

  const project = MOCK_PROJECTS.find((p) => p.id === projectId) || MOCK_PROJECTS[0];
  const projectTasks = MOCK_TASKS.filter((t) => t.project_id === project.id);
  const client = MOCK_CLIENTS.find((c) => c.id === project.client_id) || MOCK_CLIENTS[0];

  return (
    <div className="space-y-6 animate-fade-in">
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
                {project.client_name}
              </span>
              <span className="text-xs text-[#737680]">ClickUp List ID: {project.clickup_list_id}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#24324A]">{project.name}</h1>
            <p className="text-xs text-[#737680] max-w-2xl">{project.description}</p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`https://app.clickup.com`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 border border-[#E8E8EC] text-xs font-semibold text-[#24324A] rounded-xl hover:bg-[#EEF2F7] transition-colors"
            >
              <span>Buka di ClickUp</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#F26B5E]" />
            </a>
          </div>
        </div>

        {/* Project Key Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#E8E8EC] text-xs">
          <div>
            <span className="text-[#737680] block text-[11px]">Team Lead PIC</span>
            <span className="font-semibold text-[#202124]">{project.team_lead_name}</span>
          </div>
          <div>
            <span className="text-[#737680] block text-[11px]">Batas Waktu (Due Date)</span>
            <span className="font-semibold text-[#202124]">{project.due_date}</span>
          </div>
          <div>
            <span className="text-[#737680] block text-[11px]">Penyelesaian Task</span>
            <span className="font-semibold text-[#4F9D78]">
              {project.completed_tasks} / {project.total_tasks} Selesai ({project.progress_percentage}%)
            </span>
          </div>
          <div>
            <span className="text-[#737680] block text-[11px]">Status Overall</span>
            <span className="font-bold text-[#24324A] capitalize">{project.status.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E8E8EC] overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: Briefcase },
          { id: 'tasks', label: `Tasks (${projectTasks.length})`, icon: CheckSquare },
          { id: 'timeline', label: 'Timeline', icon: Calendar },
          { id: 'team', label: 'Team Members', icon: Users },
          { id: 'files', label: 'Files & Assets', icon: Paperclip },
          { id: 'activity', label: 'Activity Log', icon: History },
          { id: 'feedback', label: 'Client Feedback', icon: MessageSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ProjectTab)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
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

      {/* TAB CONTENT */}

      {/* 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-[#24324A]">Deskripsi Deliverable & Scope</h3>
              <p className="text-xs text-[#737680] leading-relaxed">{project.description}</p>

              <div className="pt-4 border-t border-[#E8E8EC]">
                <h4 className="text-xs font-bold text-[#24324A] mb-2">Milestone Utama Project</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-[#4F9D78]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Kickoff Meeting & Brief Approval (15 Juni 2026)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#4F9D78]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Konsep Visual Key Visual (01 Juli 2026)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#24324A] font-semibold">
                    <Clock className="w-4 h-4 text-[#E6A23C]" />
                    <span>Render Asset 3D & TVC Storyboard (In Progress)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#737680]">
                    <span className="w-4 h-4 rounded-full border border-[#E8E8EC] block" />
                    <span>Final Launch & Handover Ke Klien (31 Agustus 2026)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-[#24324A]">Informasi Klien</h3>
              <div className="text-xs space-y-2">
                <p><strong className="text-[#202124]">Klien:</strong> {client.name}</p>
                <p><strong className="text-[#202124]">Perusahaan:</strong> {client.company_name}</p>
                <p><strong className="text-[#202124]">Industri:</strong> {client.industry}</p>
                <p><strong className="text-[#202124]">Email Kontak:</strong> {client.email}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. TASKS */}
      {activeTab === 'tasks' && (
        <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#24324A]">Daftar Task ClickUp Terkait ({projectTasks.length})</h3>
            <Link href="/tasks" className="text-xs font-semibold text-[#F26B5E] hover:underline">
              Kelola di Task View →
            </Link>
          </div>

          <div className="divide-y divide-[#E8E8EC]">
            {projectTasks.map((t) => (
              <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-[#202124]">{t.task_name}</h4>
                  <p className="text-[11px] text-[#737680]">{t.description}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-[#EEF2F7] text-[#24324A] rounded uppercase">
                    {t.status}
                  </span>
                  <span className="text-[#737680]">{t.assignee_names.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs text-center py-12">
          <Calendar className="w-8 h-8 text-[#24324A] mx-auto mb-2" />
          <h3 className="text-sm font-bold text-[#24324A]">Project Timeline & Gantt Chart</h3>
          <p className="text-xs text-[#737680] mt-1">Estimasi pengerjaan: {project.start_date} s/d {project.due_date}</p>
        </div>
      )}

      {/* 4. TEAM */}
      {activeTab === 'team' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#24324A]">Anggota Tim Terlibat</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_USERS.filter((u) => u.role !== 'client').slice(0, 4).map((u) => (
              <div key={u.id} className="p-3 border border-[#E8E8EC] rounded-lg flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.avatar_url} alt={u.full_name} className="w-8 h-8 rounded-full object-cover" />
                <div>
                  <p className="text-xs font-bold text-[#202124]">{u.full_name}</p>
                  <p className="text-[10px] text-[#737680] capitalize">{u.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. FILES */}
      {activeTab === 'files' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#24324A]">Lampiran & Asset Project</h3>
          <div className="space-y-2 text-xs">
            <div className="p-3 border border-[#E8E8EC] rounded-lg flex items-center justify-between">
              <span className="font-semibold text-[#202124]">Key_Visual_Billboard_3D_v2.figma</span>
              <span className="text-[#F26B5E] cursor-pointer hover:underline">Unduh / Buka</span>
            </div>
            <div className="p-3 border border-[#E8E8EC] rounded-lg flex items-center justify-between">
              <span className="font-semibold text-[#202124]">Brief_Nusantara_Campaign_2026.pdf</span>
              <span className="text-[#F26B5E] cursor-pointer hover:underline">Unduh / Buka</span>
            </div>
          </div>
        </div>
      )}

      {/* 6. ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#24324A]">Riwayat Aktivitas Project</h3>
          <div className="space-y-3 text-xs">
            {MOCK_ACTIVITY_LOGS.map((act) => (
              <div key={act.id} className="p-3 border-b border-[#E8E8EC]">
                <p><strong>{act.user_name}:</strong> {act.action} - {act.entity_name}</p>
                <span className="text-[10px] text-[#737680]">{act.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. CLIENT FEEDBACK */}
      {activeTab === 'feedback' && (
        <div className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#24324A]">Catatan Feedback Klien</h3>
          <div className="p-4 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-xs space-y-2">
            <p className="font-bold text-[#24324A]">{client.name} (Nusantara Retail Group):</p>
            <p className="text-[#737680] italic">&quot;{client.recent_feedback || 'Belum ada feedback baru.'}&quot;</p>
          </div>
        </div>
      )}
    </div>
  );
}
