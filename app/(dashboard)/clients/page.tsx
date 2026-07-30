'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Search,
  Plus,
  Mail,
  Phone,
  ExternalLink,
  X,
  CheckCircle2,
  MessageSquare,
  Briefcase,
  RefreshCw,
  Trash2,
  Edit3,
  AlertTriangle,
  Send,
  Sparkles,
} from 'lucide-react';
import { AgencyClient, AgencyProject } from '@/lib/mock/data';

export default function ClientsPage() {
  const [mounted, setMounted] = useState(false);
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [projects, setProjects] = useState<AgencyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<AgencyClient | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<AgencyClient | null>(null);
  const [clientToDelete, setClientToDelete] = useState<AgencyClient | null>(null);

  // Form State
  const [formCompany, setFormCompany] = useState('');
  const [formPIC, setFormPIC] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIndustry, setFormIndustry] = useState('Digital Agency');
  const [formStatus, setFormStatus] = useState<'active' | 'lead' | 'archived'>('active');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Load Clients & Projects (Merge ClickUp Projects + LocalStorage Custom Clients)
  const fetchClientsAndProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clickup/projects');
      let liveProjects: AgencyProject[] = [];
      if (res.ok) {
        const data = await res.json();
        liveProjects = Array.isArray(data.projects) ? data.projects : [];
        setProjects(liveProjects);
      }

      // Derived ClickUp Clients
      const clientMap = new Map<string, AgencyClient>();

      liveProjects.forEach((p, idx) => {
        const clientName = p.client_name || 'Bilik Workspace Client';
        if (!clientMap.has(clientName)) {
          clientMap.set(clientName, {
            id: `c_cu_${idx + 1}`,
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

      // Default client fallback if empty
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

      // Merge saved custom clients from localStorage
      const savedCustomStr = localStorage.getItem('bilik_custom_clients');
      if (savedCustomStr) {
        try {
          const customClients: AgencyClient[] = JSON.parse(savedCustomStr);
          customClients.forEach((cc) => {
            clientMap.set(cc.company_name, cc);
          });
        } catch {
          // ignore parse error
        }
      }

      setClients(Array.from(clientMap.values()));
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientsAndProjects();
  }, []);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingClient(null);
    setFormCompany('');
    setFormPIC('');
    setFormEmail('');
    setFormPhone('');
    setFormIndustry('Digital Agency');
    setFormStatus('active');
    setFormNotes('');
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (client: AgencyClient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingClient(client);
    setFormCompany(client.company_name);
    setFormPIC(client.name);
    setFormEmail(client.email);
    setFormPhone(client.phone);
    setFormIndustry(client.industry);
    setFormStatus(client.status as any);
    setFormNotes(client.notes);
    setShowAddModal(true);
  };

  // Save / Add Client
  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompany.trim()) return;

    let updatedList: AgencyClient[] = [];

    if (editingClient) {
      // Update existing
      updatedList = clients.map((c) => {
        if (c.id === editingClient.id) {
          return {
            ...c,
            company_name: formCompany,
            name: formPIC || `PIC ${formCompany}`,
            email: formEmail || `contact@${formCompany.toLowerCase().replace(/\s+/g, '')}.id`,
            phone: formPhone || '+62 812-0000-0000',
            industry: formIndustry,
            status: formStatus,
            notes: formNotes || 'Klien Agency',
            logo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(formCompany)}&background=24324A&color=fff`,
          };
        }
        return c;
      });
    } else {
      // Add new client
      const newClient: AgencyClient = {
        id: 'c_custom_' + Date.now(),
        name: formPIC || `PIC ${formCompany}`,
        company_name: formCompany,
        email: formEmail || `contact@${formCompany.toLowerCase().replace(/\s+/g, '')}.id`,
        phone: formPhone || '+62 812-0000-0000',
        logo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(formCompany)}&background=24324A&color=fff`,
        status: formStatus,
        industry: formIndustry,
        clickup_folder_id: 'folder_custom_' + Date.now(),
        overall_progress: 0,
        notes: formNotes || 'Klien Baru Didaftarkan',
        start_date: new Date().toISOString().split('T')[0],
        account_manager_id: 'u1',
        active_projects_count: 0,
        completed_projects_count: 0,
        total_tasks_count: 0,
      };
      updatedList = [newClient, ...clients];
    }

    setClients(updatedList);

    // Save custom clients to localStorage
    const customOnly = updatedList.filter((c) => c.id.startsWith('c_custom_') || c.id === editingClient?.id);
    localStorage.setItem('bilik_custom_clients', JSON.stringify(customOnly));

    setShowAddModal(false);
  };

  // Delete Client
  const handleDeleteClient = (client: AgencyClient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClientToDelete(client);
  };

  const confirmDeleteClient = () => {
    if (!clientToDelete) return;

    const updatedList = clients.filter((c) => c.id !== clientToDelete.id);
    setClients(updatedList);

    // Update localStorage
    const customOnly = updatedList.filter((c) => c.id.startsWith('c_custom_'));
    localStorage.setItem('bilik_custom_clients', JSON.stringify(customOnly));

    if (selectedClient?.id === clientToDelete.id) {
      setDrawerOpen(false);
      setSelectedClient(null);
    }
    setClientToDelete(null);
  };

  const filteredClients = clients.filter(
    (c) =>
      c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E8EC] pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Client Listing</h1>
          <p className="text-xs text-[#737680] mt-1">
            Manajemen direktori klien agency, penambahan klien baru, pemetaan Folder ClickUp, dan histori retainer.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#24324A] text-white rounded-xl text-xs font-extrabold hover:bg-[#1A2536] transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#F26B5E]" />
            <span>+ Tambah Client Baru</span>
          </button>

          <button
            onClick={fetchClientsAndProjects}
            className="flex items-center gap-2 px-4 py-2 border border-[#E8E8EC] bg-[#FFFFFF] rounded-xl text-xs font-bold text-[#24324A] hover:bg-[#EEF2F7] transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Clients</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-[#FFFFFF] p-4 border border-[#E8E8EC] rounded-xl shadow-2xs flex items-center justify-between">
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
        <span className="text-xs font-bold text-[#737680]">Total {filteredClients.length} Klien Terdaftar</span>
      </div>

      {/* Empty State */}
      {!loading && filteredClients.length === 0 && (
        <div className="bg-[#FFFFFF] border border-[#E8E8EC] rounded-xl p-12 text-center space-y-3 shadow-2xs">
          <Building2 className="w-10 h-10 text-[#737680] mx-auto opacity-40" />
          <h3 className="text-sm font-extrabold text-[#24324A]">Belum Ada Data Klien</h3>
          <p className="text-xs text-[#737680]">Klik tombol "+ Tambah Client Baru" di atas untuk mendaftarkan klien agency pertama Anda.</p>
        </div>
      )}

      {/* Client Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          const clientProjects = projects.filter(
            (p) => (p.client_name || '').toLowerCase() === client.company_name.toLowerCase()
          );
          return (
            <div
              key={client.id}
              onClick={() => {
                setSelectedClient(client);
                setDrawerOpen(true);
              }}
              className="p-6 bg-[#FFFFFF] border border-[#E8E8EC] rounded-2xl shadow-2xs hover:border-[#24324A] cursor-pointer transition-all space-y-4 group relative"
            >
              {/* Card Action Buttons (Edit & Delete) */}
              <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  type="button"
                  onClick={(e) => handleOpenEditModal(client, e)}
                  title="Edit Klien"
                  className="p-1.5 bg-white border border-[#E8E8EC] rounded-lg hover:bg-[#EEF2F7] text-[#24324A] cursor-pointer shadow-xs transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteClient(client, e)}
                  title="Hapus Klien"
                  className="p-1.5 bg-white border border-[#E8E8EC] rounded-lg hover:bg-[#F26B5E]/10 text-[#F26B5E] cursor-pointer shadow-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Header */}
              <div className="flex items-center justify-between pr-14">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={client.logo_url}
                    alt={client.company_name}
                    className="w-10 h-10 rounded-xl object-cover border border-[#E8E8EC]"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-[#24324A] group-hover:text-[#F26B5E] transition-colors truncate max-w-[150px]">
                      {client.company_name}
                    </h3>
                    <p className="text-xs text-[#737680] truncate max-w-[150px]">{client.industry}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#737680] font-semibold">Status Retainer:</span>
                <span
                  className={`px-2.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                    client.status === 'active' ? 'bg-[#EEF2F7] text-[#4F9D78]' : 'bg-[#FEF3D6] text-[#E6A23C]'
                  }`}
                >
                  {client.status}
                </span>
              </div>

              {/* Contacts */}
              <div className="text-xs text-[#737680] space-y-1 pt-2 border-t border-[#E8E8EC]">
                <p className="flex items-center gap-2 truncate">
                  <Mail className="w-3.5 h-3.5 text-[#24324A] flex-shrink-0" /> {client.email}
                </p>
                <p className="flex items-center gap-2 truncate">
                  <Phone className="w-3.5 h-3.5 text-[#24324A] flex-shrink-0" /> {client.phone}
                </p>
              </div>

              {/* Progress & Projects */}
              <div className="pt-2 border-t border-[#E8E8EC] space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[#737680]">Progress Retainer:</span>
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
          <div className="absolute inset-0" onClick={() => setDrawerOpen(false)} />

          <div className="relative z-10 w-full max-w-xl bg-[#FFFFFF] h-full shadow-2xl flex flex-col border-l border-[#E8E8EC] p-6 space-y-6 overflow-y-auto animate-slide-left">
            <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedClient.logo_url}
                  alt={selectedClient.company_name}
                  className="w-12 h-12 rounded-xl object-cover border border-[#E8E8EC]"
                />
                <div>
                  <h2 className="text-lg font-extrabold text-[#24324A]">{selectedClient.company_name}</h2>
                  <p className="text-xs text-[#737680]">Folder ClickUp ID: {selectedClient.clickup_folder_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(selectedClient)}
                  className="p-2 bg-[#F7F7F8] border border-[#E8E8EC] rounded-lg hover:bg-[#EEF2F7] text-[#24324A] text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => handleDeleteClient(selectedClient)}
                  className="p-2 bg-[#F26B5E]/10 border border-[#F26B5E]/30 rounded-lg hover:bg-[#F26B5E]/20 text-[#F26B5E] text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
                <button onClick={() => setDrawerOpen(false)} className="p-1 rounded-lg hover:bg-[#F7F7F8] text-[#737680] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <h3 className="font-bold text-[#24324A] text-sm">Informasi Detail Klien</h3>
              <p><strong>Nama Contact Person (PIC):</strong> {selectedClient.name}</p>
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
                {projects
                  .filter((p) => (p.client_name || '').toLowerCase() === selectedClient.company_name.toLowerCase())
                  .map((p) => (
                    <div key={p.id} className="p-3 border border-[#E8E8EC] rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-bold text-[#24324A]">{p.name}</p>
                        <span className="text-[10px] text-[#737680]">
                          {p.completed_tasks}/{p.total_tasks} Task Completed
                        </span>
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

      {/* Modal Add / Edit Client */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#24324A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-3">
              <Building2 className="w-5 h-5 text-[#24324A]" />
              <h3 className="text-base font-extrabold text-[#24324A]">
                {editingClient ? 'Edit Data Klien' : 'Tambah Client Baru'}
              </h3>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#24324A] mb-1">Nama Perusahaan / Klien *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Tokopedia Indonesia / Brand Creative"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Nama Contact Person (PIC)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Budi Santoso"
                    value={formPIC}
                    onChange={(e) => setFormPIC(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Industri</label>
                  <input
                    type="text"
                    placeholder="Contoh: E-Commerce / FMCG"
                    value={formIndustry}
                    onChange={(e) => setFormIndustry(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Email Klien</label>
                  <input
                    type="email"
                    placeholder="contact@brand.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Telepon / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+62 812-3456-7890"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Status Retainer</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-bold outline-none focus:border-[#24324A]"
                >
                  <option value="active">Active (Retainer Berjalan)</option>
                  <option value="lead">Lead (Prospek Baru)</option>
                  <option value="archived">Archived (Selesai / Non-Aktif)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Catatan Internal Agency</label>
                <textarea
                  rows={2}
                  placeholder="Catatan paket retainer, requirement khusus, dll."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl font-bold hover:text-[#24324A] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#24324A] hover:bg-[#1A2536] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-[#F26B5E]" />
                  <span>{editingClient ? 'Simpan Perubahan' : 'Tambah Client'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal Delete Client */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-[#24324A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <AlertTriangle className="w-10 h-10 text-[#F26B5E] mx-auto" />
            <h3 className="text-base font-extrabold text-[#24324A]">Hapus Klien Ini?</h3>
            <p className="text-xs text-[#737680]">
              Apakah Anda yakin ingin menghapus <b>{clientToDelete.company_name}</b>? Data klien ini akan dihapus dari direktori agency.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2 text-xs font-bold">
              <button
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl hover:text-[#24324A] cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteClient}
                className="px-4 py-2 bg-[#F26B5E] hover:bg-[#D95346] text-white rounded-xl shadow-sm cursor-pointer"
              >
                Ya, Hapus Klien
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
