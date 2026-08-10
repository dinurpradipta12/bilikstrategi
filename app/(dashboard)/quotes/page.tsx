'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  Palette,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

type QuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type QuoteData = {
  quoteNumber: string;
  title: string;
  issueDate: string;
  validUntil: string;
  currency: string;
  fontFamily: string;
  backgroundColor: string;
  backgroundImageUrl: string;
  accentColor: string;
  textColor: string;
  logoUrl: string;
  issuerName: string;
  issuerAddress: string;
  issuerEmail: string;
  issuerPhone: string;
  recipientName: string;
  recipientCompany: string;
  recipientAddress: string;
  recipientEmail: string;
  recipientPhone: string;
  items: QuoteItem[];
  discountPercent: number;
  taxPercent: number;
  notes: string;
  terms: string;
  paymentTitle: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  paymentInstructions: string;
  footerText: string;
};

type QuoteRecord = {
  id: string;
  workspace_id: string;
  quote_number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  data: QuoteData;
  created_by_email?: string | null;
  created_at?: string;
  updated_at?: string;
};

const FONT_OPTIONS = [
  { value: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", label: 'Inter / Sans' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: "Georgia, 'Times New Roman', serif", label: 'Georgia' },
  { value: "'Times New Roman', Times, serif", label: 'Times New Roman' },
  { value: "'Courier New', Courier, monospace", label: 'Courier New' },
];

const CURRENCY_OPTIONS = [
  { value: 'IDR', label: 'IDR - Rupiah' },
  { value: 'USD', label: 'USD - Dollar' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'MYR', label: 'MYR - Ringgit' },
];

const LOCAL_STORAGE_KEY = 'bilik_quote_records';
const INITIAL_QUOTE_NUMBER = 'QTN/BS/DRAFT/0000/0000';
const QUOTE_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const AGENCY_PREFIXES = new Set(['PT', 'CV', 'UD', 'FA', 'TB', 'LTD', 'INC', 'YAYASAN']);

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return dateValue(next);
}

function generateQuoteId(length = 6) {
  const values = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(values);
    return Array.from(values, (value) => QUOTE_ID_ALPHABET[value % QUOTE_ID_ALPHABET.length]).join('');
  }
  return Array.from({ length }, () => QUOTE_ID_ALPHABET[Math.floor(Math.random() * QUOTE_ID_ALPHABET.length)]).join('');
}

function abbreviateAgencyName(name: string) {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .filter((word) => !AGENCY_PREFIXES.has(word));

  if (words.length === 0) return 'AG';
  if (words.length === 1) return words[0].slice(0, 4);
  return words.map((word) => word[0]).join('').slice(0, 5);
}

function quoteDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return { year: match[1], day: match[3], month: match[2] };

  const today = new Date();
  return {
    year: String(today.getFullYear()),
    day: String(today.getDate()).padStart(2, '0'),
    month: String(today.getMonth() + 1).padStart(2, '0'),
  };
}

function generateQuoteNumber(agencyName = 'Bilik Strategi', issueDate = dateValue(new Date())) {
  const { year, day, month } = quoteDateParts(issueDate);
  return `QTN/${generateQuoteId()}/${abbreviateAgencyName(agencyName)}/${day}${month}/${year}`;
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function createDefaultQuote(initialQuoteNumber?: string): QuoteData {
  const today = new Date();
  const todayValue = dateValue(today);
  return {
    quoteNumber: initialQuoteNumber || generateQuoteNumber('Bilik Strategi', todayValue),
    title: 'PENAWARAN HARGA',
    issueDate: todayValue,
    validUntil: addDays(today, 14),
    currency: 'IDR',
    fontFamily: FONT_OPTIONS[0].value,
    backgroundColor: '#FFFFFF',
    backgroundImageUrl: '',
    accentColor: '#F26B5E',
    textColor: '#24324A',
    logoUrl: '',
    issuerName: 'Bilik Strategi',
    issuerAddress: 'Tuliskan alamat bisnis Anda',
    issuerEmail: 'hello@bilikstrategi.com',
    issuerPhone: '',
    recipientName: 'Nama Penerima',
    recipientCompany: 'Nama Perusahaan Klien',
    recipientAddress: 'Alamat penerima',
    recipientEmail: '',
    recipientPhone: '',
    items: [
      {
        id: generateId(),
        description: 'Jasa / deliverable',
        quantity: 1,
        unitPrice: 0,
      },
    ],
    discountPercent: 0,
    taxPercent: 0,
    notes: 'Harga dan ruang lingkup dapat disesuaikan berdasarkan kebutuhan proyek.',
    terms: 'Penawaran ini berlaku sampai tanggal yang tercantum. Pekerjaan dimulai setelah penawaran disetujui.',
    paymentTitle: 'INFORMASI PEMBAYARAN',
    bankName: 'Nama Bank',
    accountName: 'Nama Pemilik Rekening',
    accountNumber: '0000000000',
    paymentInstructions: 'Pembayaran awal atau termin mengikuti kesepakatan proyek.',
    footerText: 'Dokumen penawaran ini dibuat secara digital.',
  };
}

function normalizeQuoteData(value: unknown, quoteNumber?: string): QuoteData {
  const defaults = createDefaultQuote();
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const rawItems = Array.isArray(source.items) ? source.items : defaults.items;
  const items = rawItems.map((item, index) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      id: toText(row.id, `item-${index}-${Date.now()}`),
      description: toText(row.description, 'Item penawaran'),
      quantity: Math.max(0, toNumber(row.quantity, 1)),
      unitPrice: Math.max(0, toNumber(row.unitPrice, 0)),
    };
  });

  return {
    ...defaults,
    ...source,
    quoteNumber: toText(source.quoteNumber, quoteNumber || defaults.quoteNumber),
    title: toText(source.title, defaults.title),
    issueDate: toText(source.issueDate, defaults.issueDate),
    validUntil: toText(source.validUntil, defaults.validUntil),
    currency: toText(source.currency, defaults.currency),
    fontFamily: toText(source.fontFamily, defaults.fontFamily),
    backgroundColor: toText(source.backgroundColor, defaults.backgroundColor),
    backgroundImageUrl: toText(source.backgroundImageUrl, defaults.backgroundImageUrl),
    accentColor: toText(source.accentColor, defaults.accentColor),
    textColor: toText(source.textColor, defaults.textColor),
    logoUrl: toText(source.logoUrl, defaults.logoUrl),
    issuerName: toText(source.issuerName, defaults.issuerName),
    issuerAddress: toText(source.issuerAddress, defaults.issuerAddress),
    issuerEmail: toText(source.issuerEmail, defaults.issuerEmail),
    issuerPhone: toText(source.issuerPhone, defaults.issuerPhone),
    recipientName: toText(source.recipientName, defaults.recipientName),
    recipientCompany: toText(source.recipientCompany, defaults.recipientCompany),
    recipientAddress: toText(source.recipientAddress, defaults.recipientAddress),
    recipientEmail: toText(source.recipientEmail, defaults.recipientEmail),
    recipientPhone: toText(source.recipientPhone, defaults.recipientPhone),
    items: items.length > 0 ? items : defaults.items,
    discountPercent: Math.max(0, toNumber(source.discountPercent, defaults.discountPercent)),
    taxPercent: Math.max(0, toNumber(source.taxPercent, defaults.taxPercent)),
    notes: toText(source.notes, defaults.notes),
    terms: toText(source.terms, defaults.terms),
    paymentTitle: toText(source.paymentTitle, defaults.paymentTitle),
    bankName: toText(source.bankName, defaults.bankName),
    accountName: toText(source.accountName, defaults.accountName),
    accountNumber: toText(source.accountNumber, defaults.accountNumber),
    paymentInstructions: toText(source.paymentInstructions, defaults.paymentInstructions),
    footerText: toText(source.footerText, defaults.footerText),
  };
}

function normalizeRecord(value: any, fallbackWorkspaceId: string): QuoteRecord {
  const rawData = value?.data && typeof value.data === 'object' && !Array.isArray(value.data) ? value.data : {};
  const fallbackQuoteNumber = generateQuoteNumber(
    toText(rawData.issuerName, 'Bilik Strategi'),
    toText(rawData.issueDate, dateValue(new Date())),
  );
  const status = ['draft', 'sent', 'accepted', 'rejected'].includes(value?.status) ? value.status : 'draft';
  return {
    id: toText(value?.id, `local-${Date.now()}`),
    workspace_id: toText(value?.workspace_id, fallbackWorkspaceId),
    quote_number: toText(value?.quote_number, rawData.quoteNumber || fallbackQuoteNumber),
    status,
    data: normalizeQuoteData(value?.data, value?.quote_number),
    created_by_email: value?.created_by_email || null,
    created_at: value?.created_at,
    updated_at: value?.updated_at,
  };
}

function getWorkspaceId() {
  if (typeof document === 'undefined') return 'bilik-strategi';
  const cookie = document.cookie.split('; ').find((item) => item.startsWith('app_workspace_id='));
  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) || 'bilik-strategi' : 'bilik-strategi';
}

function getCurrentEmail() {
  if (typeof document === 'undefined') return '';
  const cookie = document.cookie.split('; ').find((item) => item.startsWith('clickup_user_email='));
  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: CURRENCY_OPTIONS.some((item) => item.value === currency) ? currency : 'IDR',
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('id-ID')}`;
  }
}

function formatDate(value: string) {
  if (!value) return '-';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function readLocalRecords(workspaceId: string) {
  if (typeof window === 'undefined') return [] as QuoteRecord[];
  try {
    const raw = JSON.parse(localStorage.getItem(`${LOCAL_STORAGE_KEY}:${workspaceId}`) || '[]');
    return Array.isArray(raw) ? raw.map((item) => normalizeRecord(item, workspaceId)) : [];
  } catch {
    return [] as QuoteRecord[];
  }
}

function writeLocalRecords(workspaceId: string, records: QuoteRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${LOCAL_STORAGE_KEY}:${workspaceId}`, JSON.stringify(records));
}

function compressImage(file: File, maxDimension = 1400, quality = 0.86) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File gambar tidak dapat dibaca.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('File gambar tidak valid.'));
      image.onload = () => {
        const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Browser tidak mendukung pemrosesan gambar.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(outputType === 'image/png' ? canvas.toDataURL(outputType) : canvas.toDataURL(outputType, quality));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function InputLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#737680]">
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-[#DDE1E7] bg-white px-3 py-2.5 text-xs text-[#202124] outline-none transition focus:border-[#24324A] focus:ring-2 focus:ring-[#24324A]/10';

export default function QuotesPage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('bilik-strategi');
  const [records, setRecords] = useState<QuoteRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<QuoteData>(() => createDefaultQuote(INITIAL_QUOTE_NUMBER));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'background' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const totals = useMemo(() => {
    const subtotal = draft.items.reduce(
      (sum, item) => sum + Math.max(0, toNumber(item.quantity, 0)) * Math.max(0, toNumber(item.unitPrice, 0)),
      0,
    );
    const discount = subtotal * (Math.max(0, toNumber(draft.discountPercent, 0)) / 100);
    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * (Math.max(0, toNumber(draft.taxPercent, 0)) / 100);
    return { subtotal, discount, tax, total: taxable + tax };
  }, [draft.discountPercent, draft.items, draft.taxPercent]);

  const loadQuotes = useCallback(async () => {
    const localRecords = readLocalRecords(workspaceId);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('app_quotes')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const nextRecords = Array.isArray(data) ? data.map((item) => normalizeRecord(item, workspaceId)) : [];
      if (nextRecords.length > 0) {
        setRecords(nextRecords);
        const selected = nextRecords.find((item) => item.id === selectedId) || nextRecords[0];
        setSelectedId(selected.id);
        setDraft(selected.data);
        writeLocalRecords(workspaceId, nextRecords);
      } else if (localRecords.length > 0) {
        setRecords(localRecords);
        setSelectedId(localRecords[0].id);
        setDraft(localRecords[0].data);
      } else {
        setRecords([]);
        setSelectedId('');
      }
    } catch (error: any) {
      console.warn('[Quotes] Supabase load failed, using local recovery:', error?.message || error);
      setRecords(localRecords);
      if (localRecords.length > 0) {
        setSelectedId(localRecords[0].id);
        setDraft(localRecords[0].data);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId, workspaceId]);

  useEffect(() => {
    setMounted(true);
    setWorkspaceId(getWorkspaceId());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    loadQuotes();

    const channel = supabase
      .channel(`quote-studio-${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_quotes', filter: `workspace_id=eq.${workspaceId}` },
        () => loadQuotes(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadQuotes, mounted, workspaceId]);

  useEffect(() => {
    if (!mounted) return;
    const current = records.find((item) => item.id === selectedId);
    if (current) setDraft(current.data);
  }, [mounted, records, selectedId]);

  useEffect(() => {
    if (!mounted || selectedId || records.length > 0) return;
    setDraft((current) => (
      current.quoteNumber === INITIAL_QUOTE_NUMBER
        ? { ...current, quoteNumber: generateQuoteNumber(current.issuerName, current.issueDate) }
        : current
    ));
  }, [mounted, records.length, selectedId]);

  useEffect(() => {
    if (!mounted) return;
    const draftRecord: QuoteRecord = {
      id: selectedId || 'local-draft',
      workspace_id: workspaceId,
      quote_number: draft.quoteNumber,
      status: 'draft',
      data: draft,
      updated_at: new Date().toISOString(),
    };
    const localRecords = readLocalRecords(workspaceId);
    const withoutCurrent = localRecords.filter(
      (item) => item.id !== draftRecord.id && item.quote_number !== draft.quoteNumber,
    );
    writeLocalRecords(workspaceId, [...withoutCurrent, draftRecord]);
  }, [draft, mounted, selectedId, workspaceId]);

  const updateField = <K extends keyof QuoteData>(field: K, value: QuoteData[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: string | number) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const addItem = () => {
    setDraft((current) => ({
      ...current,
      items: [...current.items, { id: generateId(), description: 'Item baru', quantity: 1, unitPrice: 0 }],
    }));
  };

  const removeItem = (id: string) => {
    setDraft((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.id !== id) : current.items,
    }));
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'backgroundImageUrl',
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'File harus berupa gambar.' });
      return;
    }

    setUploading(field === 'logoUrl' ? 'logo' : 'background');
    try {
      const dataUrl = await compressImage(file, field === 'logoUrl' ? 900 : 1600, field === 'logoUrl' ? 0.9 : 0.82);
      updateField(field, dataUrl);
      setMessage({ type: 'success', text: `${field === 'logoUrl' ? 'Logo' : 'Background'} siap digunakan.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal memproses gambar.' });
    } finally {
      setUploading(null);
    }
  };

  const startNewQuote = () => {
    setSelectedId('');
    setDraft(createDefaultQuote());
    setMessage({ type: 'info', text: 'Draft penawaran baru siap diedit. Simpan untuk memasukkannya ke daftar.' });
  };

  const saveQuote = async () => {
    const quoteNumber = draft.quoteNumber.trim() || generateQuoteNumber(draft.issuerName, draft.issueDate);
    const normalizedDraft = normalizeQuoteData({ ...draft, quoteNumber }, quoteNumber);
    setDraft(normalizedDraft);
    setSaving(true);
    setMessage(null);

    const payload = {
      workspace_id: workspaceId,
      quote_number: quoteNumber,
      status: 'draft',
      data: normalizedDraft,
      created_by_email: getCurrentEmail() || null,
      updated_at: new Date().toISOString(),
    };
    const selectedRecord = records.find((item) => item.id === selectedId);

    try {
      const result = selectedRecord && !selectedId.startsWith('local-')
        ? await supabase.from('app_quotes').update(payload).eq('id', selectedId).select('*').single()
        : await supabase.from('app_quotes').insert(payload).select('*').single();

      if (result.error) throw result.error;
      const savedRecord = normalizeRecord(result.data, workspaceId);
      setRecords((current) => [savedRecord, ...current.filter((item) => item.id !== savedRecord.id && item.quote_number !== savedRecord.quote_number)]);
      setSelectedId(savedRecord.id);
      setDraft(savedRecord.data);
      writeLocalRecords(workspaceId, [savedRecord, ...readLocalRecords(workspaceId).filter((item) => item.id !== savedRecord.id && item.quote_number !== savedRecord.quote_number)]);
      setMessage({ type: 'success', text: `Penawaran ${savedRecord.quote_number} tersimpan ke workspace.` });
    } catch (error: any) {
      const localRecord = normalizeRecord(
        {
          id: selectedRecord?.id?.startsWith('local-') ? selectedRecord.id : `local-${Date.now()}`,
          workspace_id: workspaceId,
          quote_number: quoteNumber,
          status: 'draft',
          data: normalizedDraft,
          updated_at: new Date().toISOString(),
        },
        workspaceId,
      );
      const nextRecords = [localRecord, ...records.filter((item) => item.id !== selectedRecord?.id && item.quote_number !== quoteNumber)];
      setRecords(nextRecords);
      setSelectedId(localRecord.id);
      setDraft(localRecord.data);
      writeLocalRecords(workspaceId, nextRecords);
      setMessage({ type: 'info', text: `Tersimpan di perangkat. Jalankan migration penawaran harga agar tersimpan lintas user. (${error?.message || 'Supabase belum siap'})` });
    } finally {
      setSaving(false);
    }
  };

  const deleteQuote = async () => {
    if (!selectedId) return;
    const selectedRecord = records.find((item) => item.id === selectedId);
    if (!selectedRecord || !window.confirm(`Hapus penawaran ${selectedRecord.quote_number}?`)) return;

    try {
      if (!selectedId.startsWith('local-')) {
        const { error } = await supabase.from('app_quotes').delete().eq('id', selectedId);
        if (error) throw error;
      }
      const nextRecords = records.filter((item) => item.id !== selectedId);
      setRecords(nextRecords);
      writeLocalRecords(workspaceId, nextRecords);
      setSelectedId(nextRecords[0]?.id || '');
      setDraft(nextRecords[0]?.data || createDefaultQuote());
      setMessage({ type: 'success', text: 'Penawaran dihapus.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Penawaran gagal dihapus.' });
    }
  };

  const exportPdf = async () => {
    const element = previewRef.current;
    if (!element) return;
    setExporting(true);
    setMessage(null);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: draft.backgroundColor || '#FFFFFF',
        logging: false,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const imageWidth = canvas.width * ratio;
      const imageHeight = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL('image/png', 1), 'PNG', (pageWidth - imageWidth) / 2, 0, imageWidth, imageHeight, undefined, 'FAST');
      pdf.save(`${draft.quoteNumber || 'penawaran-harga'}.pdf`);
      setMessage({ type: 'success', text: 'PDF penawaran HD berhasil dibuat.' });
    } catch (error: any) {
      console.error('[Quotes] PDF export failed:', error);
      window.print();
      setMessage({ type: 'info', text: 'Export HD tidak tersedia di browser ini. Dialog cetak dibuka sebagai fallback PDF.' });
    } finally {
      setExporting(false);
    }
  };

  const selectRecord = (record: QuoteRecord) => {
    setSelectedId(record.id);
    setDraft(record.data);
    setMessage(null);
  };

  const previewStyle: React.CSSProperties = {
    backgroundColor: draft.backgroundColor,
    backgroundImage: draft.backgroundImageUrl ? `url(${draft.backgroundImageUrl})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: draft.textColor,
    fontFamily: draft.fontFamily,
  };

  return (
    <div className="quote-page space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#F26B5E]">
            <ReceiptText className="h-5 w-5" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Quotation Studio</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#24324A]">Penawaran Harga</h1>
          <p className="mt-1 max-w-2xl text-xs text-[#737680]">
            Buat penawaran harga yang dapat dikustomisasi, disimpan per workspace, dan diexport menjadi PDF tajam untuk klien.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={startNewQuote} className="inline-flex items-center gap-2 rounded-lg border border-[#DDE1E7] bg-white px-3.5 py-2.5 text-xs font-bold text-[#24324A] hover:border-[#24324A]">
            <Plus className="h-4 w-4" /> Penawaran Baru
          </button>
          <button type="button" onClick={saveQuote} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#24324A] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#1B263A] disabled:cursor-wait disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Menyimpan...' : 'Simpan Penawaran'}
          </button>
          <button type="button" onClick={exportPdf} disabled={exporting} title="Export PDF HD" className="inline-flex items-center gap-2 rounded-lg bg-[#F26B5E] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#DD5C51] disabled:cursor-wait disabled:opacity-60">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Membuat PDF...' : 'Export PDF HD'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-3 text-xs ${message.type === 'error' ? 'border-[#F3B7B0] bg-[#FFF0ED] text-[#B5473D]' : message.type === 'success' ? 'border-[#A8D8C0] bg-[#EEF8F2] text-[#317A58]' : 'border-[#C8D5E5] bg-[#EEF2F7] text-[#40536F]'}`}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} title="Tutup pesan" className="shrink-0 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto border-b border-[#E8E8EC] pb-3">
        <button type="button" onClick={startNewQuote} className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold transition ${!selectedId ? 'border-[#24324A] bg-[#24324A] text-white' : 'border-[#DDE1E7] bg-white text-[#737680] hover:text-[#24324A]'}`}>
          <Plus className="mr-1 inline h-3.5 w-3.5" /> Draft baru
        </button>
        {records.map((record) => (
          <button type="button" key={record.id} onClick={() => selectRecord(record)} className={`shrink-0 rounded-lg border px-3 py-2 text-left transition ${selectedId === record.id ? 'border-[#24324A] bg-[#EEF2F7]' : 'border-[#E8E8EC] bg-white hover:border-[#AAB5C5]'}`}>
            <span className="block text-xs font-bold text-[#24324A]">{record.quote_number}</span>
            <span className="block text-[10px] text-[#737680]">{record.data.recipientCompany || record.data.recipientName || 'Tanpa penerima'}</span>
          </button>
        ))}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#737680]" />}
        {!loading && records.length === 0 && <span className="text-xs text-[#737680]">Belum ada penawaran tersimpan.</span>}
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(360px,520px)_minmax(640px,1fr)]">
        <section className="quote-editor min-w-0 self-start rounded-xl border border-[#E8E8EC] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E8E8EC] px-5 py-4">
            <div>
              <h2 className="text-sm font-extrabold text-[#24324A]">Editor Penawaran</h2>
              <p className="mt-0.5 text-[11px] text-[#737680]">Semua perubahan tampil langsung pada preview.</p>
            </div>
            {selectedId && <button type="button" onClick={deleteQuote} title="Hapus penawaran" className="rounded-lg p-2 text-[#D95858] hover:bg-[#FFF0ED]"><Trash2 className="h-4 w-4" /></button>}
          </div>

          <div className="space-y-6 p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><FileText className="h-4 w-4 text-[#F26B5E]" /> Identitas Penawaran</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <InputLabel htmlFor="quote-number">Nomor Penawaran</InputLabel>
                  <div className="flex gap-2"><input id="quote-number" className={inputClass} value={draft.quoteNumber} onChange={(event) => updateField('quoteNumber', event.target.value)} /><button type="button" onClick={() => updateField('quoteNumber', generateQuoteNumber(draft.issuerName, draft.issueDate))} title="Buat nomor penawaran baru" className="shrink-0 rounded-lg border border-[#DDE1E7] px-2.5 text-[#24324A] hover:border-[#24324A]"><RefreshCw className="h-4 w-4" /></button></div>
                </div>
                <div><InputLabel htmlFor="quote-title">Judul</InputLabel><input id="quote-title" className={inputClass} value={draft.title} onChange={(event) => updateField('title', event.target.value)} /></div>
                <div><InputLabel htmlFor="quote-date">Tanggal Penawaran</InputLabel><input id="quote-date" type="date" className={inputClass} value={draft.issueDate} onChange={(event) => updateField('issueDate', event.target.value)} /></div>
                <div><InputLabel htmlFor="quote-valid-until">Berlaku Sampai</InputLabel><input id="quote-valid-until" type="date" className={inputClass} value={draft.validUntil} onChange={(event) => updateField('validUntil', event.target.value)} /></div>
                <div>
                  <InputLabel htmlFor="quote-currency">Mata Uang</InputLabel>
                  <div className="relative"><select id="quote-currency" className={`${inputClass} appearance-none pr-8`} value={draft.currency} onChange={(event) => updateField('currency', event.target.value)}>{CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[#737680]" /></div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><Palette className="h-4 w-4 text-[#F26B5E]" /> Tampilan</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><InputLabel htmlFor="quote-font">Font</InputLabel><div className="relative"><select id="quote-font" className={`${inputClass} appearance-none pr-8`} value={draft.fontFamily} onChange={(event) => updateField('fontFamily', event.target.value)}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[#737680]" /></div></div>
                <div className="grid grid-cols-3 gap-2"><div><InputLabel htmlFor="quote-bg">Background</InputLabel><input id="quote-bg" type="color" className="h-[42px] w-full cursor-pointer rounded-lg border border-[#DDE1E7] bg-white p-1" value={draft.backgroundColor} onChange={(event) => updateField('backgroundColor', event.target.value)} /></div><div><InputLabel htmlFor="quote-accent">Aksen</InputLabel><input id="quote-accent" type="color" className="h-[42px] w-full cursor-pointer rounded-lg border border-[#DDE1E7] bg-white p-1" value={draft.accentColor} onChange={(event) => updateField('accentColor', event.target.value)} /></div><div><InputLabel htmlFor="quote-text-color">Teks</InputLabel><input id="quote-text-color" type="color" className="h-[42px] w-full cursor-pointer rounded-lg border border-[#DDE1E7] bg-white p-1" value={draft.textColor} onChange={(event) => updateField('textColor', event.target.value)} /></div></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2"><label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-[#CBD3DE] px-3 py-2.5 text-xs text-[#40536F] hover:border-[#24324A]"><span className="flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Background image</span>{uploading === 'background' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}<input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event, 'backgroundImageUrl')} /></label>{draft.backgroundImageUrl && <button type="button" onClick={() => updateField('backgroundImageUrl', '')} className="rounded-lg border border-[#F3B7B0] px-3 py-2 text-xs font-bold text-[#B5473D] hover:bg-[#FFF0ED]">Hapus background image</button>}</div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><ImagePlus className="h-4 w-4 text-[#F26B5E]" /> Branding & Pihak</div>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-[#CBD3DE] p-3">
                {draft.logoUrl ? <img src={draft.logoUrl} alt="Logo penawaran" className="h-12 w-20 rounded object-contain" /> : <div className="flex h-12 w-20 items-center justify-center rounded bg-[#F7F7F8] text-[#737680]"><ImagePlus className="h-5 w-5" /></div>}
                <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#24324A]">Logo penawaran</p><p className="mt-0.5 text-[10px] text-[#737680]">PNG transparan tetap dipertahankan.</p></div>
                <label className="cursor-pointer rounded-lg bg-[#EEF2F7] px-3 py-2 text-[11px] font-bold text-[#24324A] hover:bg-[#E2E9F2]">{uploading === 'logo' ? 'Memproses...' : 'Upload'}<input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event, 'logoUrl')} /></label>
                {draft.logoUrl && <button type="button" onClick={() => updateField('logoUrl', '')} title="Hapus logo" className="rounded-lg p-2 text-[#D95858] hover:bg-[#FFF0ED]"><X className="h-4 w-4" /></button>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><InputLabel htmlFor="quote-issuer-name">Nama Bisnis</InputLabel><input id="quote-issuer-name" className={inputClass} value={draft.issuerName} onChange={(event) => updateField('issuerName', event.target.value)} /></div>
                <div><InputLabel htmlFor="quote-recipient-company">Nama Perusahaan Penerima</InputLabel><input id="quote-recipient-company" className={inputClass} value={draft.recipientCompany} onChange={(event) => updateField('recipientCompany', event.target.value)} /></div>
                <div><InputLabel htmlFor="quote-issuer-address">Alamat Bisnis</InputLabel><textarea id="quote-issuer-address" className={`${inputClass} min-h-20 resize-y`} value={draft.issuerAddress} onChange={(event) => updateField('issuerAddress', event.target.value)} /></div>
                <div><InputLabel htmlFor="quote-recipient-address">Alamat Penerima</InputLabel><textarea id="quote-recipient-address" className={`${inputClass} min-h-20 resize-y`} value={draft.recipientAddress} onChange={(event) => updateField('recipientAddress', event.target.value)} /></div>
                <div><InputLabel htmlFor="quote-issuer-email">Email Bisnis</InputLabel><input id="quote-issuer-email" type="email" className={inputClass} value={draft.issuerEmail} onChange={(event) => updateField('issuerEmail', event.target.value)} /></div>
                <div><InputLabel htmlFor="quote-recipient-name">Nama Penerima / PIC</InputLabel><input id="quote-recipient-name" className={inputClass} value={draft.recipientName} onChange={(event) => updateField('recipientName', event.target.value)} /></div>
                <div><InputLabel htmlFor="quote-issuer-phone">Telepon Bisnis</InputLabel><input id="quote-issuer-phone" className={inputClass} value={draft.issuerPhone} onChange={(event) => updateField('issuerPhone', event.target.value)} /></div>
                <div><InputLabel htmlFor="quote-recipient-email">Email Penerima</InputLabel><input id="quote-recipient-email" type="email" className={inputClass} value={draft.recipientEmail} onChange={(event) => updateField('recipientEmail', event.target.value)} /></div>
                <div className="sm:col-span-2"><InputLabel htmlFor="quote-recipient-phone">Telepon Penerima</InputLabel><input id="quote-recipient-phone" className={inputClass} value={draft.recipientPhone} onChange={(event) => updateField('recipientPhone', event.target.value)} /></div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-2"><div className="flex items-center gap-2 text-xs font-extrabold text-[#24324A]"><FileText className="h-4 w-4 text-[#F26B5E]" /> Item & Harga</div><button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F26B5E] hover:text-[#B5473D]"><Plus className="h-3.5 w-3.5" /> Tambah item</button></div>
              <div className="space-y-2">{draft.items.map((item) => <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_70px_110px_32px] items-end gap-2 rounded-lg bg-[#F7F7F8] p-2"><div><InputLabel>Deskripsi</InputLabel><input className={inputClass} value={item.description} onChange={(event) => updateItem(item.id, 'description', event.target.value)} /></div><div><InputLabel>Qty</InputLabel><input type="number" min="0" step="0.01" className={inputClass} value={item.quantity} onChange={(event) => updateItem(item.id, 'quantity', toNumber(event.target.value))} /></div><div><InputLabel>Harga</InputLabel><input type="number" min="0" step="1000" className={inputClass} value={item.unitPrice} onChange={(event) => updateItem(item.id, 'unitPrice', toNumber(event.target.value))} /></div><button type="button" onClick={() => removeItem(item.id)} title="Hapus item" className="mb-0.5 rounded-lg p-2 text-[#D95858] hover:bg-[#FFF0ED]"><Trash2 className="h-4 w-4" /></button></div>)}</div>
              <div className="grid gap-3 sm:grid-cols-2"><div><InputLabel htmlFor="quote-discount">Diskon (%)</InputLabel><input id="quote-discount" type="number" min="0" className={inputClass} value={draft.discountPercent} onChange={(event) => updateField('discountPercent', toNumber(event.target.value))} /></div><div><InputLabel htmlFor="quote-tax">Pajak (%)</InputLabel><input id="quote-tax" type="number" min="0" className={inputClass} value={draft.taxPercent} onChange={(event) => updateField('taxPercent', toNumber(event.target.value))} /></div></div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><CalendarDays className="h-4 w-4 text-[#F26B5E]" /> Ketentuan & Pembayaran</div>
              <div><InputLabel htmlFor="quote-notes">Keterangan Penawaran</InputLabel><textarea id="quote-notes" className={`${inputClass} min-h-20 resize-y`} value={draft.notes} onChange={(event) => updateField('notes', event.target.value)} /></div>
              <div><InputLabel htmlFor="quote-terms">Syarat & Ketentuan</InputLabel><textarea id="quote-terms" className={`${inputClass} min-h-24 resize-y`} value={draft.terms} onChange={(event) => updateField('terms', event.target.value)} /></div>
              <div><InputLabel htmlFor="quote-payment-title">Judul Pembayaran</InputLabel><input id="quote-payment-title" className={inputClass} value={draft.paymentTitle} onChange={(event) => updateField('paymentTitle', event.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><InputLabel htmlFor="quote-bank-name">Nama Bank</InputLabel><input id="quote-bank-name" className={inputClass} value={draft.bankName} onChange={(event) => updateField('bankName', event.target.value)} /></div><div><InputLabel htmlFor="quote-account-name">Nama Rekening</InputLabel><input id="quote-account-name" className={inputClass} value={draft.accountName} onChange={(event) => updateField('accountName', event.target.value)} /></div><div className="sm:col-span-2"><InputLabel htmlFor="quote-account-number">Nomor Rekening</InputLabel><input id="quote-account-number" className={inputClass} value={draft.accountNumber} onChange={(event) => updateField('accountNumber', event.target.value)} /></div></div>
              <div><InputLabel htmlFor="quote-payment-instructions">Instruksi Pembayaran</InputLabel><textarea id="quote-payment-instructions" className={`${inputClass} min-h-20 resize-y`} value={draft.paymentInstructions} onChange={(event) => updateField('paymentInstructions', event.target.value)} /></div>
              <div><InputLabel htmlFor="quote-footer">Footer</InputLabel><input id="quote-footer" className={inputClass} value={draft.footerText} onChange={(event) => updateField('footerText', event.target.value)} /></div>
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-[#E8E8EC] bg-[#EEF2F7] p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between px-1"><div><h2 className="text-sm font-extrabold text-[#24324A]">Preview A4</h2><p className="text-[11px] text-[#737680]">Ukuran siap cetak 210 x 297 mm.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#4F9D78]"><Check className="mr-1 inline h-3 w-3" /> Live preview</span></div>
          <div className="overflow-x-auto rounded-lg border border-[#D7DEE8] bg-[#DDE4ED] p-3">
            <div ref={previewRef} className="quote-print-target mx-auto min-h-[1123px] w-[794px] overflow-hidden bg-white shadow-xl" style={previewStyle}>
              <div className="flex min-h-[1123px] flex-col p-[64px]" style={{ color: draft.textColor }}>
                <div className="flex items-start justify-between gap-8 border-b-2 pb-8" style={{ borderColor: draft.accentColor }}>
                  <div className="flex min-w-0 items-start gap-2">
                    {draft.logoUrl ? <div className="flex h-16 w-20 shrink-0 items-center justify-start"><img src={draft.logoUrl} alt="Logo" className="max-h-full max-w-full rounded object-contain object-left" /></div> : <div className="flex h-16 w-20 shrink-0 items-center justify-start text-xs font-bold uppercase tracking-widest opacity-30">Logo</div>}
                    <div className="min-w-0"><h3 className="text-xl font-extrabold">{draft.issuerName || 'Nama Bisnis'}</h3><p className="mt-2 whitespace-pre-line text-[11px] leading-5 opacity-70">{draft.issuerAddress}</p><p className="text-[11px] opacity-70">{draft.issuerEmail}{draft.issuerPhone ? ` | ${draft.issuerPhone}` : ''}</p></div>
                  </div>
                  <div className="shrink-0 text-right"><h1 className="text-3xl font-black tracking-tight" style={{ color: draft.accentColor }}>{draft.title || 'PENAWARAN HARGA'}</h1><p className="mt-2 font-mono text-[11px] font-bold">{draft.quoteNumber}</p><p className="mt-1 text-[11px] opacity-70">Tanggal: {formatDate(draft.issueDate)}</p><p className="text-[11px] opacity-70">Berlaku sampai: {formatDate(draft.validUntil)}</p></div>
                </div>

                <div className="mt-9 grid grid-cols-2 gap-8"><div><p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Ditujukan kepada</p><p className="mt-2 text-base font-extrabold">{draft.recipientCompany || 'Nama Perusahaan'}</p><p className="mt-1 text-[12px] font-semibold">{draft.recipientName}</p><p className="mt-1 whitespace-pre-line text-[11px] leading-5 opacity-70">{draft.recipientAddress}</p><p className="text-[11px] opacity-70">{draft.recipientEmail}{draft.recipientPhone ? ` | ${draft.recipientPhone}` : ''}</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Nilai Penawaran</p><p className="mt-2 text-2xl font-black" style={{ color: draft.accentColor }}>{formatCurrency(totals.total, draft.currency)}</p><p className="mt-2 text-[11px] opacity-60">Estimasi berdasarkan item di bawah</p></div></div>

                <div className="mt-10"><table className="w-full border-collapse text-left"><thead><tr style={{ backgroundColor: `${draft.accentColor}18` }}><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Deskripsi</th><th className="w-20 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Qty</th><th className="w-32 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Harga</th><th className="w-36 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Jumlah</th></tr></thead><tbody>{draft.items.map((item) => <tr key={item.id} className="border-b" style={{ borderColor: `${draft.textColor}22` }}><td className="px-4 py-4 text-[12px]">{item.description}</td><td className="px-3 py-4 text-right text-[12px]">{item.quantity}</td><td className="px-3 py-4 text-right text-[12px]">{formatCurrency(item.unitPrice, draft.currency)}</td><td className="px-4 py-4 text-right text-[12px] font-bold">{formatCurrency(item.quantity * item.unitPrice, draft.currency)}</td></tr>)}</tbody></table></div>

                <div className="mt-6 flex justify-end"><div className="w-72 space-y-2 text-[11px]"><div className="flex justify-between"><span className="opacity-70">Subtotal</span><span>{formatCurrency(totals.subtotal, draft.currency)}</span></div>{totals.discount > 0 && <div className="flex justify-between"><span className="opacity-70">Diskon ({draft.discountPercent}%)</span><span>- {formatCurrency(totals.discount, draft.currency)}</span></div>}{totals.tax > 0 && <div className="flex justify-between"><span className="opacity-70">Pajak ({draft.taxPercent}%)</span><span>{formatCurrency(totals.tax, draft.currency)}</span></div>}<div className="flex justify-between border-t-2 pt-3 text-base font-black" style={{ borderColor: draft.accentColor }}><span>Total Penawaran</span><span style={{ color: draft.accentColor }}>{formatCurrency(totals.total, draft.currency)}</span></div></div></div>

                <div className="mt-8 grid grid-cols-2 gap-10 border-t pt-8" style={{ borderColor: `${draft.textColor}22` }}><div><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: draft.accentColor }}>{draft.paymentTitle}</p><p className="mt-3 text-[11px] font-bold">{draft.bankName}</p><p className="text-[11px] opacity-70">{draft.accountName}</p><p className="font-mono text-[11px] opacity-70">{draft.accountNumber}</p><p className="mt-3 whitespace-pre-line text-[10px] leading-4 opacity-60">{draft.paymentInstructions}</p></div><div><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: draft.accentColor }}>Keterangan</p><p className="mt-3 whitespace-pre-line text-[11px] leading-5 opacity-70">{draft.notes}</p></div></div>
                <div className="mt-8 border-t pt-6" style={{ borderColor: `${draft.textColor}22` }}><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: draft.accentColor }}>Syarat & Ketentuan</p><p className="mt-3 whitespace-pre-line text-[10px] leading-4 opacity-65">{draft.terms}</p></div>
                <p className="mt-auto pt-8 text-center text-[9px] opacity-50">{draft.footerText}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .quote-print-target, .quote-print-target * { visibility: visible !important; }
          .quote-print-target { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
