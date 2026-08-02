'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  Search,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Edit3,
  Trash2,
  Send,
  Eye,
  Lock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export interface ContentSheetItem {
  id: string;
  client_id?: string;
  client_name: string;
  title: string;
  sheet_url: string;
  embed_url: string;
  platform: string;
  status: string;
  logo_url?: string;
  updated_at?: string;
}

const DEFAULT_SHEETS: ContentSheetItem[] = [];

export default function ContentPlanPage() {
  const [mounted, setMounted] = useState(false);
  const [sheets, setSheets] = useState<ContentSheetItem[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Zoom & Viewport Size Controls
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewportHeight, setViewportHeight] = useState<'compact' | 'normal' | 'tall'>('normal');

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 15, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 15, 60));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSheet, setEditingSheet] = useState<ContentSheetItem | null>(null);
  const [deletingSheet, setDeletingSheet] = useState<ContentSheetItem | null>(null);

  // Form State - Add/Edit Sheet
  const [formClientName, setFormClientName] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSheetUrl, setFormSheetUrl] = useState('');
  const [formPlatform, setFormPlatform] = useState('Instagram & TikTok');
  const [formLogoUrl, setFormLogoUrl] = useState('');

  // Open Edit Modal for a Sheet
  const handleOpenEditModal = (sheet: ContentSheetItem) => {
    setEditingSheet(sheet);
    setFormClientName(sheet.client_name);
    setFormTitle(sheet.title);
    setFormSheetUrl(sheet.sheet_url);
    setFormPlatform(sheet.platform);
    setFormLogoUrl(sheet.logo_url || '');
  };

  // Update existing sheet
  const handleUpdateSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSheet || !formClientName.trim() || !formSheetUrl.trim()) return;

    const embedUrl = convertToEmbedUrl(formSheetUrl.trim());
    const logoUrlToUse = formLogoUrl.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(formClientName.trim())}&background=FFF0ED&color=F26B5E&font-size=0.4`;

    const updatedSheet: ContentSheetItem = {
      ...editingSheet,
      client_name: formClientName.trim(),
      title: formTitle.trim() || `Content Plan ${formClientName.trim()}`,
      sheet_url: formSheetUrl.trim(),
      embed_url: embedUrl,
      platform: formPlatform,
      logo_url: logoUrlToUse,
      updated_at: new Date().toISOString().split('T')[0],
    };

    const updatedList = sheets.map((s) => (s.id === editingSheet.id ? updatedSheet : s));
    setSheets(updatedList);
    localStorage.setItem('bilik_content_sheets', JSON.stringify(updatedList));

    try {
      await supabase
        .from('content_plan_sheets')
        .update({
          client_name: updatedSheet.client_name,
          title: updatedSheet.title,
          sheet_url: updatedSheet.sheet_url,
          embed_url: updatedSheet.embed_url,
          platform: updatedSheet.platform,
          logo_url: updatedSheet.logo_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingSheet.id);
    } catch (err) {
      console.warn('[ContentPlan] Supabase update error:', err);
    }

    setEditingSheet(null);
    setFormClientName('');
    setFormTitle('');
    setFormSheetUrl('');
    setFormLogoUrl('');
    setToastMessage(`Content Plan "${updatedSheet.title}" berhasil diperbarui!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Trigger Custom Delete Confirmation Modal
  const handleDeleteSheet = (sheet: ContentSheetItem) => {
    setDeletingSheet(sheet);
  };

  // Perform Actual Sheet Deletion
  const confirmDeleteSheet = async () => {
    if (!deletingSheet) return;
    const sheetToDelete = deletingSheet;

    const remaining = sheets.filter((s) => s.id !== sheetToDelete.id);
    setSheets(remaining);
    if (selectedSheetId === sheetToDelete.id && remaining.length > 0) {
      setSelectedSheetId(remaining[0].id);
    }
    localStorage.setItem('bilik_content_sheets', JSON.stringify(remaining));

    try {
      await supabase.from('content_plan_sheets').delete().eq('id', sheetToDelete.id);
    } catch (err) {
      console.warn('[ContentPlan] Supabase delete error:', err);
    }

    setDeletingSheet(null);
    if (editingSheet?.id === sheetToDelete.id) setEditingSheet(null);
    setToastMessage(`Link Content Plan "${sheetToDelete.title}" berhasil dihapus.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handle Logo Upload File Conversion to Base64
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file logo maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert normal Google Sheets URL to embed URL
  const convertToEmbedUrl = (url: string) => {
    if (!url) return 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/htmlembed?widget=true&headers=false';
    
    // Extract Spreadsheet ID
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const sheetId = match[1];
      // Use minimal edit/view embed URL
      return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?rm=minimal`;
    }
    return url;
  };

  // Fetch Sheets from Supabase or Fallback
  const fetchSheetsFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('content_plan_sheets')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: ContentSheetItem[] = data.map((item: any) => ({
          id: String(item.id),
          client_name: item.client_name,
          title: item.title,
          sheet_url: item.sheet_url,
          embed_url: item.embed_url || convertToEmbedUrl(item.sheet_url),
          platform: item.platform || 'Social Media',
          status: item.status || 'active',
          logo_url: item.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.client_name)}&background=FFF0ED&color=F26B5E&font-size=0.4`,
          updated_at: item.updated_at || new Date().toISOString().split('T')[0],
        }));
        setSheets(mapped);
        if (!selectedSheetId && mapped.length > 0) {
          setSelectedSheetId(mapped[0].id);
        }
        localStorage.setItem('bilik_content_sheets', JSON.stringify(mapped));
        return;
      }
    } catch (err) {
      console.warn('[ContentPlan] Supabase fetch error, fallback to local storage.', err);
    }

    const saved = localStorage.getItem('bilik_content_sheets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSheets(parsed);
        if (parsed.length > 0 && !selectedSheetId) setSelectedSheetId(parsed[0].id);
      } catch {
        setSheets(DEFAULT_SHEETS);
        setSelectedSheetId(DEFAULT_SHEETS[0].id);
      }
    } else {
      setSheets(DEFAULT_SHEETS);
      setSelectedSheetId(DEFAULT_SHEETS[0].id);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchSheetsFromSupabase();

    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('realtime_content_sheets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'content_plan_sheets' },
        () => {
          fetchSheetsFromSupabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const currentSheet = sheets.find((s) => s.id === selectedSheetId) || sheets[0];

  const handleCopyLink = (sheet: ContentSheetItem) => {
    navigator.clipboard.writeText(sheet.sheet_url);
    setCopiedId(sheet.id);
    setToastMessage(`Link Google Sheets "${sheet.title}" berhasil disalin!`);
    setTimeout(() => {
      setCopiedId(null);
      setToastMessage(null);
    }, 3000);
  };

  const handleAddSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientName.trim() || !formSheetUrl.trim()) return;

    const embedUrl = convertToEmbedUrl(formSheetUrl.trim());
    const logoUrlToUse = formLogoUrl.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(formClientName.trim())}&background=FFF0ED&color=F26B5E&font-size=0.4`;

    const newSheet: ContentSheetItem = {
      id: 'sheet-' + Date.now(),
      client_name: formClientName.trim(),
      title: formTitle.trim() || `Content Plan ${formClientName.trim()}`,
      sheet_url: formSheetUrl.trim(),
      embed_url: embedUrl,
      platform: formPlatform,
      status: 'active',
      logo_url: logoUrlToUse,
      updated_at: new Date().toISOString().split('T')[0],
    };

    const updated = [newSheet, ...sheets];
    setSheets(updated);
    setSelectedSheetId(newSheet.id);
    localStorage.setItem('bilik_content_sheets', JSON.stringify(updated));

    try {
      await supabase.from('content_plan_sheets').insert([
        {
          id: newSheet.id,
          client_name: newSheet.client_name,
          title: newSheet.title,
          sheet_url: newSheet.sheet_url,
          embed_url: newSheet.embed_url,
          platform: newSheet.platform,
          status: newSheet.status,
          logo_url: newSheet.logo_url,
        },
      ]);
    } catch (err) {
      console.warn('[ContentPlan] Supabase insert error:', err);
    }

    setShowAddModal(false);
    setFormClientName('');
    setFormTitle('');
    setFormSheetUrl('');
    setFormLogoUrl('');
    setToastMessage(`Content Plan "${newSheet.title}" berhasil ditambahkan!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredSheets = sheets.filter(
    (s) =>
      s.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.platform.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast Notification Floating */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#24324A] text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-[#F26B5E]/30 animate-slide-in">
          <Check className="w-4 h-4 text-[#4F9D78]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E8EC] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Content Plan & Spreadsheets Hub</h1>
              <p className="text-xs text-[#737680] mt-0.5">
                Kelola jadwal tayang konten, pengisian copywriting, dan editorial plan Google Sheets langsung dari workspace.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#24324A] hover:bg-[#1A2536] text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#F26B5E]" />
            <span>Hubungkan Sheet Baru</span>
          </button>
        </div>
      </div>

      {/* Multi-Client Content Plan Selector & Filter Bar */}
      <div className="bg-white border border-[#E8E8EC] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#24324A]">
            <Building2 className="w-4 h-4 text-[#F26B5E]" />
            <span>Pilih Content Plan Klien / Brand:</span>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-[#737680] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama klien atau judul sheet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl text-xs font-medium outline-none focus:border-[#24324A]"
            />
          </div>
        </div>

        {/* Client Sheet Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {filteredSheets.map((sheet) => {
            const isSelected = sheet.id === currentSheet?.id;
            return (
              <button
                key={sheet.id}
                onClick={() => setSelectedSheetId(sheet.id)}
                className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-2.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#24324A] text-white shadow-xs'
                    : 'bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] hover:bg-[#EEF2F7] hover:text-[#24324A]'
                }`}
              >
                {sheet.logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={sheet.logo_url} alt={sheet.client_name} className="w-5 h-5 rounded-lg object-contain bg-white p-0.5 border border-black/10 flex-shrink-0" />
                ) : (
                  <FileSpreadsheet className={`w-3.5 h-3.5 ${isSelected ? 'text-[#F26B5E]' : 'text-[#737680]'}`} />
                )}
                <span>{sheet.client_name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[#E8E8EC] text-[#737680]'}`}>
                  {sheet.platform}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SPREADSHEET VIEWPORT & HEADER INFO */}
      {currentSheet && (
        <div className="bg-white border border-[#E8E8EC] rounded-2xl overflow-hidden shadow-xs space-y-0">
          {/* Viewport Control Bar */}
          <div className="bg-[#F7F7F8] border-b border-[#E8E8EC] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {currentSheet.logo_url ? (
                <div className="w-10 h-10 rounded-2xl bg-white border border-[#E8E8EC] p-1 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentSheet.logo_url} alt={currentSheet.client_name} className="w-full h-full object-contain rounded-xl" />
                </div>
              ) : null}
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 rounded-md text-[10px] font-extrabold uppercase">
                    {currentSheet.client_name}
                  </span>
                  <span className="text-xs text-[#737680] font-medium">• {currentSheet.platform}</span>
                </div>
                <h2 className="text-base font-extrabold text-[#24324A] mt-0.5">{currentSheet.title}</h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center bg-white border border-[#E8E8EC] rounded-xl p-1 shadow-xs" title="Atur Perhitungan Skala Zoom Spreadsheet">
                <button
                  onClick={handleZoomOut}
                  className="p-1 hover:bg-[#EEF2F7] text-[#24324A] rounded-lg transition-all cursor-pointer"
                  title="Perkecil Tampilan (Zoom Out)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-2 py-0.5 text-[11px] font-extrabold text-[#24324A] hover:bg-[#EEF2F7] rounded-md transition-all cursor-pointer"
                  title="Reset Zoom ke 100%"
                >
                  {zoomLevel}%
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-1 hover:bg-[#EEF2F7] text-[#24324A] rounded-lg transition-all cursor-pointer"
                  title="Perbesar Tampilan (Zoom In)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Viewport Height Switcher */}
              <div className="flex items-center bg-white border border-[#E8E8EC] rounded-xl p-1 text-[11px] font-extrabold shadow-xs">
                <button
                  onClick={() => setViewportHeight('compact')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    viewportHeight === 'compact' ? 'bg-[#24324A] text-white shadow-xs' : 'text-[#737680] hover:text-[#24324A]'
                  }`}
                  title="Tinggi Ringkas (500px)"
                >
                  500px
                </button>
                <button
                  onClick={() => setViewportHeight('normal')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    viewportHeight === 'normal' ? 'bg-[#24324A] text-white shadow-xs' : 'text-[#737680] hover:text-[#24324A]'
                  }`}
                  title="Tinggi Standar (720px)"
                >
                  720px
                </button>
                <button
                  onClick={() => setViewportHeight('tall')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    viewportHeight === 'tall' ? 'bg-[#24324A] text-white shadow-xs' : 'text-[#737680] hover:text-[#24324A]'
                  }`}
                  title="Tinggi Ekstra (900px)"
                >
                  900px
                </button>
              </div>

              <button
                onClick={() => handleCopyLink(currentSheet)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  copiedId === currentSheet.id
                    ? 'bg-[#E6F4ED] border-[#4F9D78] text-[#4F9D78]'
                    : 'bg-white border-[#E8E8EC] text-[#24324A] hover:bg-[#EEF2F7]'
                }`}
                title="Salin link Google Sheets"
              >
                {copiedId === currentSheet.id ? <Check className="w-3.5 h-3.5 text-[#4F9D78]" /> : <Copy className="w-3.5 h-3.5 text-[#737680]" />}
                <span>{copiedId === currentSheet.id ? 'Tersalin' : 'Copy Link'}</span>
              </button>

              <a
                href={currentSheet.sheet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-white border border-[#E8E8EC] text-[#24324A] hover:bg-[#EEF2F7] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Buka di tab browser baru"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#F26B5E]" />
                <span>Buka di Sheets</span>
              </a>

              {/* Edit & Delete Action Buttons */}
              <button
                onClick={() => handleOpenEditModal(currentSheet)}
                className="px-3 py-1.5 bg-white border border-[#E8E8EC] text-[#24324A] hover:bg-[#EEF2F7] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Edit nama, judul, URL, atau logo sheet ini"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#24324A]" />
                <span>Edit Link</span>
              </button>

              <button
                onClick={() => handleDeleteSheet(currentSheet)}
                className="px-3 py-1.5 bg-[#FFF0ED] border border-[#F26B5E]/30 text-[#F26B5E] hover:bg-[#F26B5E] hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Hapus tautan sheet ini dari workspace"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Link</span>
              </button>

              <button
                onClick={() => setIsFocusMode(true)}
                className="px-4 py-1.5 bg-[#24324A] hover:bg-[#1A2536] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Tampilkan layar penuh tanpa distraksi"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[#F26B5E]" />
                <span>Focus Mode</span>
              </button>
            </div>
          </div>

          {/* Embedded Google Sheets IFrame Viewport with Zoom Support */}
          <div
            className={`w-full bg-white relative overflow-hidden transition-all duration-300 ${
              viewportHeight === 'compact' ? 'h-[500px]' : viewportHeight === 'tall' ? 'h-[900px]' : 'h-[720px]'
            }`}
          >
            <div
              className="w-full h-full"
              style={{
                zoom: `${zoomLevel / 100}`,
              }}
            >
              <iframe
                src={currentSheet.embed_url || currentSheet.sheet_url}
                title={currentSheet.title}
                className="w-full h-full border-0"
                allow="clipboard-write; auto-fill"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FOCUS / FULL-SCREEN MODE - VIA PORTAL */}
      {/* ========================================================================= */}
      {isFocusMode && currentSheet && mounted && createPortal(
        <div className="fixed inset-0 z-50 bg-[#24324A] flex flex-col animate-fade-in">
          {/* Focus Mode Control Bar */}
          <div className="bg-[#1A2536] border-b border-[#24324A] px-6 py-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 p-1 flex items-center justify-center font-bold overflow-hidden flex-shrink-0">
                {currentSheet.logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={currentSheet.logo_url} alt={currentSheet.client_name} className="w-full h-full object-contain rounded-xl" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5 text-[#F26B5E]" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-extrabold leading-none">{currentSheet.title}</h3>
                <span className="text-[11px] text-[#737680] mt-1 block">{currentSheet.client_name} • Focus Content Writing Mode</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Focus Mode Zoom Controls */}
              <div className="flex items-center bg-white/10 border border-white/20 rounded-xl p-1 text-xs">
                <button
                  onClick={handleZoomOut}
                  className="p-1 hover:bg-white/20 text-white rounded-lg transition-all cursor-pointer"
                  title="Perkecil Tampilan"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-2 py-0.5 text-[11px] font-extrabold text-white hover:bg-white/20 rounded-md transition-all cursor-pointer"
                  title="Reset Zoom ke 100%"
                >
                  {zoomLevel}%
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-1 hover:bg-white/20 text-white rounded-lg transition-all cursor-pointer"
                  title="Perbesar Tampilan"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <a
                href={currentSheet.sheet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#F26B5E]" />
                <span>Buka Google Sheets</span>
              </a>

              <button
                onClick={() => setIsFocusMode(false)}
                className="px-4 py-1.5 bg-[#F26B5E] hover:bg-[#D95346] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Keluar Focus Mode</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Iframe with Zoom Support */}
          <div className="flex-1 bg-white overflow-hidden">
            <div
              className="w-full h-full"
              style={{
                zoom: `${zoomLevel / 100}`,
              }}
            >
              <iframe
                src={currentSheet.embed_url || currentSheet.sheet_url}
                title={currentSheet.title}
                className="w-full h-full border-0"
                allow="clipboard-write; auto-fill"
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: HUBUNGKAN GOOGLE SHEETS BARU - VIA PORTAL */}
      {/* ========================================================================= */}
      {showAddModal && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#E8E8EC] pb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#24324A]">Hubungkan Google Sheets Baru</h3>
                <p className="text-xs text-[#737680]">Tautkan link Google Sheets Content Plan milik klien.</p>
              </div>
            </div>

            <form onSubmit={handleAddSheet} className="space-y-3.5 text-xs">
              {/* Upload Icon / Logo Klien */}
              <div className="p-3 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl space-y-2">
                <label className="block font-bold text-[#24324A]">Upload Icon / Logo Klien (Ditampilkan di Header Fullscreen)</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-[#E8E8EC] p-1 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs">
                    {formLogoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={formLogoUrl} alt="Logo Preview" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <Building2 className="w-6 h-6 text-[#737680]" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      className="w-full text-[11px] text-[#737680] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#24324A] file:text-white hover:file:bg-[#1A2536] cursor-pointer"
                    />
                    <input
                      type="url"
                      placeholder="atau paste URL logo image (https://...)"
                      value={formLogoUrl}
                      onChange={(e) => setFormLogoUrl(e.target.value)}
                      className="w-full p-2 bg-white border border-[#E8E8EC] rounded-lg text-[11px] font-medium outline-none focus:border-[#24324A]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Nama Klien / Brand *</label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan nama klien atau brand"
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Judul Spreadsheet *</label>
                <input
                  type="text"
                  placeholder="Contoh: Editorial Plan Instagram Q3 2026"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">URL Link Google Sheets *</label>
                <input
                  type="url"
                  required
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={formSheetUrl}
                  onChange={(e) => setFormSheetUrl(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
                <p className="text-[10px] text-[#737680] mt-1">
                  Pastikan akses file Google Sheets di-set ke <em>"Anyone with the link can edit/view"</em> agar dapat ditampilkan.
                </p>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Kanal Platform</label>
                <select
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-bold outline-none focus:border-[#24324A]"
                >
                  <option value="Instagram & TikTok">Instagram & TikTok</option>
                  <option value="Instagram Reels">Instagram Reels</option>
                  <option value="LinkedIn & Article">LinkedIn & Article</option>
                  <option value="All Social Channels">All Social Channels</option>
                </select>
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
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#F26B5E]" />
                  <span>Hubungkan Sheet</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT GOOGLE SHEETS LINK - VIA PORTAL */}
      {/* ========================================================================= */}
      {editingSheet && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button onClick={() => setEditingSheet(null)} className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#E8E8EC] pb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center shadow-xs">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#24324A]">Edit Tautan Google Sheets</h3>
                <p className="text-xs text-[#737680]">Ubah rincian nama, judul, URL, atau logo sheet.</p>
              </div>
            </div>

            <form onSubmit={handleUpdateSheet} className="space-y-3.5 text-xs">
              {/* Upload Icon / Logo Klien */}
              <div className="p-3 bg-[#F7F7F8] border border-[#E8E8EC] rounded-xl space-y-2">
                <label className="block font-bold text-[#24324A]">Upload / Ubah Logo Klien</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-[#E8E8EC] p-1 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs">
                    {formLogoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={formLogoUrl} alt="Logo Preview" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <Building2 className="w-6 h-6 text-[#737680]" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      className="w-full text-[11px] text-[#737680] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#24324A] file:text-white hover:file:bg-[#1A2536] cursor-pointer"
                    />
                    <input
                      type="url"
                      placeholder="atau paste URL logo image (https://...)"
                      value={formLogoUrl}
                      onChange={(e) => setFormLogoUrl(e.target.value)}
                      className="w-full p-2 bg-white border border-[#E8E8EC] rounded-lg text-[11px] font-medium outline-none focus:border-[#24324A]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Nama Klien / Brand *</label>
                <input
                  type="text"
                  required
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Judul Spreadsheet *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">URL Link Google Sheets *</label>
                <input
                  type="url"
                  required
                  value={formSheetUrl}
                  onChange={(e) => setFormSheetUrl(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Kanal Platform</label>
                <select
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-bold outline-none focus:border-[#24324A]"
                >
                  <option value="Instagram & TikTok">Instagram & TikTok</option>
                  <option value="Instagram Reels">Instagram Reels</option>
                  <option value="LinkedIn & Article">LinkedIn & Article</option>
                  <option value="All Social Channels">All Social Channels</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteSheet(editingSheet)}
                  className="px-3 py-2 bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 hover:bg-[#F26B5E] hover:text-white rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Link</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSheet(null)}
                    className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl font-bold hover:text-[#24324A] cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#24324A] hover:bg-[#1A2536] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-[#F26B5E]" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CUSTOM DELETE CONFIRMATION MODAL - VIA PORTAL */}
      {/* ========================================================================= */}
      {deletingSheet && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
            <button onClick={() => setDeletingSheet(null)} className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center flex-shrink-0 shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#24324A]">Hapus Tautan Google Sheets?</h3>
                <p className="text-xs text-[#737680] mt-1 leading-relaxed">
                  Apakah Anda yakin ingin menghapus link Content Plan <strong className="text-[#24324A]">"{deletingSheet.title}"</strong> untuk klien <strong className="text-[#24324A]">{deletingSheet.client_name}</strong>?
                  Tautan ini akan terhapus secara otomatis untuk seluruh anggota tim workspace.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8E8EC] flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeletingSheet(null)}
                className="px-4 py-2.5 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl font-bold hover:text-[#24324A] cursor-pointer transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteSheet}
                className="px-5 py-2.5 bg-[#F26B5E] hover:bg-[#D95346] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Link</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
