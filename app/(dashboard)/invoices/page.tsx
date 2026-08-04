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

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type InvoiceData = {
  invoiceNumber: string;
  title: string;
  invoiceDate: string;
  dueDate: string;
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
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  items: InvoiceItem[];
  discountPercent: number;
  taxPercent: number;
  notes: string;
  paymentTitle: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  paymentInstructions: string;
  footerText: string;
};

type InvoiceRecord = {
  id: string;
  workspace_id: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'void';
  data: InvoiceData;
  created_by_email?: string | null;
  created_at?: string;
  updated_at?: string;
};

const FONT_OPTIONS = [
  { value: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", label: 'Inter / Sans' },
  { value: "Arial, Helvetica, sans-serif", label: 'Arial' },
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

const LOCAL_STORAGE_KEY = 'bilik_invoice_records';

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return dateValue(next);
}

function generateInvoiceNumber() {
  const date = dateValue(new Date()).replaceAll('-', '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${date}-${suffix}`;
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function createDefaultInvoice(): InvoiceData {
  const today = new Date();
  return {
    invoiceNumber: generateInvoiceNumber(),
    title: 'INVOICE',
    invoiceDate: dateValue(today),
    dueDate: addDays(today, 14),
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
    clientName: 'Nama Klien',
    clientAddress: 'Alamat klien',
    clientEmail: '',
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
    notes: 'Terima kasih telah mempercayakan kebutuhan Anda kepada kami.',
    paymentTitle: 'INFORMASI PEMBAYARAN',
    bankName: 'Nama Bank',
    accountName: 'Nama Pemilik Rekening',
    accountNumber: '0000000000',
    paymentInstructions: 'Pembayaran dilakukan paling lambat pada tanggal jatuh tempo.',
    footerText: 'Invoice ini dibuat secara digital dan sah tanpa tanda tangan.',
  };
}

function normalizeInvoiceData(value: unknown, invoiceNumber?: string): InvoiceData {
  const defaults = createDefaultInvoice();
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const rawItems = Array.isArray(source.items) ? source.items : defaults.items;
  const items = rawItems.map((item, index) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      id: toText(row.id, `item-${index}-${Date.now()}`),
      description: toText(row.description, 'Item invoice'),
      quantity: Math.max(0, toNumber(row.quantity, 1)),
      unitPrice: Math.max(0, toNumber(row.unitPrice, 0)),
    };
  });

  return {
    ...defaults,
    ...source,
    invoiceNumber: toText(source.invoiceNumber, invoiceNumber || defaults.invoiceNumber),
    title: toText(source.title, defaults.title),
    invoiceDate: toText(source.invoiceDate, defaults.invoiceDate),
    dueDate: toText(source.dueDate, defaults.dueDate),
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
    clientName: toText(source.clientName, defaults.clientName),
    clientAddress: toText(source.clientAddress, defaults.clientAddress),
    clientEmail: toText(source.clientEmail, defaults.clientEmail),
    items,
    discountPercent: Math.max(0, toNumber(source.discountPercent, defaults.discountPercent)),
    taxPercent: Math.max(0, toNumber(source.taxPercent, defaults.taxPercent)),
    notes: toText(source.notes, defaults.notes),
    paymentTitle: toText(source.paymentTitle, defaults.paymentTitle),
    bankName: toText(source.bankName, defaults.bankName),
    accountName: toText(source.accountName, defaults.accountName),
    accountNumber: toText(source.accountNumber, defaults.accountNumber),
    paymentInstructions: toText(source.paymentInstructions, defaults.paymentInstructions),
    footerText: toText(source.footerText, defaults.footerText),
  };
}

function normalizeRecord(value: any, fallbackWorkspaceId: string): InvoiceRecord {
  return {
    id: toText(value?.id, `local-${Date.now()}`),
    workspace_id: toText(value?.workspace_id, fallbackWorkspaceId),
    invoice_number: toText(value?.invoice_number, value?.data?.invoiceNumber || generateInvoiceNumber()),
    status: ['draft', 'sent', 'paid', 'void'].includes(value?.status) ? value.status : 'draft',
    data: normalizeInvoiceData(value?.data, value?.invoice_number),
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
  if (typeof window === 'undefined') return [] as InvoiceRecord[];
  try {
    const raw = JSON.parse(localStorage.getItem(`${LOCAL_STORAGE_KEY}:${workspaceId}`) || '[]');
    return Array.isArray(raw) ? raw.map((item) => normalizeRecord(item, workspaceId)) : [];
  } catch {
    return [] as InvoiceRecord[];
  }
}

function writeLocalRecords(workspaceId: string, records: InvoiceRecord[]) {
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
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function InputLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-bold uppercase tracking-wide text-[#737680] mb-1.5">
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-[#DDE1E7] bg-white px-3 py-2.5 text-xs text-[#202124] outline-none transition focus:border-[#24324A] focus:ring-2 focus:ring-[#24324A]/10';

export default function InvoicesPage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('bilik-strategi');
  const [records, setRecords] = useState<InvoiceRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<InvoiceData>(() => createDefaultInvoice());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'background' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const totals = useMemo(() => {
    const subtotal = draft.items.reduce(
      (sum, item) => sum + Math.max(0, toNumber(item.quantity, 0)) * Math.max(0, toNumber(item.unitPrice, 0)),
      0
    );
    const discount = subtotal * (Math.max(0, toNumber(draft.discountPercent, 0)) / 100);
    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * (Math.max(0, toNumber(draft.taxPercent, 0)) / 100);
    return { subtotal, discount, tax, total: taxable + tax };
  }, [draft.items, draft.discountPercent, draft.taxPercent]);

  const loadInvoices = useCallback(async () => {
    const localRecords = readLocalRecords(workspaceId);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('app_invoices')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const nextRecords = data.map((item) => normalizeRecord(item, workspaceId));
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
        setLoading(false);
        return;
      }

      if (error) throw error;
    } catch (error: any) {
      console.warn('[Invoices] Supabase load failed, using local recovery:', error?.message || error);
      if (localRecords.length > 0) {
        setRecords(localRecords);
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
    loadInvoices();

    const channel = supabase
      .channel(`invoice-studio-${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_invoices', filter: `workspace_id=eq.${workspaceId}` },
        () => loadInvoices()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInvoices, mounted, workspaceId]);

  useEffect(() => {
    if (!mounted) return;
    const current = records.find((item) => item.id === selectedId);
    if (current) setDraft(current.data);
  }, [mounted, records, selectedId]);

  useEffect(() => {
    if (!mounted) return;
    const draftRecord: InvoiceRecord = {
      id: selectedId || 'local-draft',
      workspace_id: workspaceId,
      invoice_number: draft.invoiceNumber,
      status: 'draft',
      data: draft,
      updated_at: new Date().toISOString(),
    };
    const localRecords = readLocalRecords(workspaceId);
    const withoutCurrent = localRecords.filter((item) => item.id !== draftRecord.id && item.invoice_number !== draft.invoiceNumber);
    writeLocalRecords(workspaceId, [...withoutCurrent, draftRecord]);
  }, [draft, mounted, selectedId, workspaceId]);

  const updateField = <K extends keyof InvoiceData>(field: K, value: InvoiceData[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'backgroundImageUrl') => {
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

  const startNewInvoice = () => {
    setSelectedId('');
    setDraft(createDefaultInvoice());
    setMessage({ type: 'info', text: 'Draft invoice baru siap diedit. Simpan untuk memasukkannya ke daftar.' });
  };

  const saveInvoice = async () => {
    const invoiceNumber = draft.invoiceNumber.trim() || generateInvoiceNumber();
    const normalizedDraft = normalizeInvoiceData({ ...draft, invoiceNumber }, invoiceNumber);
    setDraft(normalizedDraft);
    setSaving(true);
    setMessage(null);

    const payload = {
      workspace_id: workspaceId,
      invoice_number: invoiceNumber,
      status: 'draft',
      data: normalizedDraft,
      created_by_email: getCurrentEmail() || null,
      updated_at: new Date().toISOString(),
    };
    const selectedRecord = records.find((item) => item.id === selectedId);

    try {
      const result = selectedRecord && !selectedId.startsWith('local-')
        ? await supabase.from('app_invoices').update(payload).eq('id', selectedId).select('*').single()
        : await supabase.from('app_invoices').insert(payload).select('*').single();

      if (result.error) throw result.error;
      const savedRecord = normalizeRecord(result.data, workspaceId);
      setRecords((current) => {
        const remaining = current.filter((item) => item.id !== savedRecord.id && item.invoice_number !== savedRecord.invoice_number);
        return [savedRecord, ...remaining];
      });
      setSelectedId(savedRecord.id);
      setDraft(savedRecord.data);
      setMessage({ type: 'success', text: `Invoice ${savedRecord.invoice_number} tersimpan ke workspace.` });
    } catch (error: any) {
      const localRecord = normalizeRecord(
        {
          id: selectedRecord?.id?.startsWith('local-') ? selectedRecord.id : `local-${Date.now()}`,
          workspace_id: workspaceId,
          invoice_number: invoiceNumber,
          status: 'draft',
          data: normalizedDraft,
          updated_at: new Date().toISOString(),
        },
        workspaceId
      );
      const nextRecords = [localRecord, ...records.filter((item) => item.id !== selectedRecord?.id && item.invoice_number !== invoiceNumber)];
      setRecords(nextRecords);
      setSelectedId(localRecord.id);
      setDraft(localRecord.data);
      writeLocalRecords(workspaceId, nextRecords);
      setMessage({ type: 'info', text: `Tersimpan di perangkat. Jalankan SQL invoice agar tersimpan lintas user. (${error?.message || 'Supabase belum siap'})` });
    } finally {
      setSaving(false);
    }
  };

  const deleteInvoice = async () => {
    if (!selectedId) return;
    const selectedRecord = records.find((item) => item.id === selectedId);
    if (!selectedRecord || !window.confirm(`Hapus invoice ${selectedRecord.invoice_number}?`)) return;

    try {
      if (!selectedId.startsWith('local-')) {
        const { error } = await supabase.from('app_invoices').delete().eq('id', selectedId);
        if (error) throw error;
      }
      const nextRecords = records.filter((item) => item.id !== selectedId);
      setRecords(nextRecords);
      writeLocalRecords(workspaceId, nextRecords);
      setSelectedId(nextRecords[0]?.id || '');
      setDraft(nextRecords[0]?.data || createDefaultInvoice());
      setMessage({ type: 'success', text: 'Invoice dihapus.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Invoice gagal dihapus.' });
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
      const image = canvas.toDataURL('image/png', 1);
      pdf.addImage(image, 'PNG', (pageWidth - imageWidth) / 2, 0, imageWidth, imageHeight, undefined, 'FAST');
      pdf.save(`${draft.invoiceNumber || 'invoice'}.pdf`);
      setMessage({ type: 'success', text: 'PDF HD berhasil dibuat.' });
    } catch (error: any) {
      console.error('[Invoices] PDF export failed:', error);
      window.print();
      setMessage({ type: 'info', text: 'Export HD tidak tersedia di browser ini. Dialog cetak dibuka sebagai fallback PDF.' });
    } finally {
      setExporting(false);
    }
  };

  const selectRecord = (record: InvoiceRecord) => {
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
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#F26B5E]">
            <ReceiptText className="h-5 w-5" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Invoice Studio</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#24324A]">Invoice</h1>
          <p className="mt-1 max-w-2xl text-xs text-[#737680]">
            Buat invoice yang dapat dikustomisasi, disimpan per workspace, dan diexport menjadi PDF tajam untuk dikirim ke klien.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startNewInvoice}
            className="inline-flex items-center gap-2 rounded-lg border border-[#DDE1E7] bg-white px-3.5 py-2.5 text-xs font-bold text-[#24324A] hover:border-[#24324A]"
          >
            <Plus className="h-4 w-4" /> Invoice Baru
          </button>
          <button
            type="button"
            onClick={saveInvoice}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#24324A] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#1B263A] disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Menyimpan...' : 'Simpan Invoice'}
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={exporting}
            title="Export PDF HD"
            className="inline-flex items-center gap-2 rounded-lg bg-[#F26B5E] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#DD5C51] disabled:cursor-wait disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Membuat PDF...' : 'Export PDF HD'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-3 text-xs ${
            message.type === 'error'
              ? 'border-[#F3B7B0] bg-[#FFF0ED] text-[#B5473D]'
              : message.type === 'success'
                ? 'border-[#A8D8C0] bg-[#EEF8F2] text-[#317A58]'
                : 'border-[#C8D5E5] bg-[#EEF2F7] text-[#40536F]'
          }`}
        >
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} title="Tutup pesan" className="shrink-0 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto border-b border-[#E8E8EC] pb-3">
        <button
          type="button"
          onClick={startNewInvoice}
          className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold transition ${
            !selectedId ? 'border-[#24324A] bg-[#24324A] text-white' : 'border-[#DDE1E7] bg-white text-[#737680] hover:text-[#24324A]'
          }`}
        >
          <Plus className="mr-1 inline h-3.5 w-3.5" /> Draft baru
        </button>
        {records.map((record) => (
          <button
            type="button"
            key={record.id}
            onClick={() => selectRecord(record)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-left transition ${
              selectedId === record.id ? 'border-[#24324A] bg-[#EEF2F7]' : 'border-[#E8E8EC] bg-white hover:border-[#AAB5C5]'
            }`}
          >
            <span className="block text-xs font-bold text-[#24324A]">{record.invoice_number}</span>
            <span className="block text-[10px] text-[#737680]">{record.data.clientName || 'Tanpa klien'}</span>
          </button>
        ))}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#737680]" />}
        {!loading && records.length === 0 && <span className="text-xs text-[#737680]">Belum ada invoice tersimpan.</span>}
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(360px,520px)_minmax(640px,1fr)]">
        <section className="invoice-editor min-w-0 rounded-xl border border-[#E8E8EC] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E8E8EC] px-5 py-4">
            <div>
              <h2 className="text-sm font-extrabold text-[#24324A]">Editor Invoice</h2>
              <p className="mt-0.5 text-[11px] text-[#737680]">Semua perubahan tampil langsung pada preview.</p>
            </div>
            {selectedId && (
              <button type="button" onClick={deleteInvoice} title="Hapus invoice" className="rounded-lg p-2 text-[#D95858] hover:bg-[#FFF0ED]">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[calc(100vh-220px)] space-y-6 overflow-y-auto p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><FileText className="h-4 w-4 text-[#F26B5E]" /> Identitas Invoice</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <InputLabel htmlFor="invoice-number">Nomor Invoice</InputLabel>
                  <div className="flex gap-2">
                    <input id="invoice-number" className={inputClass} value={draft.invoiceNumber} onChange={(event) => updateField('invoiceNumber', event.target.value)} />
                    <button type="button" onClick={() => updateField('invoiceNumber', generateInvoiceNumber())} title="Buat nomor invoice baru" className="shrink-0 rounded-lg border border-[#DDE1E7] px-2.5 text-[#24324A] hover:border-[#24324A]"><RefreshCw className="h-4 w-4" /></button>
                  </div>
                </div>
                <div>
                  <InputLabel htmlFor="invoice-title">Judul</InputLabel>
                  <input id="invoice-title" className={inputClass} value={draft.title} onChange={(event) => updateField('title', event.target.value)} />
                </div>
                <div>
                  <InputLabel htmlFor="invoice-date">Tanggal Invoice</InputLabel>
                  <input id="invoice-date" type="date" className={inputClass} value={draft.invoiceDate} onChange={(event) => updateField('invoiceDate', event.target.value)} />
                </div>
                <div>
                  <InputLabel htmlFor="invoice-due-date">Jatuh Tempo</InputLabel>
                  <input id="invoice-due-date" type="date" className={inputClass} value={draft.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} />
                </div>
                <div>
                  <InputLabel htmlFor="invoice-currency">Mata Uang</InputLabel>
                  <div className="relative">
                    <select id="invoice-currency" className={`${inputClass} appearance-none pr-8`} value={draft.currency} onChange={(event) => updateField('currency', event.target.value)}>
                      {CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[#737680]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><Palette className="h-4 w-4 text-[#F26B5E]" /> Tampilan</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <InputLabel htmlFor="invoice-font">Font</InputLabel>
                  <div className="relative">
                    <select id="invoice-font" className={`${inputClass} appearance-none pr-8`} value={draft.fontFamily} onChange={(event) => updateField('fontFamily', event.target.value)}>
                      {FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[#737680]" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><InputLabel htmlFor="invoice-bg">Background</InputLabel><input id="invoice-bg" type="color" className="h-[42px] w-full cursor-pointer rounded-lg border border-[#DDE1E7] bg-white p-1" value={draft.backgroundColor} onChange={(event) => updateField('backgroundColor', event.target.value)} /></div>
                  <div><InputLabel htmlFor="invoice-accent">Aksen</InputLabel><input id="invoice-accent" type="color" className="h-[42px] w-full cursor-pointer rounded-lg border border-[#DDE1E7] bg-white p-1" value={draft.accentColor} onChange={(event) => updateField('accentColor', event.target.value)} /></div>
                  <div><InputLabel htmlFor="invoice-text-color">Teks</InputLabel><input id="invoice-text-color" type="color" className="h-[42px] w-full cursor-pointer rounded-lg border border-[#DDE1E7] bg-white p-1" value={draft.textColor} onChange={(event) => updateField('textColor', event.target.value)} /></div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-[#CBD3DE] px-3 py-2.5 text-xs text-[#40536F] hover:border-[#24324A]">
                  <span className="flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Background image</span>
                  {uploading === 'background' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event, 'backgroundImageUrl')} />
                </label>
                {draft.backgroundImageUrl && <button type="button" onClick={() => updateField('backgroundImageUrl', '')} className="rounded-lg border border-[#F3B7B0] px-3 py-2 text-xs font-bold text-[#B5473D] hover:bg-[#FFF0ED]">Hapus background image</button>}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><ImagePlus className="h-4 w-4 text-[#F26B5E]" /> Branding & Pihak</div>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-[#CBD3DE] p-3">
                {draft.logoUrl ? <img src={draft.logoUrl} alt="Logo invoice" className="h-12 w-20 rounded object-contain" /> : <div className="flex h-12 w-20 items-center justify-center rounded bg-[#F7F7F8] text-[#737680]"><ImagePlus className="h-5 w-5" /></div>}
                <div className="flex-1"><p className="text-xs font-bold text-[#24324A]">Logo invoice</p><p className="mt-0.5 text-[10px] text-[#737680]">Gambar diperkecil otomatis agar aman disimpan.</p></div>
                <label className="cursor-pointer rounded-lg bg-[#EEF2F7] px-3 py-2 text-[11px] font-bold text-[#24324A] hover:bg-[#E2E9F2]">{uploading === 'logo' ? 'Memproses...' : 'Upload'}<input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event, 'logoUrl')} /></label>
                {draft.logoUrl && <button type="button" onClick={() => updateField('logoUrl', '')} title="Hapus logo" className="rounded-lg p-2 text-[#D95858] hover:bg-[#FFF0ED]"><X className="h-4 w-4" /></button>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><InputLabel htmlFor="issuer-name">Nama Bisnis</InputLabel><input id="issuer-name" className={inputClass} value={draft.issuerName} onChange={(event) => updateField('issuerName', event.target.value)} /></div>
                <div><InputLabel htmlFor="client-name">Nama Klien</InputLabel><input id="client-name" className={inputClass} value={draft.clientName} onChange={(event) => updateField('clientName', event.target.value)} /></div>
                <div><InputLabel htmlFor="issuer-address">Alamat Bisnis</InputLabel><textarea id="issuer-address" className={`${inputClass} min-h-20 resize-y`} value={draft.issuerAddress} onChange={(event) => updateField('issuerAddress', event.target.value)} /></div>
                <div><InputLabel htmlFor="client-address">Alamat Klien</InputLabel><textarea id="client-address" className={`${inputClass} min-h-20 resize-y`} value={draft.clientAddress} onChange={(event) => updateField('clientAddress', event.target.value)} /></div>
                <div><InputLabel htmlFor="issuer-email">Email Bisnis</InputLabel><input id="issuer-email" type="email" className={inputClass} value={draft.issuerEmail} onChange={(event) => updateField('issuerEmail', event.target.value)} /></div>
                <div><InputLabel htmlFor="client-email">Email Klien</InputLabel><input id="client-email" type="email" className={inputClass} value={draft.clientEmail} onChange={(event) => updateField('clientEmail', event.target.value)} /></div>
                <div className="sm:col-span-2"><InputLabel htmlFor="issuer-phone">Telepon Bisnis</InputLabel><input id="issuer-phone" className={inputClass} value={draft.issuerPhone} onChange={(event) => updateField('issuerPhone', event.target.value)} /></div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#E8E8EC] pb-2"><div className="flex items-center gap-2 text-xs font-extrabold text-[#24324A]"><FileText className="h-4 w-4 text-[#F26B5E]" /> Item & Harga</div><button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F26B5E] hover:text-[#B5473D]"><Plus className="h-3.5 w-3.5" /> Tambah item</button></div>
              <div className="space-y-2">
                {draft.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_70px_110px_32px] items-end gap-2 rounded-lg bg-[#F7F7F8] p-2">
                    <div><InputLabel>Deskripsi</InputLabel><input className={inputClass} value={item.description} onChange={(event) => updateItem(item.id, 'description', event.target.value)} /></div>
                    <div><InputLabel>Qty</InputLabel><input type="number" min="0" step="0.01" className={inputClass} value={item.quantity} onChange={(event) => updateItem(item.id, 'quantity', toNumber(event.target.value))} /></div>
                    <div><InputLabel>Harga</InputLabel><input type="number" min="0" step="1000" className={inputClass} value={item.unitPrice} onChange={(event) => updateItem(item.id, 'unitPrice', toNumber(event.target.value))} /></div>
                    <button type="button" onClick={() => removeItem(item.id)} title="Hapus item" className="mb-0.5 rounded-lg p-2 text-[#D95858] hover:bg-[#FFF0ED]"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2"><div><InputLabel htmlFor="discount-percent">Diskon (%)</InputLabel><input id="discount-percent" type="number" min="0" className={inputClass} value={draft.discountPercent} onChange={(event) => updateField('discountPercent', toNumber(event.target.value))} /></div><div><InputLabel htmlFor="tax-percent">Pajak (%)</InputLabel><input id="tax-percent" type="number" min="0" className={inputClass} value={draft.taxPercent} onChange={(event) => updateField('taxPercent', toNumber(event.target.value))} /></div></div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><CalendarDays className="h-4 w-4 text-[#F26B5E]" /> Pembayaran & Catatan</div>
              <div><InputLabel htmlFor="payment-title">Judul Pembayaran</InputLabel><input id="payment-title" className={inputClass} value={draft.paymentTitle} onChange={(event) => updateField('paymentTitle', event.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><InputLabel htmlFor="bank-name">Nama Bank</InputLabel><input id="bank-name" className={inputClass} value={draft.bankName} onChange={(event) => updateField('bankName', event.target.value)} /></div><div><InputLabel htmlFor="account-name">Nama Rekening</InputLabel><input id="account-name" className={inputClass} value={draft.accountName} onChange={(event) => updateField('accountName', event.target.value)} /></div><div className="sm:col-span-2"><InputLabel htmlFor="account-number">Nomor Rekening</InputLabel><input id="account-number" className={inputClass} value={draft.accountNumber} onChange={(event) => updateField('accountNumber', event.target.value)} /></div></div>
              <div><InputLabel htmlFor="payment-instructions">Instruksi Pembayaran</InputLabel><textarea id="payment-instructions" className={`${inputClass} min-h-20 resize-y`} value={draft.paymentInstructions} onChange={(event) => updateField('paymentInstructions', event.target.value)} /></div>
              <div><InputLabel htmlFor="invoice-notes">Catatan Invoice</InputLabel><textarea id="invoice-notes" className={`${inputClass} min-h-20 resize-y`} value={draft.notes} onChange={(event) => updateField('notes', event.target.value)} /></div>
              <div><InputLabel htmlFor="invoice-footer">Footer</InputLabel><input id="invoice-footer" className={inputClass} value={draft.footerText} onChange={(event) => updateField('footerText', event.target.value)} /></div>
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-[#E8E8EC] bg-[#EEF2F7] p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between px-1"><div><h2 className="text-sm font-extrabold text-[#24324A]">Preview A4</h2><p className="text-[11px] text-[#737680]">Ukuran siap cetak 210 x 297 mm.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#4F9D78]"><Check className="mr-1 inline h-3 w-3" /> Live preview</span></div>
          <div className="overflow-x-auto rounded-lg border border-[#D7DEE8] bg-[#DDE4ED] p-3">
            <div ref={previewRef} className="invoice-print-target mx-auto min-h-[1123px] w-[794px] overflow-hidden bg-white shadow-xl" style={previewStyle}>
              <div className="flex min-h-[1123px] flex-col p-[64px]" style={{ color: draft.textColor }}>
                <div className="flex items-start justify-between gap-8 border-b-2 pb-8" style={{ borderColor: draft.accentColor }}>
                  <div className="flex min-w-0 items-start gap-4">
                    {draft.logoUrl ? <img src={draft.logoUrl} alt="Logo" className="h-16 w-24 rounded object-contain object-left" /> : <div className="flex h-16 w-24 items-center justify-start text-xs font-bold uppercase tracking-widest opacity-30">Logo</div>}
                    <div className="min-w-0"><h3 className="text-xl font-extrabold" style={{ color: draft.textColor }}>{draft.issuerName || 'Nama Bisnis'}</h3><p className="mt-2 whitespace-pre-line text-[11px] leading-5 opacity-70">{draft.issuerAddress}</p><p className="text-[11px] opacity-70">{draft.issuerEmail}{draft.issuerPhone ? ` | ${draft.issuerPhone}` : ''}</p></div>
                  </div>
                  <div className="shrink-0 text-right"><h1 className="text-3xl font-black tracking-tight" style={{ color: draft.accentColor }}>{draft.title || 'INVOICE'}</h1><p className="mt-2 font-mono text-[11px] font-bold">{draft.invoiceNumber}</p><p className="mt-1 text-[11px] opacity-70">Tanggal: {formatDate(draft.invoiceDate)}</p><p className="text-[11px] opacity-70">Jatuh tempo: {formatDate(draft.dueDate)}</p></div>
                </div>

                <div className="mt-9 grid grid-cols-2 gap-8"><div><p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Ditagihkan kepada</p><p className="mt-2 text-base font-extrabold">{draft.clientName || 'Nama Klien'}</p><p className="mt-1 whitespace-pre-line text-[11px] leading-5 opacity-70">{draft.clientAddress}</p><p className="text-[11px] opacity-70">{draft.clientEmail}</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Total tagihan</p><p className="mt-2 text-2xl font-black" style={{ color: draft.accentColor }}>{formatCurrency(totals.total, draft.currency)}</p></div></div>

                <div className="mt-10"><table className="w-full border-collapse text-left"><thead><tr style={{ backgroundColor: `${draft.accentColor}18` }}><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Deskripsi</th><th className="w-20 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Qty</th><th className="w-32 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Harga</th><th className="w-36 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Jumlah</th></tr></thead><tbody>{draft.items.map((item) => <tr key={item.id} className="border-b" style={{ borderColor: `${draft.textColor}22` }}><td className="px-4 py-4 text-[12px]">{item.description}</td><td className="px-3 py-4 text-right text-[12px]">{item.quantity}</td><td className="px-3 py-4 text-right text-[12px]">{formatCurrency(item.unitPrice, draft.currency)}</td><td className="px-4 py-4 text-right text-[12px] font-bold">{formatCurrency(item.quantity * item.unitPrice, draft.currency)}</td></tr>)}</tbody></table></div>

                <div className="mt-6 flex justify-end"><div className="w-72 space-y-2 text-[11px]"><div className="flex justify-between"><span className="opacity-70">Subtotal</span><span>{formatCurrency(totals.subtotal, draft.currency)}</span></div>{totals.discount > 0 && <div className="flex justify-between"><span className="opacity-70">Diskon ({draft.discountPercent}%)</span><span>- {formatCurrency(totals.discount, draft.currency)}</span></div>}{totals.tax > 0 && <div className="flex justify-between"><span className="opacity-70">Pajak ({draft.taxPercent}%)</span><span>{formatCurrency(totals.tax, draft.currency)}</span></div>}<div className="flex justify-between border-t-2 pt-3 text-base font-black" style={{ borderColor: draft.accentColor }}><span>Total</span><span style={{ color: draft.accentColor }}>{formatCurrency(totals.total, draft.currency)}</span></div></div></div>

                <div className="mt-auto grid grid-cols-2 gap-10 border-t pt-8" style={{ borderColor: `${draft.textColor}22` }}><div><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: draft.accentColor }}>{draft.paymentTitle}</p><p className="mt-3 text-[11px] font-bold">{draft.bankName}</p><p className="text-[11px] opacity-70">{draft.accountName}</p><p className="font-mono text-[11px] opacity-70">{draft.accountNumber}</p><p className="mt-3 whitespace-pre-line text-[10px] leading-4 opacity-60">{draft.paymentInstructions}</p></div><div className="text-right"><p className="whitespace-pre-line text-[11px] leading-5 opacity-70">{draft.notes}</p></div></div>
                <p className="mt-8 text-center text-[9px] opacity-50">{draft.footerText}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .invoice-print-target, .invoice-print-target * { visibility: visible !important; }
          .invoice-print-target { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
