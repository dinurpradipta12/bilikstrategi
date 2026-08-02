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
  Users,
} from 'lucide-react';
import { AgencyClient, AgencyProject } from '@/lib/mock/data';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

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

  // Fetch real clients from Supabase database & shared API store
  const fetchClientsFromSupabase = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    let supaData: any[] | null = null;

    try {
      const res = await fetch('/api/supabase/clients', { cache: 'no-store' });
      if (res.ok) {
        const resJson = await res.json();
        if (Array.isArray(resJson.clients) && resJson.clients.length > 0) {
          supaData = resJson.clients;
        }
      }
    } catch {}

    if (!supaData || supaData.length === 0) {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          supaData = data;
        }
      } catch (err) {
        console.warn('[ClientsPage] Supabase query error', err);
      }
    }

    if (supaData && supaData.length > 0) {
      const mappedClients: AgencyClient[] = supaData.map((sc: any) => ({
        id: String(sc.id),
        name: sc.name || `PIC ${sc.company_name || sc.name}`,
        company_name: sc.company_name || sc.name,
        email: sc.email || `contact@${(sc.company_name || 'client').toLowerCase().replace(/\s+/g, '')}.id`,
        phone: sc.phone || '+62 812-0000-0000',
        logo_url: sc.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sc.company_name || sc.name)}&background=24324A&color=fff`,
        status: sc.status || 'active',
        industry: sc.industry || 'Digital Agency',
        clickup_folder_id: sc.clickup_folder_id || 'folder_1',
        overall_progress: sc.overall_progress || 0,
        notes: sc.notes || 'Klien resmi Bilik Strategi Workspace.',
        start_date: sc.start_date || new Date().toISOString().split('T')[0],
        account_manager_id: 'u1',
        active_projects_count: sc.active_projects_count || 0,
        completed_projects_count: sc.completed_projects_count || 0,
        total_tasks_count: sc.total_tasks_count || 0,
      }));

      setClients(mappedClients);
      localStorage.setItem('bilik_agency_clients_db', JSON.stringify(mappedClients));
      if (!isSilent) setLoading(false);
      return;
    }

    // Default to local storage or empty array
    const saved = localStorage.getItem('bilik_agency_clients_db');
    if (saved) {
      try {
        setClients(JSON.parse(saved));
      } catch {
        setClients([]);
      }
    } else {
      setClients([]);
    }
    if (!isSilent) setLoading(false);
  };

  useEffect(() => {
    setMounted(true);
    fetchClientsFromSupabase(false);

    // Silent background interval (15s)
    const interval = setInterval(() => {
      fetchClientsFromSupabase(true);
    }, 15000);

    // BroadcastChannel for cross-tab / cross-window instant sync
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('bilik_clients_channel');
        bc.onmessage = () => {
          fetchClientsFromSupabase(true);
        };
      } catch {}
    }

    if (!isSupabaseConfigured) {
      return () => {
        clearInterval(interval);
        if (bc) bc.close();
      };
    }

    // 3. Supabase Realtime Channel Subscription for 'clients' table
    const channel = supabase
      .channel('realtime_clients_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        () => {
          fetchClientsFromSupabase();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      supabase.removeChannel(channel);
    };
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

  // Save / Add Client directly to Supabase Database & Server API Store
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompany.trim()) return;

    const companyNameClean = formCompany.trim();
    const picNameClean = formPIC.trim() || `PIC ${companyNameClean}`;
    const emailClean = formEmail.trim() || `contact@${companyNameClean.toLowerCase().replace(/\s+/g, '')}.id`;
    const phoneClean = formPhone.trim() || '+62 812-0000-0000';
    const logoClean = `https://ui-avatars.com/api/?name=${encodeURIComponent(companyNameClean)}&background=24324A&color=fff`;

    if (editingClient) {
      // 1. Update in Supabase & Server API
      try {
        await supabase
          .from('clients')
          .update({
            company_name: companyNameClean,
            name: picNameClean,
            email: emailClean,
            phone: phoneClean,
            industry: formIndustry,
            status: formStatus,
            notes: formNotes.trim() || 'Klien Agency',
            logo_url: logoClean,
          })
          .eq('id', editingClient.id);

        await fetch('/api/supabase/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            id: editingClient.id,
            company_name: companyNameClean,
            name: picNameClean,
            email: emailClean,
            phone: phoneClean,
            industry: formIndustry,
            status: formStatus,
            notes: formNotes.trim() || 'Klien Agency',
            logo_url: logoClean,
          }),
        });
      } catch (err) {
        console.warn('[ClientsPage] Could not update client in Supabase:', err);
      }

      // Update local state
      const updatedList = clients.map((c) => {
        if (c.id === editingClient.id) {
          return {
            ...c,
            company_name: companyNameClean,
            name: picNameClean,
            email: emailClean,
            phone: phoneClean,
            industry: formIndustry,
            status: formStatus,
            notes: formNotes.trim() || 'Klien Agency',
            logo_url: logoClean,
          };
        }
        return c;
      });

      setClients(updatedList);
      localStorage.setItem('bilik_agency_clients_db', JSON.stringify(updatedList));
    } else {
      // 2. Add New Client to Supabase & Server API
      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
        }
        return 'a0eebc99-9c0b-4ef8-bb6d-' + Date.now().toString(16).padStart(12, '0');
      };

      const newId = generateUUID();
      const newClientObj = {
        id: newId,
        company_name: companyNameClean,
        name: picNameClean,
        email: emailClean,
        phone: phoneClean,
        industry: formIndustry,
        status: formStatus,
        notes: formNotes.trim() || 'Klien Baru Didaftarkan',
        logo_url: logoClean,
        clickup_folder_id: 'fold_' + Date.now(),
        overall_progress: 0,
        start_date: new Date().toISOString().split('T')[0],
        active_projects_count: 0,
        completed_projects_count: 0,
        total_tasks_count: 0,
      };

      try {
        await supabase.from('clients').upsert([newClientObj]);
        await fetch('/api/supabase/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newClientObj),
        });
      } catch (err) {
        console.warn('[ClientsPage] Could not insert client to Supabase:', err);
      }

      const updatedList = [newClientObj as AgencyClient, ...clients];
      setClients(updatedList);
      localStorage.setItem('bilik_agency_clients_db', JSON.stringify(updatedList));
    }

    // Broadcast change
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('bilik_clients_channel');
        bc.postMessage({ type: 'CLIENTS_UPDATED' });
        bc.close();
      } catch {}
    }

    setShowAddModal(false);
  };

  // Delete Client from Supabase
  const handleDeleteClient = (client: AgencyClient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setClientToDelete(client);
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;

    try {
      await supabase.from('clients').delete().eq('id', clientToDelete.id);
      await fetch('/api/supabase/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: clientToDelete.id }),
      });
    } catch (err) {
      console.warn('[ClientsPage] Could not delete client from Supabase:', err);
    }

    const updatedList = clients.filter((c) => c.id !== clientToDelete.id);
    setClients(updatedList);
    localStorage.setItem('bilik_agency_clients_db', JSON.stringify(updatedList));

    if (selectedClient?.id === clientToDelete.id) {
      setDrawerOpen(false);
      setSelectedClient(null);
    }
    setClientToDelete(null);

    // Broadcast change
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('bilik_clients_channel');
        bc.postMessage({ type: 'CLIENTS_UPDATED' });
        bc.close();
      } catch {}
    }
  };

  // Filter clients by search query
  const filteredClients = clients.filter(
    (c) =>
      c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.industry.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E8EC] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center shadow-xs">
              <Building2 className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Client Listing</h1>
              <p className="text-xs text-[#737680] mt-0.5">
                Manajemen direktori klien resmi agency, penambahan klien baru, dan integrasi data Supabase realtime.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchClientsFromSupabase(false)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E8E8EC] text-[#24324A] hover:bg-[#EEF2F7] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Client</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#24324A] hover:bg-[#1A2536] text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#F26B5E]" />
            <span>Tambah Client Baru</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Counter */}
      <div className="bg-white border border-[#E8E8EC] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#737680] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari perusahaan, nama PIC, email, atau industri klien..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-xs font-medium outline-none focus:border-[#24324A] transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737680] hover:text-[#24324A]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs text-[#737680] font-medium text-right">
          Total <strong className="text-[#24324A] font-bold">{filteredClients.length}</strong> Klien Terdaftar
        </div>
      </div>

      {/* CLIENT CARDS GRID */}
      {filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              onClick={() => {
                setSelectedClient(client);
                setDrawerOpen(true);
              }}
              className="bg-white border border-[#E8E8EC] hover:border-[#24324A]/40 rounded-2xl p-5 shadow-xs hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={client.logo_url}
                      alt={client.company_name}
                      className="w-11 h-11 rounded-xl object-cover border border-[#E8E8EC] flex-shrink-0"
                    />
                    <div>
                      <h3 className="text-sm font-extrabold text-[#24324A] group-hover:text-[#F26B5E] transition-colors line-clamp-1">
                        {client.company_name}
                      </h3>
                      <p className="text-[11px] text-[#737680] font-medium">{client.industry}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                    <button
                      onClick={(e) => handleOpenEditModal(client, e)}
                      className="p-1.5 text-[#737680] hover:text-[#24324A] hover:bg-[#F7F7F8] rounded-lg transition-colors cursor-pointer"
                      title="Edit Client"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClient(client, e)}
                      className="p-1.5 text-[#737680] hover:text-[#D95858] hover:bg-[#FFF0ED] rounded-lg transition-colors cursor-pointer"
                      title="Hapus Client"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Status Badge & Retainer Progress */}
                <div className="pt-2 border-t border-[#E8E8EC] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#737680] text-[11px]">Status Retainer:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        client.status === 'active'
                          ? 'bg-[#E6F4ED] text-[#4F9D78]'
                          : client.status === 'lead'
                          ? 'bg-[#FFF8E7] text-[#D97706]'
                          : 'bg-[#F7F7F8] text-[#737680]'
                      }`}
                    >
                      {client.status}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1 text-xs text-[#737680] pt-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#737680]" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#737680]" />
                      <span>{client.phone}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Projects Counter */}
              <div className="pt-3 border-t border-[#E8E8EC] text-xs flex items-center justify-between">
                <div className="w-full">
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-[#737680]">Progress Retainer:</span>
                    <span className="text-[#4F9D78]">{client.overall_progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#EEF2F7] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#4F9D78] rounded-full transition-all duration-500"
                      style={{ width: `${client.overall_progress}%` }}
                    ></div>
                  </div>
                  <div className="mt-2 text-[10px] text-[#737680]">
                    Active Projects: <strong className="text-[#24324A]">{client.active_projects_count} Project</strong>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* EMPTY STATE */
        <div className="bg-white border border-[#E8E8EC] rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 bg-[#FFF0ED] text-[#F26B5E] rounded-2xl flex items-center justify-center mx-auto border border-[#F26B5E]/20 shadow-xs">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#24324A]">Belum Ada Client Terdaftar</h3>
            <p className="text-xs text-[#737680] max-w-md mx-auto mt-1">
              Data klien dari database Supabase masih kosong. Klik tombol di bawah untuk mendaftarkan klien resmi agency Anda.
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-[#24324A] hover:bg-[#1A2536] text-white text-xs font-extrabold rounded-xl transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#F26B5E]" />
            <span>Tambah Client Baru Sekarang</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT CLIENT MODAL - VIA PORTAL */}
      {/* ========================================================================= */}
      {showAddModal && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#E8E8EC] pb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center shadow-xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#24324A]">
                  {editingClient ? 'Edit Informasi Client' : 'Tambah Client Baru'}
                </h3>
                <p className="text-xs text-[#737680]">Simpan data perusahaan klien ke database Supabase.</p>
              </div>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#24324A] mb-1">Nama Perusahaan / Klien *</label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan nama perusahaan klien"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Nama PIC *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Kontak PIC"
                    value={formPIC}
                    onChange={(e) => setFormPIC(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Status Client *</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-bold outline-none focus:border-[#24324A]"
                  >
                    <option value="active">Active (Retainer)</option>
                    <option value="lead">Prospect / Lead</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Email Klien</label>
                  <input
                    type="email"
                    placeholder="contact@perusahaan.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Nomor Telepon / WA</label>
                  <input
                    type="text"
                    placeholder="+62 812-..."
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Industri / Kategori</label>
                <input
                  type="text"
                  placeholder="Retail, F&B, Technology, Beauty, dsb."
                  value={formIndustry}
                  onChange={(e) => setFormIndustry(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan scope retainer, SLA, atau kontak tambahan..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
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
                  <Plus className="w-3.5 h-3.5 text-[#F26B5E]" />
                  <span>Simpan Ke Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DELETE CLIENT CONFIRMATION MODAL - VIA PORTAL */}
      {/* ========================================================================= */}
      {clientToDelete && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 relative text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF0ED] text-[#D95858] border border-[#F26B5E]/30 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-[#24324A]">Hapus Client Ini?</h3>
              <p className="text-xs text-[#737680] mt-1">
                Apakah Anda yakin ingin menghapus <strong className="text-[#24324A]">{clientToDelete.company_name}</strong> dari database Supabase?
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl font-bold hover:text-[#24324A] cursor-pointer flex-1 text-xs"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteClient}
                className="px-4 py-2 bg-[#D95858] hover:bg-[#B91C1C] text-white rounded-xl font-extrabold cursor-pointer flex-1 text-xs shadow-sm"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* DRAWER: CLIENT DETAIL DRAWER - VIA PORTAL */}
      {/* ========================================================================= */}
      {drawerOpen && selectedClient && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-6 relative flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedClient.logo_url} alt={selectedClient.company_name} className="w-10 h-10 rounded-xl object-cover border" />
                  <div>
                    <h2 className="text-base font-extrabold text-[#24324A]">{selectedClient.company_name}</h2>
                    <p className="text-xs text-[#737680]">{selectedClient.industry}</p>
                  </div>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="text-[#737680] hover:text-[#24324A] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Detail Items */}
              <div className="space-y-3 text-xs bg-[#F7F7F8] p-4 rounded-xl">
                <div className="flex justify-between py-1 border-b border-[#E8E8EC]">
                  <span className="text-[#737680]">PIC Nama:</span>
                  <span className="font-bold text-[#24324A]">{selectedClient.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E8EC]">
                  <span className="text-[#737680]">Email:</span>
                  <span className="font-bold text-[#24324A]">{selectedClient.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E8EC]">
                  <span className="text-[#737680]">Telepon:</span>
                  <span className="font-bold text-[#24324A]">{selectedClient.phone}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E8EC]">
                  <span className="text-[#737680]">Status:</span>
                  <span className="font-bold text-[#4F9D78] uppercase">{selectedClient.status}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#737680]">Tanggal Bergabung:</span>
                  <span className="font-bold text-[#24324A]">{selectedClient.start_date}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#24324A]">Catatan Agency:</h4>
                <p className="text-xs text-[#737680] bg-[#F7F7F8] p-3 rounded-xl leading-relaxed">{selectedClient.notes}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E8E8EC] flex items-center gap-2">
              <button
                onClick={(e) => {
                  setDrawerOpen(false);
                  handleOpenEditModal(selectedClient, e);
                }}
                className="flex-1 py-2.5 bg-[#F7F7F8] border border-[#E8E8EC] text-[#24324A] font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#EEF2F7]"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Client</span>
              </button>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  setClientToDelete(selectedClient);
                }}
                className="flex-1 py-2.5 bg-[#FFF0ED] border border-[#F26B5E]/30 text-[#D95858] font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#FFE4DE]"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Client</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
