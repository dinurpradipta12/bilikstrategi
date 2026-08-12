'use client';

import React, { useState, useEffect } from 'react';
import { createPortal as createPortalDom } from 'react-dom';
import {
  FolderArchive,
  Search,
  Plus,
  Copy,
  Check,
  Eye,
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Film,
  Sparkles,
  Grid,
  List,
  Filter,
  X,
  Share2,
  ExternalLink,
  ShieldCheck,
  Tag,
  Clock,
  HardDrive,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface AssetItem {
  id: string;
  title: string;
  category: 'ratecard' | 'brand_guideline' | 'proposal' | 'media_kit' | 'contract' | 'other';
  description: string;
  format: 'pdf' | 'pptx' | 'zip' | 'png' | 'docx' | 'mp4';
  size: string;
  fileUrl: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedDate: string;
  tags: string[];
  downloadsCount: number;
}

const DEFAULT_ASSETS: AssetItem[] = [
  {
    id: 'ast-001',
    title: 'Rate Card Official Bilik Strategi 2026',
    category: 'ratecard',
    description: 'Daftar harga resmi layanan Social Media Retainer, Digital Ads, Branding, dan Video Production Q1-Q4 2026.',
    format: 'pdf',
    size: '4.2 MB',
    fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    uploadedBy: 'Dinur Pradipta (Owner)',
    uploadedDate: '2026-07-28',
    tags: ['Pricing', 'Retainer', 'Official 2026', 'Ratecard'],
    downloadsCount: 142,
  },
  {
    id: 'ast-002',
    title: 'Brand Guideline & Logo Assets Pack',
    category: 'brand_guideline',
    description: 'Panduan identitas visual resmi, kode warna HSL/HEX, logo SVG/PNG resolusi tinggi, dan font typography agency.',
    format: 'zip',
    size: '18.5 MB',
    fileUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=1200&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&auto=format&fit=crop&q=80',
    uploadedBy: 'Creative Lead',
    uploadedDate: '2026-07-20',
    tags: ['Branding', 'Logo', 'Typography', 'Vector'],
    downloadsCount: 98,
  },
  {
    id: 'ast-003',
    title: 'Master Pitch Deck & Client Proposal Template 2026',
    category: 'proposal',
    description: 'Template presentasi PowerPoint (.PPTX) standar Bilik Strategi dengan animasi modern, slide studi kasus & rincian biaya.',
    format: 'pptx',
    size: '12.8 MB',
    fileUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
    uploadedBy: 'Strategy Lead',
    uploadedDate: '2026-07-15',
    tags: ['Pitch Deck', 'Proposal', 'PowerPoint', 'Client Pitch'],
    downloadsCount: 215,
  },
  {
    id: 'ast-004',
    title: 'Influencer Media Kit & KOL Benchmarks 2026',
    category: 'media_kit',
    description: 'Katalog rate & engagement rate 150+ Influencer TikTok & Instagram terverifikasi mitra Bilik Strategi.',
    format: 'pdf',
    size: '6.5 MB',
    fileUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&auto=format&fit=crop&q=80',
    uploadedBy: 'Digital Marketing Specialist',
    uploadedDate: '2026-07-25',
    tags: ['Influencer', 'KOL Ratecard', 'Media Kit', 'Engagement'],
    downloadsCount: 87,
  },
  {
    id: 'ast-005',
    title: 'Standard Service Agreement & Contract Retainer',
    category: 'contract',
    description: 'Draft kontrak kerja sama legal agency-client lengkap dengan pasal Scope of Work, SLA, dan ketentuan pembayaran.',
    format: 'docx',
    size: '1.1 MB',
    fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=1200&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80',
    uploadedBy: 'Legal & Operations',
    uploadedDate: '2026-06-30',
    tags: ['Contract', 'Legal', 'SLA', 'Agreement'],
    downloadsCount: 64,
  },
  {
    id: 'ast-006',
    title: 'Social Media Safe Zones & Content Specs Guide',
    category: 'brand_guideline',
    description: 'Panduan ukuran resolusi dan area aman (safe zone) untuk Reels 9:16, TikTok, Carousel IG, dan Billboard Digital.',
    format: 'png',
    size: '3.4 MB',
    fileUrl: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=1200&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&auto=format&fit=crop&q=80',
    uploadedBy: 'Senior Graphic Designer',
    uploadedDate: '2026-07-10',
    tags: ['Specs', 'Social Media', 'Reels', 'Safe Zone'],
    downloadsCount: 176,
  },
  {
    id: 'ast-007',
    title: 'Agency Company Profile Video Reel 2026',
    category: 'proposal',
    description: 'Video showcase showreel portfolio hasil karya terbaik tim Bilik Strategi 4K resolusi tinggi.',
    format: 'mp4',
    size: '45.0 MB',
    fileUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&auto=format&fit=crop&q=80',
    uploadedBy: 'Video Editor & Motion Lead',
    uploadedDate: '2026-07-02',
    tags: ['Showreel', 'Video 4K', 'Portfolio', 'Showcase'],
    downloadsCount: 310,
  },
];

export default function AssetManagementPage() {
  const [mounted, setMounted] = useState(false);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // File Viewer Modal State
  const [viewingAsset, setViewingAsset] = useState<AssetItem | null>(null);

  // Add New Asset Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<AssetItem['category']>('ratecard');
  const [newDescription, setNewDescription] = useState('');
  const [newFormat, setNewFormat] = useState<AssetItem['format']>('pdf');
  const [newSize, setNewSize] = useState('2.5 MB');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [newThumbnailUrl, setNewThumbnailUrl] = useState('');
  const [newTags, setNewTags] = useState('Ratecard, Pricing');

  // Edit Asset Modal State
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<AssetItem['category']>('ratecard');
  const [editDescription, setEditDescription] = useState('');
  const [editFormat, setEditFormat] = useState<AssetItem['format']>('pdf');
  const [editSize, setEditSize] = useState('');
  const [editFileUrl, setEditFileUrl] = useState('');
  const [editThumbnailUrl, setEditThumbnailUrl] = useState('');
  const [editTags, setEditTags] = useState('');

  // Delete Asset Modal State
  const [deletingAsset, setDeletingAsset] = useState<AssetItem | null>(null);

  // Fetch Assets from Supabase or LocalStorage
  const fetchAssetsFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: AssetItem[] = data.map((item: any) => ({
          id: String(item.id),
          title: item.title,
          category: item.category,
          description: item.description || '',
          format: item.format,
          size: item.size || '3.0 MB',
          fileUrl: item.file_url,
          thumbnailUrl: item.thumbnail_url || item.file_url,
          uploadedBy: item.uploaded_by || 'Workspace Admin',
          uploadedDate: item.uploaded_date || new Date().toISOString().split('T')[0],
          tags: Array.isArray(item.tags) ? item.tags : typeof item.tags === 'string' ? JSON.parse(item.tags) : ['Asset'],
          downloadsCount: item.downloads_count || 1,
        }));
        setAssets(mapped);
        localStorage.setItem('bilik_asset_items', JSON.stringify(mapped));
        return;
      }
    } catch (err) {
      console.warn('[Assets] Supabase fetch error, fallback to local storage.', err);
    }

    // Local storage fallback
    const savedAssets = localStorage.getItem('bilik_asset_items');
    if (savedAssets) {
      try {
        setAssets(JSON.parse(savedAssets));
      } catch {
        setAssets(DEFAULT_ASSETS);
      }
    } else {
      setAssets(DEFAULT_ASSETS);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchAssetsFromSupabase();

    if (!isSupabaseConfigured) return;

    // Supabase Realtime Subscription
    const channel = supabase
      .channel('realtime_agency_assets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agency_assets' },
        () => {
          fetchAssetsFromSupabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveAssetsToStateAndStorage = (updated: AssetItem[]) => {
    setAssets(updated);
    localStorage.setItem('bilik_asset_items', JSON.stringify(updated));
  };

  // Image Upload File Handler (Converts File to Data URL)
  const handleCoverImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setTargetUrlState: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        alert('Ukuran gambar cover maksimal 8 MB!');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setTargetUrlState(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyLink = (asset: AssetItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareableUrl = asset.fileUrl.startsWith('http')
      ? asset.fileUrl
      : window.location.origin + asset.fileUrl;

    navigator.clipboard.writeText(shareableUrl);
    setCopiedId(asset.id);
    setToastMessage(`Link "${asset.title}" berhasil disalin!`);

    setTimeout(() => {
      setCopiedId(null);
      setToastMessage(null);
    }, 3000);
  };

  // Create Asset Handler
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const tagList = newTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const created: AssetItem = {
      id: 'ast-' + Date.now(),
      title: newTitle.trim(),
      category: newCategory,
      description: newDescription.trim() || 'Aset resmi Bilik Strategi Workspace.',
      format: newFormat,
      size: newSize.trim() || '3.0 MB',
      fileUrl: newFileUrl.trim() || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&auto=format&fit=crop&q=80',
      thumbnailUrl: newThumbnailUrl.trim() || newFileUrl.trim() || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
      uploadedBy: 'Workspace Admin',
      uploadedDate: new Date().toISOString().split('T')[0],
      tags: tagList.length > 0 ? tagList : ['Asset', 'Official'],
      downloadsCount: 1,
    };

    // Save to local state first
    const updated = [created, ...assets];
    saveAssetsToStateAndStorage(updated);

    // Save to Supabase Database
    try {
      await supabase.from('agency_assets').insert([
        {
          id: created.id,
          title: created.title,
          category: created.category,
          description: created.description,
          format: created.format,
          size: created.size,
          file_url: created.fileUrl,
          thumbnail_url: created.thumbnailUrl,
          uploaded_by: created.uploadedBy,
          uploaded_date: created.uploadedDate,
          tags: created.tags,
          downloads_count: created.downloadsCount,
        },
      ]);
    } catch (err) {
      console.warn('[Assets] Could not insert to Supabase table agency_assets.', err);
    }

    setShowUploadModal(false);
    setNewTitle('');
    setNewDescription('');
    setNewFileUrl('');
    setNewThumbnailUrl('');
    setToastMessage(`Aset "${created.title}" berhasil ditambahkan & tersimpan di database!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Open Edit Modal Handler
  const handleOpenEditModal = (asset: AssetItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingAsset(asset);
    setEditTitle(asset.title);
    setEditCategory(asset.category);
    setEditDescription(asset.description);
    setEditFormat(asset.format);
    setEditSize(asset.size);
    setEditFileUrl(asset.fileUrl);
    setEditThumbnailUrl(asset.thumbnailUrl || asset.fileUrl);
    setEditTags(asset.tags.join(', '));
  };

  // Save Edited Asset Handler
  const handleSaveEditedAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset || !editTitle.trim()) return;

    const tagList = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const updatedList = assets.map((ast) => {
      if (ast.id === editingAsset.id) {
        return {
          ...ast,
          title: editTitle.trim(),
          category: editCategory,
          description: editDescription.trim(),
          format: editFormat,
          size: editSize.trim() || ast.size,
          fileUrl: editFileUrl.trim() || ast.fileUrl,
          thumbnailUrl: editThumbnailUrl.trim() || editFileUrl.trim() || ast.thumbnailUrl,
          tags: tagList.length > 0 ? tagList : ast.tags,
        };
      }
      return ast;
    });

    saveAssetsToStateAndStorage(updatedList);

    // Save update to Supabase Database
    try {
      await supabase
        .from('agency_assets')
        .update({
          title: editTitle.trim(),
          category: editCategory,
          description: editDescription.trim(),
          format: editFormat,
          size: editSize.trim() || editingAsset.size,
          file_url: editFileUrl.trim() || editingAsset.fileUrl,
          thumbnail_url: editThumbnailUrl.trim() || editFileUrl.trim() || editingAsset.thumbnailUrl,
          tags: tagList.length > 0 ? tagList : editingAsset.tags,
        })
        .eq('id', editingAsset.id);
    } catch (err) {
      console.warn('[Assets] Could not update Supabase table agency_assets.', err);
    }

    setEditingAsset(null);
    setToastMessage(`Perubahan aset "${editTitle}" berhasil disimpan ke database!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Delete Asset Handler
  const handleDeleteAssetConfirm = async () => {
    if (!deletingAsset) return;

    const updatedList = assets.filter((ast) => ast.id !== deletingAsset.id);
    saveAssetsToStateAndStorage(updatedList);

    // Delete from Supabase Database
    try {
      await supabase.from('agency_assets').delete().eq('id', deletingAsset.id);
    } catch (err) {
      console.warn('[Assets] Could not delete from Supabase table agency_assets.', err);
    }

    if (viewingAsset?.id === deletingAsset.id) {
      setViewingAsset(null);
    }

    setToastMessage(`Aset "${deletingAsset.title}" telah dihapus.`);
    setDeletingAsset(null);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filter Assets
  const filteredAssets = assets.filter((ast) => {
    const matchesCategory = selectedCategory === 'all' || ast.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      ast.title.toLowerCase().includes(q) ||
      ast.description.toLowerCase().includes(q) ||
      ast.uploadedBy.toLowerCase().includes(q) ||
      ast.tags.some((tag) => tag.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  const getFormatBadge = (format: AssetItem['format']) => {
    switch (format) {
      case 'pdf':
        return <span className="px-2 py-0.5 bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 rounded font-bold text-[10px] uppercase flex items-center gap-1"><FileText className="w-3 h-3" /> PDF</span>;
      case 'pptx':
        return <span className="px-2 py-0.5 bg-[#FFF8E7] text-[#D97706] border border-[#D97706]/30 rounded font-bold text-[10px] uppercase flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" /> PPTX</span>;
      case 'zip':
        return <span className="px-2 py-0.5 bg-[#EEF2F7] text-[#24324A] border border-[#24324A]/30 rounded font-bold text-[10px] uppercase flex items-center gap-1"><FolderArchive className="w-3 h-3" /> ZIP</span>;
      case 'png':
        return <span className="px-2 py-0.5 bg-[#E6F4ED] text-[#4F9D78] border border-[#4F9D78]/30 rounded font-bold text-[10px] uppercase flex items-center gap-1"><ImageIcon className="w-3 h-3" /> PNG</span>;
      case 'docx':
        return <span className="px-2 py-0.5 bg-[#EBF5FF] text-[#2563EB] border border-[#2563EB]/30 rounded font-bold text-[10px] uppercase flex items-center gap-1"><FileCode className="w-3 h-3" /> DOCX</span>;
      case 'mp4':
        return <span className="px-2 py-0.5 bg-[#F3E8FF] text-[#9333EA] border border-[#9333EA]/30 rounded font-bold text-[10px] uppercase flex items-center gap-1"><Film className="w-3 h-3" /> MP4</span>;
      default:
        return <span className="px-2 py-0.5 bg-[#F7F7F8] text-[#737680] border border-[#E8E8EC] rounded font-bold text-[10px] uppercase">FILE</span>;
    }
  };

  const getCategoryLabel = (category: AssetItem['category']) => {
    switch (category) {
      case 'ratecard':
        return 'Rate Card & Pricing';
      case 'brand_guideline':
        return 'Brand Guideline';
      case 'proposal':
        return 'Proposal & Deck';
      case 'media_kit':
        return 'Media Kit & KOL';
      case 'contract':
        return 'Legal & Contract';
      default:
        return 'Lainnya';
    }
  };

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
            {/* Soft Peach Icon Container (No Black Background!) */}
            <div className="w-10 h-10 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center shadow-xs">
              <FolderArchive className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#24324A] tracking-tight">Asset Management & Gallery</h1>
              <p className="text-xs text-[#737680] mt-0.5">
                Kelola dan bagikan rate card agency, brand guideline, template pitch deck, dan file media resmi Bilik Strategi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle Switch */}
          <div className="flex items-center bg-[#F7F7F8] border border-[#E8E8EC] p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-[#24324A] shadow-xs' : 'text-[#737680] hover:text-[#24324A]'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Gallery Mode</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-[#24324A] shadow-xs' : 'text-[#737680] hover:text-[#24324A]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List Mode</span>
            </button>
          </div>

          {/* Add New Asset Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#24324A] hover:bg-[#1A2536] text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#F26B5E]" />
            <span>Tambah Asset Baru</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-[#E8E8EC] rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#737680] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari ratecard, brand guideline, nama aset, tag, atau format file..."
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

          <div className="flex items-center gap-2 text-xs text-[#737680] font-medium">
            <Filter className="w-3.5 h-3.5 text-[#24324A]" />
            <span>Menampilkan <strong className="text-[#24324A] font-bold">{filteredAssets.length}</strong> dari {assets.length} file</span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'Semua Asset' },
            { id: 'ratecard', label: 'Rate Card & Pricing' },
            { id: 'brand_guideline', label: 'Brand Guidelines' },
            { id: 'proposal', label: 'Proposal & Pitch Deck' },
            { id: 'media_kit', label: 'Media Kit & KOL' },
            { id: 'contract', label: 'Legal & Contract' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#24324A] text-white shadow-xs'
                  : 'bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] hover:bg-[#EEF2F7] hover:text-[#24324A]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* GALLERY / GRID MODE */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssets.map((ast) => (
            <div
              key={ast.id}
              className="bg-white border border-[#E8E8EC] rounded-2xl overflow-hidden shadow-xs hover:shadow-xl hover:border-[#24324A]/40 transition-all group flex flex-col justify-between"
            >
              <div>
                {/* Thumbnail Preview Area */}
                <div className="relative h-44 bg-[#24324A] overflow-hidden cursor-pointer" onClick={() => setViewingAsset(ast)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ast.thumbnailUrl || ast.fileUrl}
                    alt={ast.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    {getFormatBadge(ast.format)}
                    <span className="px-2 py-0.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold rounded">
                      {ast.size}
                    </span>
                  </div>

                  {/* Quick Actions (Edit / Delete) Top Right */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleOpenEditModal(ast, e)}
                      className="p-1.5 bg-white/90 hover:bg-white text-[#24324A] rounded-lg shadow-md hover:scale-105 transition-all cursor-pointer"
                      title="Edit Asset"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingAsset(ast);
                      }}
                      className="p-1.5 bg-white/90 hover:bg-[#FFF0ED] text-[#D95858] rounded-lg shadow-md hover:scale-105 transition-all cursor-pointer"
                      title="Hapus Asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick View Hover Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingAsset(ast);
                      }}
                      className="px-4 py-2 bg-white text-[#24324A] text-xs font-extrabold rounded-xl shadow-lg flex items-center gap-1.5 hover:bg-[#F7F7F8] cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-[#F26B5E]" />
                      <span>Lihat File</span>
                    </button>
                  </div>
                </div>

                {/* Card Content Info */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#4F9D78] uppercase tracking-wide">
                      {getCategoryLabel(ast.category)}
                    </span>
                    <span className="text-[10px] text-[#737680] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {ast.uploadedDate}
                    </span>
                  </div>

                  <h3
                    onClick={() => setViewingAsset(ast)}
                    className="text-sm font-extrabold text-[#24324A] group-hover:text-[#F26B5E] transition-colors line-clamp-2 cursor-pointer leading-snug"
                  >
                    {ast.title}
                  </h3>

                  <p className="text-xs text-[#737680] line-clamp-2 leading-relaxed">
                    {ast.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {ast.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-[#F7F7F8] border border-[#E8E8EC] text-[10px] text-[#737680] font-medium rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer Buttons */}
              <div className="assets-card-footer p-4 pt-2 border-t border-[#E8E8EC] bg-[#F7F7F8]/50 flex items-center justify-between gap-2">
                {/* Copy Link Button */}
                <button
                  onClick={(e) => handleCopyLink(ast, e)}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    copiedId === ast.id
                      ? 'bg-[#E6F4ED] border-[#4F9D78] text-[#4F9D78]'
                      : 'bg-white border-[#E8E8EC] text-[#24324A] hover:bg-[#EEF2F7]'
                  }`}
                  title="Salin tautan file ke clipboard"
                >
                  {copiedId === ast.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#4F9D78]" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#737680]" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                {/* Lihat File Button */}
                <button
                  onClick={() => setViewingAsset(ast)}
                  className="flex-1 py-2 px-3 bg-[#24324A] hover:bg-[#1A2536] text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[#F26B5E]" />
                  <span>Lihat File</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LIST / TABLE MODE */}
      {viewMode === 'list' && (
        <div className="bg-white border border-[#E8E8EC] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F7F8] border-b border-[#E8E8EC] text-[#737680] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 pl-5">Nama Asset</th>
                  <th className="p-3.5">Kategori</th>
                  <th className="p-3.5">Format</th>
                  <th className="p-3.5">Ukuran</th>
                  <th className="p-3.5">Pengunggah</th>
                  <th className="p-3.5 text-right pr-5">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8EC] font-medium text-[#24324A]">
                {filteredAssets.map((ast) => (
                  <tr key={ast.id} className="hover:bg-[#F7F7F8] transition-colors">
                    <td className="p-3.5 pl-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg overflow-hidden bg-[#24324A] flex-shrink-0 cursor-pointer"
                          onClick={() => setViewingAsset(ast)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ast.thumbnailUrl || ast.fileUrl} alt={ast.title} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <h4
                            onClick={() => setViewingAsset(ast)}
                            className="font-extrabold text-[#24324A] hover:text-[#F26B5E] transition-colors cursor-pointer"
                          >
                            {ast.title}
                          </h4>
                          <p className="text-[11px] text-[#737680] line-clamp-1">{ast.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 bg-[#EEF2F7] text-[#24324A] font-bold rounded-lg text-[11px]">
                        {getCategoryLabel(ast.category)}
                      </span>
                    </td>
                    <td className="p-3.5">{getFormatBadge(ast.format)}</td>
                    <td className="p-3.5 text-[#737680] font-mono">{ast.size}</td>
                    <td className="p-3.5 text-[#737680]">
                      <p className="font-semibold text-[#24324A]">{ast.uploadedBy}</p>
                      <span className="text-[10px] text-[#737680]">{ast.uploadedDate}</span>
                    </td>
                    <td className="p-3.5 text-right pr-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleCopyLink(ast, e)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            copiedId === ast.id
                              ? 'bg-[#E6F4ED] border-[#4F9D78] text-[#4F9D78]'
                              : 'bg-white border-[#E8E8EC] text-[#737680] hover:text-[#24324A] hover:bg-[#EEF2F7]'
                          }`}
                          title="Copy Link"
                        >
                          {copiedId === ast.id ? <Check className="w-4 h-4 text-[#4F9D78]" /> : <Copy className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={(e) => handleOpenEditModal(ast, e)}
                          className="p-2 bg-white border border-[#E8E8EC] text-[#737680] hover:text-[#24324A] hover:bg-[#EEF2F7] rounded-xl transition-all cursor-pointer"
                          title="Edit Asset"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setDeletingAsset(ast)}
                          className="p-2 bg-white border border-[#E8E8EC] text-[#D95858] hover:bg-[#FFF0ED] rounded-xl transition-all cursor-pointer"
                          title="Hapus Asset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setViewingAsset(ast)}
                          className="px-3 py-1.5 bg-[#24324A] hover:bg-[#1A2536] text-white rounded-xl font-extrabold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#F26B5E]" />
                          <span>Lihat File</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredAssets.length === 0 && (
        <div className="bg-white border border-[#E8E8EC] rounded-2xl p-12 text-center space-y-3">
          <FolderArchive className="w-12 h-12 text-[#737680] mx-auto" />
          <h3 className="text-base font-extrabold text-[#24324A]">Tidak ada asset ditemukan</h3>
          <p className="text-xs text-[#737680]">Coba sesuaikan kata kunci pencarian atau ubah filter kategori di atas.</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FILE VIEWER MODAL (LIHAT FILE) - VIA PORTAL */}
      {/* ========================================================================= */}
      {viewingAsset && mounted && createPortalDom(
        <div data-mobile-modal className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div data-mobile-modal-panel className="bg-white border border-[#E8E8EC] rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setViewingAsset(null)}
              className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] p-1.5 rounded-full hover:bg-[#F7F7F8] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-start gap-3 border-b border-[#E8E8EC] pb-4 pr-8">
              {/* Soft Peach Icon Badge Container */}
              <div className="w-12 h-12 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center flex-shrink-0 shadow-xs">
                <FolderArchive className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {getFormatBadge(viewingAsset.format)}
                  <span className="text-xs font-bold text-[#4F9D78] uppercase">
                    {getCategoryLabel(viewingAsset.category)}
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-[#24324A] mt-1">{viewingAsset.title}</h2>
              </div>
            </div>

            {/* File Preview Graphic Box */}
            <div className="relative rounded-2xl overflow-hidden border border-[#E8E8EC] bg-[#24324A] min-h-[220px] max-h-[320px] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={viewingAsset.thumbnailUrl || viewingAsset.fileUrl}
                alt={viewingAsset.title}
                className="w-full h-full object-cover max-h-[320px]"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3">
                <a
                  href={viewingAsset.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-white text-[#24324A] text-xs font-extrabold rounded-xl shadow-xl flex items-center gap-2 hover:bg-[#F7F7F8] transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 text-[#F26B5E]" />
                  <span>Buka di Tab Baru / Fullscreen</span>
                </a>
              </div>
            </div>

            {/* File Metadata Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F7F7F8] p-4 rounded-xl text-xs">
              <div className="space-y-2">
                <p className="font-bold text-[#24324A]">Deskripsi Asset:</p>
                <p className="text-[#737680] leading-relaxed">{viewingAsset.description}</p>
              </div>

              <div className="space-y-2 border-l border-[#E8E8EC] pl-4">
                <div className="flex justify-between py-1 border-b border-[#E8E8EC]">
                  <span className="text-[#737680]">Pengunggah:</span>
                  <span className="font-bold text-[#24324A]">{viewingAsset.uploadedBy}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E8EC]">
                  <span className="text-[#737680]">Tanggal Unggah:</span>
                  <span className="font-bold text-[#24324A]">{viewingAsset.uploadedDate}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E8EC]">
                  <span className="text-[#737680]">Ukuran File:</span>
                  <span className="font-mono font-bold text-[#24324A]">{viewingAsset.size}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#737680]">Total Download:</span>
                  <span className="font-bold text-[#4F9D78]">{viewingAsset.downloadsCount} kali</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#E8E8EC]">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleOpenEditModal(viewingAsset, e)}
                  className="px-3 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#24324A] rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-[#EEF2F7] cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#24324A]" />
                  <span>Edit Asset</span>
                </button>
                <button
                  onClick={() => setDeletingAsset(viewingAsset)}
                  className="px-3 py-2 bg-[#FFF0ED] border border-[#F26B5E]/20 text-[#D95858] rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-[#FFE4DE] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#D95858]" />
                  <span>Hapus</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleCopyLink(viewingAsset, e)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    copiedId === viewingAsset.id
                      ? 'bg-[#E6F4ED] border-[#4F9D78] text-[#4F9D78]'
                      : 'bg-white border-[#E8E8EC] text-[#24324A] hover:bg-[#EEF2F7]'
                  }`}
                >
                  {copiedId === viewingAsset.id ? <Check className="w-4 h-4 text-[#4F9D78]" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedId === viewingAsset.id ? 'Link Tersalin!' : 'Copy Public Link'}</span>
                </button>

                <a
                  href={viewingAsset.fileUrl}
                  target="_blank"
                  download
                  className="px-5 py-2.5 bg-[#24324A] hover:bg-[#1A2536] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#F26B5E]" />
                  <span>Download File</span>
                </a>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: UPLOAD / TAMBAH ASSET BARU - VIA PORTAL */}
      {/* ========================================================================= */}
      {showUploadModal && mounted && createPortalDom(
        <div data-mobile-modal className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div data-mobile-modal-panel className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button onClick={() => setShowUploadModal(false)} className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#E8E8EC] pb-3">
              {/* Soft Peach Icon Container */}
              <div className="w-10 h-10 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center shadow-xs">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#24324A]">Tambah Asset Baru</h3>
                <p className="text-xs text-[#737680]">Upload ratecard, brand guideline, atau file agency.</p>
              </div>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#24324A] mb-1">Judul / Nama Asset *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rate Card Campaign Q3 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Kategori *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-bold outline-none focus:border-[#24324A]"
                  >
                    <option value="ratecard">Rate Card & Pricing</option>
                    <option value="brand_guideline">Brand Guideline</option>
                    <option value="proposal">Proposal & Deck</option>
                    <option value="media_kit">Media Kit & KOL</option>
                    <option value="contract">Legal & Contract</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Format File *</label>
                  <select
                    value={newFormat}
                    onChange={(e) => setNewFormat(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-bold outline-none focus:border-[#24324A]"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="pptx">PPTX PowerPoint</option>
                    <option value="zip">ZIP Archive</option>
                    <option value="png">PNG Image</option>
                    <option value="docx">DOCX Word</option>
                    <option value="mp4">MP4 Video</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Deskripsi Ringkas</label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan isi file atau catatan pengunaan..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Estimasi Ukuran File</label>
                  <input
                    type="text"
                    placeholder="Contoh: 4.5 MB"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Tags (Pisahkan koma)</label>
                  <input
                    type="text"
                    placeholder="Ratecard, Official"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">URL Link File / Download *</label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={newFileUrl}
                  onChange={(e) => setNewFileUrl(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              {/* UPLOAD FOTO COVER / THUMBNAIL DROPZONE */}
              <div>
                <label className="block font-bold text-[#24324A] mb-1">Upload Gambar Cover / Thumbnail</label>
                <div className="border-2 border-dashed border-[#E8E8EC] hover:border-[#24324A] rounded-xl p-3 text-center bg-[#F7F7F8] transition-colors relative cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCoverImageUpload(e, setNewThumbnailUrl)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  {newThumbnailUrl ? (
                    <div className="relative flex items-center justify-between gap-2 p-1 bg-white rounded-lg border border-[#E8E8EC]">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={newThumbnailUrl} alt="Cover Preview" className="w-12 h-10 object-cover rounded" />
                        <span className="text-[11px] text-[#4F9D78] font-bold truncate">Gambar Cover Terpilih</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewThumbnailUrl('');
                        }}
                        className="p-1 text-[#737680] hover:text-[#D95858] z-20 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-5 h-5 text-[#F26B5E] mx-auto group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-[#24324A]">Klik untuk Pilih Gambar Cover dari Komputer</p>
                      <p className="text-[10px] text-[#737680]">Format JPG, PNG, WEBP (Maksimal 8 MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl font-bold hover:text-[#24324A] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#24324A] hover:bg-[#1A2536] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#F26B5E]" />
                  <span>Simpan Asset</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT ASSET MODAL - VIA PORTAL */}
      {/* ========================================================================= */}
      {editingAsset && mounted && createPortalDom(
        <div data-mobile-modal className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div data-mobile-modal-panel className="bg-white border border-[#E8E8EC] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setEditingAsset(null)} className="absolute top-4 right-4 text-[#737680] hover:text-[#24324A] cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#E8E8EC] pb-3">
              {/* Soft Peach Icon Container */}
              <div className="w-10 h-10 rounded-2xl bg-[#FFF0ED] text-[#F26B5E] border border-[#F26B5E]/30 flex items-center justify-center shadow-xs">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#24324A]">Edit Informasi Asset</h3>
                <p className="text-xs text-[#737680]">Ubah judul, cover, keterangan, atau link download.</p>
              </div>
            </div>

            <form onSubmit={handleSaveEditedAsset} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#24324A] mb-1">Judul / Nama Asset *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Kategori *</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-bold outline-none focus:border-[#24324A]"
                  >
                    <option value="ratecard">Rate Card & Pricing</option>
                    <option value="brand_guideline">Brand Guideline</option>
                    <option value="proposal">Proposal & Deck</option>
                    <option value="media_kit">Media Kit & KOL</option>
                    <option value="contract">Legal & Contract</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Format File *</label>
                  <select
                    value={editFormat}
                    onChange={(e) => setEditFormat(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-bold outline-none focus:border-[#24324A]"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="pptx">PPTX PowerPoint</option>
                    <option value="zip">ZIP Archive</option>
                    <option value="png">PNG Image</option>
                    <option value="docx">DOCX Word</option>
                    <option value="mp4">MP4 Video</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">Deskripsi Ringkas</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Ukuran File</label>
                  <input
                    type="text"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#24324A] mb-1">Tags (Pisahkan koma)</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#24324A] mb-1">URL Link File / Download *</label>
                <input
                  type="url"
                  required
                  value={editFileUrl}
                  onChange={(e) => setEditFileUrl(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E8E8EC] rounded-xl font-medium outline-none focus:border-[#24324A]"
                />
              </div>

              {/* EDIT UPLOAD FOTO COVER / THUMBNAIL DROPZONE */}
              <div>
                <label className="block font-bold text-[#24324A] mb-1">Upload Gambar Cover Baru</label>
                <div className="border-2 border-dashed border-[#E8E8EC] hover:border-[#24324A] rounded-xl p-3 text-center bg-[#F7F7F8] transition-colors relative cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCoverImageUpload(e, setEditThumbnailUrl)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  {editThumbnailUrl ? (
                    <div className="relative flex items-center justify-between gap-2 p-1 bg-white rounded-lg border border-[#E8E8EC]">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={editThumbnailUrl} alt="Cover Preview" className="w-12 h-10 object-cover rounded" />
                        <span className="text-[11px] text-[#4F9D78] font-bold truncate">Ganti Gambar Cover</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditThumbnailUrl('');
                        }}
                        className="p-1 text-[#737680] hover:text-[#D95858] z-20 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-5 h-5 text-[#F26B5E] mx-auto group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold text-[#24324A]">Klik untuk Pilih Gambar Cover dari Komputer</p>
                      <p className="text-[10px] text-[#737680]">Format JPG, PNG, WEBP (Maksimal 8 MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl font-bold hover:text-[#24324A] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#24324A] hover:bg-[#1A2536] text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-[#4F9D78]" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION MODAL - VIA PORTAL */}
      {/* ========================================================================= */}
      {deletingAsset && mounted && createPortalDom(
        <div data-mobile-modal className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div data-mobile-modal-panel className="bg-white border border-[#E8E8EC] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 relative text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF0ED] text-[#D95858] border border-[#F26B5E]/30 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-[#24324A]">Hapus Asset Ini?</h3>
              <p className="text-xs text-[#737680] mt-1">
                Apakah Anda yakin ingin menghapus <strong className="text-[#24324A]">{deletingAsset.title}</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingAsset(null)}
                className="px-4 py-2 bg-[#F7F7F8] border border-[#E8E8EC] text-[#737680] rounded-xl font-bold hover:text-[#24324A] cursor-pointer flex-1 text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteAssetConfirm}
                className="px-4 py-2 bg-[#D95858] hover:bg-[#B91C1C] text-white rounded-xl font-extrabold cursor-pointer flex-1 text-xs shadow-sm"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
