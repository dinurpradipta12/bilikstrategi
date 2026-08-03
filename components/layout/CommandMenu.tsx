'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Search, PlusCircle, CheckSquare, Briefcase, Users, MessageSquare, Settings, X, ArrowRight } from 'lucide-react';

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateTask: () => void;
}

export default function CommandMenu({ isOpen, onClose, onOpenCreateTask }: CommandMenuProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    async function loadSearchData() {
      try {
        const [tasksRes, projectsRes, clientsRes] = await Promise.all([
          fetch('/api/supabase/tasks', { cache: 'no-store' }).catch(() => null),
          fetch('/api/supabase/projects', { cache: 'no-store' }).catch(() => null),
          fetch('/api/supabase/clients', { cache: 'no-store' }).catch(() => null),
        ]);

        if (tasksRes?.ok) {
          const data = await tasksRes.json();
          setTasks(Array.isArray(data.tasks) ? data.tasks : []);
        } else {
          setTasks([]);
        }

        if (projectsRes?.ok) {
          const data = await projectsRes.json();
          setProjects(Array.isArray(data.projects) ? data.projects : []);
        } else {
          setProjects([]);
        }

        if (clientsRes?.ok) {
          const data = await clientsRes.json();
          setClients(Array.isArray(data.clients) ? data.clients : []);
        } else {
          setClients([]);
        }
      } catch {
        setTasks([]);
        setProjects([]);
        setClients([]);
      }
    }

    loadSearchData();
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via parent or event
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const normalizedQuery = query.toLowerCase();
  const filteredTasks = tasks.filter((t) => (t.task_name || t.name || '').toLowerCase().includes(normalizedQuery));
  const filteredProjects = projects.filter((p) => (p.name || '').toLowerCase().includes(normalizedQuery));
  const filteredClients = clients.filter((c) => (c.company_name || c.name || '').toLowerCase().includes(normalizedQuery));

  const handleNavigate = (path: string) => {
    router.push(path);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-2xl bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl shadow-2xl overflow-hidden text-[#202124] relative z-[101]">
        {/* Header Search Input */}
        <div className="flex items-center px-4 border-b border-[#E8E8EC]">
          <Search className="w-5 h-5 text-[#737680] mr-3" />
          <input
            type="text"
            placeholder="Ketik perintah atau cari task, project, client... (Esc untuk menutup)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full py-4 text-sm bg-transparent outline-none placeholder-[#737680]"
            autoFocus
          />
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#F7F7F8] text-[#737680]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Menu Body */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-3">
          {/* Quick Actions */}
          {!query && (
            <div>
              <div className="px-3 py-1 text-xs font-semibold text-[#737680] uppercase tracking-wider">Aksi Cepat</div>
              <div className="mt-1 space-y-1">
                <button
                  onClick={() => { onClose(); onOpenCreateTask(); }}
                  className="w-full flex items-center px-3 py-2 text-sm rounded-lg hover:bg-[#EEF2F7] transition-colors text-left"
                >
                  <PlusCircle className="w-4 h-4 text-[#F26B5E] mr-3" />
                  <span className="font-medium text-[#24324A]">Buat Task Baru</span>
                  <span className="ml-auto text-xs text-[#737680]">Shortcut</span>
                </button>
                <button
                  onClick={() => handleNavigate('/my-tasks')}
                  className="w-full flex items-center px-3 py-2 text-sm rounded-lg hover:bg-[#EEF2F7] transition-colors text-left"
                >
                  <CheckSquare className="w-4 h-4 text-[#24324A] mr-3" />
                  <span>Buka My Tasks Saya</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-[#737680]" />
                </button>
                <button
                  onClick={() => handleNavigate('/chat')}
                  className="w-full flex items-center px-3 py-2 text-sm rounded-lg hover:bg-[#EEF2F7] transition-colors text-left"
                >
                  <MessageSquare className="w-4 h-4 text-[#24324A] mr-3" />
                  <span>Buka Agency Chat</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-[#737680]" />
                </button>
                <button
                  onClick={() => handleNavigate('/team')}
                  className="w-full flex items-center px-3 py-2 text-sm rounded-lg hover:bg-[#EEF2F7] transition-colors text-left"
                >
                  <Users className="w-4 h-4 text-[#24324A] mr-3" />
                  <span>Lihat Team Workload</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-[#737680]" />
                </button>
                <button
                  onClick={() => handleNavigate('/settings')}
                  className="w-full flex items-center px-3 py-2 text-sm rounded-lg hover:bg-[#EEF2F7] transition-colors text-left"
                >
                  <Settings className="w-4 h-4 text-[#737680] mr-3" />
                  <span>Pengaturan ClickUp Integration</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-[#737680]" />
                </button>
              </div>
            </div>
          )}

          {/* Search Results */}
          {query && (
            <>
              {filteredTasks.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-xs font-semibold text-[#737680] uppercase tracking-wider">Task ({filteredTasks.length})</div>
                  {filteredTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleNavigate(`/tasks?id=${t.id}`)}
                      className="w-full flex items-center px-3 py-2 text-sm rounded-lg hover:bg-[#EEF2F7] text-left"
                    >
                      <CheckSquare className="w-4 h-4 text-[#4F9D78] mr-3 flex-shrink-0" />
                      <span className="truncate text-[#202124]">{t.task_name || t.name}</span>
                      <span className="ml-auto text-xs px-2 py-0.5 bg-[#EEF2F7] rounded text-[#24324A] uppercase">{t.status || 'to do'}</span>
                    </button>
                  ))}
                </div>
              )}

              {filteredProjects.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-xs font-semibold text-[#737680] uppercase tracking-wider">Project ({filteredProjects.length})</div>
                  {filteredProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleNavigate(`/projects/${p.id}`)}
                      className="w-full flex items-center px-3 py-2 text-sm rounded-lg hover:bg-[#EEF2F7] text-left"
                    >
                      <Briefcase className="w-4 h-4 text-[#24324A] mr-3 flex-shrink-0" />
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="ml-auto text-xs text-[#737680]">{p.client_name || p.status || ''}</span>
                    </button>
                  ))}
                </div>
              )}

              {filteredClients.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-xs font-semibold text-[#737680] uppercase tracking-wider">Client ({filteredClients.length})</div>
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleNavigate(`/clients?id=${c.id}`)}
                      className="w-full flex items-center px-3 py-2 text-sm rounded-lg hover:bg-[#EEF2F7] text-left"
                    >
                      <Users className="w-4 h-4 text-[#F26B5E] mr-3 flex-shrink-0" />
                      <span className="truncate font-medium">{c.company_name || c.name}</span>
                      <span className="ml-auto text-xs text-[#737680]">{c.industry || ''}</span>
                    </button>
                  ))}
                </div>
              )}

              {filteredTasks.length === 0 && filteredProjects.length === 0 && filteredClients.length === 0 && (
                <div className="py-8 text-center text-sm text-[#737680]">
                  Tidak ada hasil yang cocok dengan &quot;{query}&quot;.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#F7F7F8] border-t border-[#E8E8EC] text-xs text-[#737680] flex items-center justify-between">
          <span>Tekan <kbd className="px-1.5 py-0.5 bg-white border border-[#E8E8EC] rounded text-[10px]">Esc</kbd> untuk menutup</span>
          <span>Bilik Strategi Workspace v1.0</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
