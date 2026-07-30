'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Search, Plus, Mail, Phone, ExternalLink, X, CheckCircle2, MessageSquare, Briefcase, RefreshCw } from 'lucide-react';
import { AgencyClient, AgencyProject } from '@/lib/mock/data';

export default function ClientsPage() {
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [projects, setProjects] = useState<AgencyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<AgencyClient | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchClientsAndProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clickup/projects');
      if (res.ok) {
        const data = await res.json();
        const liveProjects: AgencyProject[] = Array.isArray(data.projects) ? data.projects : [];
        setProjects(liveProjects);

        // Derive unique clients from projects
        const clientMap = new Map<string, AgencyClient>();

        liveProjects.forEach((p, idx) => {
          const clientName = p.client_name || 'Bilik Workspace Client';
          if (!clientMap.has(clientName)) {
            clientMap.set(clientName, {
              id: `c_${idx + 1}`,
              name: `PIC ${clientName}`,
              company_name: clientName,
              email: `contact@${clientName.toLowerCase().replace(/\s+/g, '')}.id`,
              phone: '+62 812-3456-7890',
              logo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(clientName)}&background=24324A&color=fff`,
              status: 'active',
              industry: 'Digital & Creative Agency',
              clickup_folder_id: p.clickup_list_id || `folder_${idx}`,
              overall_progress: p.progress_percentage || 50,
              notes: `Klien aktif terhubung langsung dengan ClickUp Space / List.`,
              start_date: '2026-01-01',
              account_manager_id: 'u1',
              active_projects_count: 1,
              completed_projects_count: 0,
              total_tasks_count: p.total_tasks || 5,
            });
          }
        });

        // Fallback default client if empty
        if (clientMap.size === 0) {
          clientMap.set('Bilik Workspace Client', {
            id: 'c_default',
            name: 'Workspace Admin',
            company_name: 'Bilik Workspace Client',
            email: 'admin@bilikstrategi.id',
            phone: '+62 812-0000-0000',
            logo_url: 'https://ui-avatars.com/api/?name=Bilik+Workspace&background=24324A&color=fff',
            status: 'active',
            industry: 'Agency Operation',
            clickup_folder_id: '90182855619',
            overall_progress: 100,
            notes: 'Workspace utama ClickUp.',
            start_date: '2026-01-01',
            account_manager_id: 'u1',
            active_projects_count: 1,
            completed_projects_count: 1,
            total_tasks_count: 10,
          });
        }

        setClients(Array.from(clientMap.values()));
      }
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsAndProjects();
  }, []);

  const filteredClients = clients.filter(
    (c) => c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Client Listing</h1>
          <p className="text-xs text-[#737680] mt-1">
            Manajemen direktori klien agency, pemetaan Folder ClickUp, dan histori retainer.
          </p>
        </div>

        <button
          onClick={fetchClientsAndProjects}
          className="flex items-center gap-2 px-4 py-2 border border-[#E8E8EC] bg-[#FFFFFF] rounded-xl text-xs font-bold text-[#24324A] hover:bg-[#EEF2F7] transition-colors self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Clients</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-[#FFFFFF] p-4 border border-[#E8E8EC] rounded-xl shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737680] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari perusahaan atau nama klien..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E8E8EC] rounded-lg focus:outline-none focus:border-[#24324A]"
          />
        </div>
      </div>

      {/* Empty State */}
      {!loading && filteredClients.length === 0 && (
        <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl p-12 text-center space-y-3 shadow-2xs">
          <Building2 className="w-10 h-10 text-[#737680] mx-auto opacity-40" />
          <h3 className="text-sm font-extrabold text-[#24324A]">Belum Ada Data Klien di ClickUp</h3>
        </div>
      )}

      {/* Client Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          const clientProjects = projects.filter((p) => (p.client_name || '').toLowerCase() === client.company_name.toLowerCase());
          return (
            <div
              key={client.id}
              onClick={() => { setSelectedClient(client); setDrawerOpen(true); }}
              className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs hover:border-[#24324A] cursor-pointer transition-all space-y-4 group"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={client.logo_url} alt={client.company_name} className="w-10 h-10 rounded-xl object-cover border border-[#E8E8EC]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#24324A] group-hover:text-[#F26B5E] transition-colors">{client.company_name}</h3>
                    <p className="text-xs text-[#737680]">{client.industry}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                  client.status === 'active' ? 'bg-[#EEF2F7] text-[#4F9D78]' : 'bg-[#FEF3D6] text-[#E6A23C]'
                }`}>
                  {client.status}
                </span>
              </div>

              {/* Contacts */}
              <div className="text-xs text-[#737680] space-y-1 pt-2 border-t border-[#E8E8EC]">
                <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-[#24324A]" /> {client.email}</p>
                <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-[#24324A]" /> {client.phone}</p>
              </div>

              {/* Progress & Projects */}
              <div className="pt-2 border-t border-[#E8E8EC] space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#737680]">Progress Overall Retainer:</span>
                  <span className="text-[#4F9D78]">{client.overall_progress}%</span>
                </div>
                <div className="w-full bg-[#EEF2F7] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#4F9D78] h-full rounded-full" style={{ width: `${client.overall_progress}%` }}></div>
                </div>
                <p className="text-[11px] text-[#737680]">
                  Active Projects: <strong className="text-[#24324A]">{clientProjects.length} Project</strong>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Client Detail Drawer */}
      {drawerOpen && selectedClient && mounted && createPortal(
        <div className="fixed inset-0 z-35 flex justify-end bg-black/50 backdrop-blur-xs">
          {/* Backdrop overlay click to close */}
          <div className="absolute inset-0" onClick={() => setDrawerOpen(false)} />

          <div className="relative z-10 w-full max-w-xl bg-[#FFFFFF] h-full shadow-2xl flex flex-col border-l border-[#E8E8EC] p-6 space-y-6 overflow-y-auto animate-slide-left">
            <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedClient.logo_url} alt={selectedClient.company_name} className="w-12 h-12 rounded-xl object-cover border border-[#E8E8EC]" />
                <div>
                  <h2 className="text-lg font-extrabold text-[#24324A]">{selectedClient.company_name}</h2>
                  <p className="text-xs text-[#737680]">Folder ClickUp ID: {selectedClient.clickup_folder_id}</p>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded-lg hover:bg-[#F7F7F8] text-[#737680]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <h3 className="font-bold text-[#24324A] text-sm">Informasi Detail Klien</h3>
              <p><strong>Nama Kontak:</strong> {selectedClient.name}</p>
              <p><strong>Email:</strong> {selectedClient.email}</p>
              <p><strong>Telepon:</strong> {selectedClient.phone}</p>
              <p><strong>Industri:</strong> {selectedClient.industry}</p>
              <p><strong>Tanggal Mulai Retainer:</strong> {selectedClient.start_date}</p>
              <p className="p-3 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg"><strong>Catatan Internal Agency:</strong> {selectedClient.notes}</p>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#E8E8EC]">
              <h3 className="font-bold text-[#24324A] text-sm flex items-center">
                <Briefcase className="w-4 h-4 mr-2 text-[#F26B5E]" /> Project Terkait
              </h3>
              <div className="space-y-2 text-xs">
                {projects.filter((p) => (p.client_name || '').toLowerCase() === selectedClient.company_name.toLowerCase()).map((p) => (
                  <div key={p.id} className="p-3 border border-[#E8E8EC] rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#24324A]">{p.name}</p>
                      <span className="text-[10px] text-[#737680]">{p.completed_tasks}/{p.total_tasks} Task Completed</span>
                    </div>
                    <span className="font-bold text-[#4F9D78]">{p.progress_percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
