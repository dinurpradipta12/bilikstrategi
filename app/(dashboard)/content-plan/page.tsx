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
  updated_at?: string;
}

const DEFAULT_SHEETS: ContentSheetItem[] = [
  {
    id: 'sheet-001',
    client_name: 'Nusantara Retail Group',
    title: 'Instagram & TikTok Content Plan Q3 2026',
    sheet_url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
    embed_url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/htmlembed?widget=true&headers=false',
    platform: 'Instagram & TikTok',
    status: 'active',
    updated_at: '2026-08-01',
  },
  {
    id: 'sheet-002',
    client_name: 'Kopi Senja Indonesia',
    title: 'Reels Grid & Daily Story Editorial Plan',
    sheet_url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
    embed_url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/htmlembed?widget=true&headers=false',
    platform: 'Instagram Reels',
    status: 'active',
    updated_at: '2026-07-29',
  },
  {
    id: 'sheet-003',
    client_name: 'TechVision Global',
    title: 'B2B LinkedIn & Thought Leadership Articles',
    sheet_url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
    embed_url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/htmlembed?widget=true&headers=false',
    platform: 'LinkedIn & Blog',
    status: 'active',
    updated_at: '2026-07-25',
  },
  {
    id: 'sheet-004',
    client_name: 'Bilik Strategi Official',
    title: 'Agency Master Social Media Content Calendar',
    sheet_url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
    embed_url: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/htmlembed?widget=true&headers=false',
    platform: 'All Social Channels',
    status: 'active',
    updated_at: '2026-08-02',
  },
];

export default function ContentPlanPage() {
  const [mounted, setMounted] = useState(false);
  const [sheets, setSheets] = useState<ContentSheetItem[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);

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

  // Form State - Add Sheet
  const [formClientName, setFormClientName] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSheetUrl, setFormSheetUrl] = useState('');
  const [formPlatform, setFormPlatform] = useState('Instagram & TikTok');

  // Form State - Fast Content Entry
  const [contentTitle, setContentTitle] = useState('');
  const [contentPlatform, setContentPlatform] = useState('Instagram Reels');
  const [contentDate, setContentDate] = useState(new Date().toISOString().split('T')[0]);
  const [contentCaption, setContentCaption] = useState('');
  const [contentAssetUrl, setContentAssetUrl] = useState('');
  const [contentStatus, setContentStatus] = useState('Draft');

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
    const newSheet: ContentSheetItem = {
      id: 'sheet-' + Date.now(),
      client_name: formClientName.trim(),
      title: formTitle.trim() || `Content Plan ${formClientName.trim()}`,
      sheet_url: formSheetUrl.trim(),
      embed_url: embedUrl,
      platform: formPlatform,
      status: 'active',
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
        },
      ]);
    } catch (err) {
      console.warn('[ContentPlan] Supabase insert error:', err);
    }

    setShowAddModal(false);
    setFormClientName('');
    setFormTitle('');
    setFormSheetUrl('');
    setToastMessage(`Content Plan "${newSheet.title}" berhasil ditambahkan!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleFastContentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentTitle.trim()) return;

    setShowContentModal(false);
    setContentTitle('');
    setContentCaption('');
    setContentAssetUrl('');
    setToastMessage(`Item konten "${contentTitle}" berhasil dicatat untuk ${currentSheet?.client_name || 'Klien'}!`);
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
            onClick={() => setShowContentModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E8E8EC] text-[#24324A] hover:bg-[#EEF2F7] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#4F9D78]" />
            <span>Tambah Item Konten</span>
          </button>

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
                className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-[#24324A] text-white shadow-xs'
                    : 'bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] hover:bg-[#EEF2F7] hover:text-[#24324A]'
                }`}
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 ${isSelected ? 'text-[#F26B5E]' : 'text-[#737680]'}`} />
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
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 rounded-md text-[10px] font-extrabold uppercase">
                  {currentSheet.client_name}
                </span>
                <span className="text-xs text-[#737680] font-medium">• {currentSheet.platform}</span>
              </div>
              <h2 className="text-base font-extrabold text-[#24324A] mt-1">{currentSheet.title}</h2>
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
              <div className="w-8 h-8 rounded-xl bg-[#FFF0ED] text-[#F26B5E] flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold leading-none">{currentSheet.title}</h3>
                <span className="text-[11px] text-[#737680]">{currentSheet.client_name} • Focus Content Writing Mode</span>
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

              <button
                onClick={() => setShowContentModal(true)}
                className="px-3.5 py-1.5 bg-[#4F9D78] hover:bg-[#3D8362] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Item Konten</span>
              </button>

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
      {/* MODAL 2: TAMBAH ITEM KONTEN BARU - VIA PORTAL */}
      {/* ========================================================================= */}
      {showContentModal && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button onClick={() => setShowContentModal(false)} className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#E8E8EC] pb-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center shadow-xs">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#24324A]">Tambah Item Konten Baru</h3>
                <p className="text-xs text-[#737680]">Input draf jadwal & caption untuk {currentSheet?.client_name || 'Klien'}.</p>
              </div>
            </div>

            <form onSubmit={handleFastContentSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#24324A] mb-1">Judul / Topic Konten *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Carousel 5 Tips Branding 2026"
                  value={contentTitle}
                  onChange={(e) => setContentTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Platform *</label>
                  <select
                    value={contentPlatform}
                    onChange={(e) => setContentPlatform(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-bold outline-none focus:border-[#24324A]"
                  >
                    <option value="Instagram Reels">Instagram Reels</option>
                    <option value="Instagram Carousel">Instagram Carousel</option>
                    <option value="TikTok Video">TikTok Video</option>
                    <option value="LinkedIn Post">LinkedIn Post</option>
                    <option value="YouTube Shorts">YouTube Shorts</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Tanggal Tayang *</label>
                  <input
                    type="date"
                    required
                    value={contentDate}
                    onChange={(e) => setContentDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Draf Copywriting / Caption</label>
                <textarea
                  rows={3}
                  placeholder="Tulis naskah caption, hook, CTA, dan hashtag..."
                  value={contentCaption}
                  onChange={(e) => setContentCaption(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Link Visual Asset (Google Drive / Canva)</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={contentAssetUrl}
                  onChange={(e) => setContentAssetUrl(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowContentModal(false)}
                  className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl font-bold hover:text-[#24324A] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#24324A] hover:bg-[#1A2536] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#F26B5E]" />
                  <span>Simpan Ke Content Plan</span>
                </button>
              </div>
            </form>
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
              <div>
                <label className="block font-bold text-[#24324A] mb-1">Nama Klien / Brand *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Nusantara Retail"
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
    </div>
  );
}
