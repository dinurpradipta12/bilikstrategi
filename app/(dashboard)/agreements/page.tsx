'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  FileSignature,
  ImagePlus,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

type AgreementSection = {
  id: string;
  heading: string;
  body: string;
  items: string[];
};

type AgreementData = {
  agreementNumber: string;
  documentTitle: string;
  agreementTitle: string;
  issueDate: string;
  issueCity: string;
  fontFamily: string;
  backgroundColor: string;
  backgroundImageUrl: string;
  accentColor: string;
  textColor: string;
  logoUrl: string;
  signatureImageUrl: string;
  clientBlockTitle: string;
  recipientBlockTitle: string;
  issuerName: string;
  issuerAddress: string;
  issuerEmail: string;
  issuerPhone: string;
  clientName: string;
  clientBusinessType: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
  clientSocialHandle: string;
  recipientName: string;
  recipientRole: string;
  recipientCompany: string;
  openingText: string;
  sections: AgreementSection[];
  closingText: string;
  signatureName: string;
  signatureRole: string;
  signatureCompany: string;
  footerText: string;
};

type AgreementRecord = {
  id: string;
  workspace_id: string;
  agreement_number: string;
  status: 'draft' | 'sent' | 'signed' | 'archived';
  data: AgreementData;
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

const LOCAL_STORAGE_KEY = 'bilik_agreement_records';
const INITIAL_AGREEMENT_NUMBER = 'CA/BS/DRAFT/0000/0000';
const AGREEMENT_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const AGENCY_PREFIXES = new Set(['PT', 'CV', 'UD', 'FA', 'TB', 'LTD', 'INC', 'YAYASAN']);

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateAgreementId(length = 6) {
  const values = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(values);
    return Array.from(values, (value) => AGREEMENT_ID_ALPHABET[value % AGREEMENT_ID_ALPHABET.length]).join('');
  }
  return Array.from({ length }, () => AGREEMENT_ID_ALPHABET[Math.floor(Math.random() * AGREEMENT_ID_ALPHABET.length)]).join('');
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

function dateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return { year: match[1], day: match[3], month: match[2] };
  const today = new Date();
  return { year: String(today.getFullYear()), day: String(today.getDate()).padStart(2, '0'), month: String(today.getMonth() + 1).padStart(2, '0') };
}

function generateAgreementNumber(agencyName = 'Bilik Strategi', issueDate = dateValue(new Date())) {
  const { year, day, month } = dateParts(issueDate);
  return `CA/${generateAgreementId()}/${abbreviateAgencyName(agencyName)}/${day}${month}/${year}`;
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function createDefaultAgreement(initialAgreementNumber?: string): AgreementData {
  const today = new Date();
  const todayValue = dateValue(today);
  return {
    agreementNumber: initialAgreementNumber || generateAgreementNumber('Bilik Strategi', todayValue),
    documentTitle: 'SURAT KETERANGAN',
    agreementTitle: 'COLLABORATION AGREEMENT',
    issueDate: todayValue,
    issueCity: 'Banjarmasin',
    fontFamily: FONT_OPTIONS[0].value,
    backgroundColor: '#FFFFFF',
    backgroundImageUrl: '',
    accentColor: '#24324A',
    textColor: '#202124',
    logoUrl: '',
    signatureImageUrl: '',
    clientBlockTitle: 'Teruntuk Klien di bawah ini:',
    recipientBlockTitle: 'Akan menyerahkan kepada:',
    issuerName: 'Bilik Strategi',
    issuerAddress: 'Tuliskan alamat bisnis Anda',
    issuerEmail: 'hello@bilikstrategi.com',
    issuerPhone: '',
    clientName: 'a.n Nama Klien',
    clientBusinessType: 'Tipe usaha',
    clientAddress: 'Alamat klien',
    clientEmail: '',
    clientPhone: '',
    clientSocialHandle: 'akun.media.sosial',
    recipientName: 'Nama Penanggung Jawab',
    recipientRole: 'Jabatan / Peran',
    recipientCompany: 'Nama Tim / Perusahaan',
    openingText: 'Dengan ini menerangkan hal-hal yang berkaitan dengan kerja sama dan pengelolaan kebutuhan digital klien sebagai berikut:',
    sections: [
      { id: generateId(), heading: 'Akses atau aset yang diberikan oleh pihak klien:', body: '', items: ['Akses sosial media dan kredensial yang diperlukan', 'Akses platform pendukung untuk kebutuhan pekerjaan'] },
      { id: generateId(), heading: '', body: 'Selanjutnya, akses yang diberikan oleh pihak {{client_social}} akan digunakan oleh tim {{issuer_name}} untuk keperluan optimalisasi dan produksi konten {{client_social}}, sebagaimana mestinya.', items: [] },
      { id: generateId(), heading: 'Ruang lingkup pekerjaan yang akan kami lakukan:', body: '', items: ['Produksi dan publikasi konten', 'Pengelolaan story dan repost', 'Analisis performa konten', 'Optimalisasi akun dan kanal digital', 'Monitoring aktivitas kampanye'] },
      { id: generateId(), heading: '', body: 'Bila pihak {{client_social}} menemukan hal-hal yang janggal atas penggunaan akses oleh tim {{issuer_name}}, pihak {{client_social}} berhak memberikan teguran dan meninjau kembali hubungan kerja sama sesuai kesepakatan kedua belah pihak.', items: [] },
    ],
    closingText: '',
    signatureName: 'Nama Penandatangan',
    signatureRole: 'Jabatan Penandatangan',
    signatureCompany: 'Nama Perusahaan / Tim',
    footerText: 'Dokumen ini dibuat secara digital dan dapat digunakan sebagai dokumen kerja sama.',
  };
}

function normalizeAgreementData(value: unknown, agreementNumber?: string): AgreementData {
  const defaults = createDefaultAgreement();
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const rawSections = Array.isArray(source.sections) ? source.sections : defaults.sections;
  const sections = rawSections.map((section, index) => {
    const row = section && typeof section === 'object' ? (section as Record<string, unknown>) : {};
    const rawItems = Array.isArray(row.items) ? row.items : [];
    return {
      id: toText(row.id, `section-${index}-${Date.now()}`),
      heading: toText(row.heading),
      body: toText(row.body),
      items: rawItems.map((item) => toText(item)).filter(Boolean),
    };
  });

  return {
    ...defaults,
    ...source,
    agreementNumber: toText(source.agreementNumber, agreementNumber || defaults.agreementNumber),
    documentTitle: toText(source.documentTitle, defaults.documentTitle),
    agreementTitle: toText(source.agreementTitle, defaults.agreementTitle),
    issueDate: toText(source.issueDate, defaults.issueDate),
    issueCity: toText(source.issueCity, defaults.issueCity),
    fontFamily: toText(source.fontFamily, defaults.fontFamily),
    backgroundColor: toText(source.backgroundColor, defaults.backgroundColor),
    backgroundImageUrl: toText(source.backgroundImageUrl, defaults.backgroundImageUrl),
    accentColor: toText(source.accentColor, defaults.accentColor),
    textColor: toText(source.textColor, defaults.textColor),
    logoUrl: toText(source.logoUrl, defaults.logoUrl),
    signatureImageUrl: toText(source.signatureImageUrl, defaults.signatureImageUrl),
    clientBlockTitle: toText(source.clientBlockTitle, defaults.clientBlockTitle),
    recipientBlockTitle: toText(source.recipientBlockTitle, defaults.recipientBlockTitle),
    issuerName: toText(source.issuerName, defaults.issuerName),
    issuerAddress: toText(source.issuerAddress, defaults.issuerAddress),
    issuerEmail: toText(source.issuerEmail, defaults.issuerEmail),
    issuerPhone: toText(source.issuerPhone, defaults.issuerPhone),
    clientName: toText(source.clientName, defaults.clientName),
    clientBusinessType: toText(source.clientBusinessType, defaults.clientBusinessType),
    clientAddress: toText(source.clientAddress, defaults.clientAddress),
    clientEmail: toText(source.clientEmail, defaults.clientEmail),
    clientPhone: toText(source.clientPhone, defaults.clientPhone),
    clientSocialHandle: toText(source.clientSocialHandle, defaults.clientSocialHandle),
    recipientName: toText(source.recipientName, defaults.recipientName),
    recipientRole: toText(source.recipientRole, defaults.recipientRole),
    recipientCompany: toText(source.recipientCompany, defaults.recipientCompany),
    openingText: toText(source.openingText, defaults.openingText),
    sections,
    closingText: toText(source.closingText, defaults.closingText),
    signatureName: toText(source.signatureName, defaults.signatureName),
    signatureRole: toText(source.signatureRole, defaults.signatureRole),
    signatureCompany: toText(source.signatureCompany, defaults.signatureCompany),
    footerText: toText(source.footerText, defaults.footerText),
  };
}

function normalizeRecord(value: any, fallbackWorkspaceId: string): AgreementRecord {
  const rawData = value?.data && typeof value.data === 'object' && !Array.isArray(value.data) ? value.data : {};
  const fallbackNumber = generateAgreementNumber(toText(rawData.issuerName, 'Bilik Strategi'), toText(rawData.issueDate, dateValue(new Date())));
  const status = ['draft', 'sent', 'signed', 'archived'].includes(value?.status) ? value.status : 'draft';
  return {
    id: toText(value?.id, `local-${Date.now()}`),
    workspace_id: toText(value?.workspace_id, fallbackWorkspaceId),
    agreement_number: toText(value?.agreement_number, rawData.agreementNumber || fallbackNumber),
    status,
    data: normalizeAgreementData(value?.data, value?.agreement_number),
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

function formatDate(value: string) {
  if (!value) return '-';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function readLocalRecords(workspaceId: string) {
  if (typeof window === 'undefined') return [] as AgreementRecord[];
  try {
    const raw = JSON.parse(localStorage.getItem(`${LOCAL_STORAGE_KEY}:${workspaceId}`) || '[]');
    return Array.isArray(raw) ? raw.map((item) => normalizeRecord(item, workspaceId)) : [];
  } catch {
    return [] as AgreementRecord[];
  }
}

function writeLocalRecords(workspaceId: string, records: AgreementRecord[]) {
  if (typeof window !== 'undefined') localStorage.setItem(`${LOCAL_STORAGE_KEY}:${workspaceId}`, JSON.stringify(records));
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
        if (!context) return reject(new Error('Browser tidak mendukung pemrosesan gambar.'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const outputType = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        resolve(outputType === 'image/png' ? canvas.toDataURL(outputType) : canvas.toDataURL(outputType, quality));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function InputLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#737680]">{children}</label>;
}

const inputClass = 'w-full rounded-lg border border-[#DDE1E7] bg-white px-3 py-2.5 text-xs text-[#202124] outline-none transition focus:border-[#24324A] focus:ring-2 focus:ring-[#24324A]/10';

export default function AgreementsPage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('bilik-strategi');
  const [records, setRecords] = useState<AgreementRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<AgreementData>(() => createDefaultAgreement(INITIAL_AGREEMENT_NUMBER));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'background' | 'signature' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const loadAgreements = useCallback(async () => {
    const localRecords = readLocalRecords(workspaceId);
    setLoading(true);
    try {
      const { data, error } = await supabase.from('app_agreements').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false });
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
      console.warn('[Agreements] Supabase load failed, using local recovery:', error?.message || error);
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
    loadAgreements();
    const channel = supabase.channel(`agreement-studio-${workspaceId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'app_agreements', filter: `workspace_id=eq.${workspaceId}` }, () => loadAgreements()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAgreements, mounted, workspaceId]);

  useEffect(() => {
    if (!mounted) return;
    const current = records.find((item) => item.id === selectedId);
    if (current) setDraft(current.data);
  }, [mounted, records, selectedId]);

  useEffect(() => {
    if (!mounted || selectedId || records.length > 0) return;
    setDraft((current) => current.agreementNumber === INITIAL_AGREEMENT_NUMBER ? { ...current, agreementNumber: generateAgreementNumber(current.issuerName, current.issueDate) } : current);
  }, [mounted, records.length, selectedId]);

  useEffect(() => {
    if (!mounted) return;
    const localRecord: AgreementRecord = { id: selectedId || 'local-draft', workspace_id: workspaceId, agreement_number: draft.agreementNumber, status: 'draft', data: draft, updated_at: new Date().toISOString() };
    const localRecords = readLocalRecords(workspaceId);
    writeLocalRecords(workspaceId, [...localRecords.filter((item) => item.id !== localRecord.id && item.agreement_number !== draft.agreementNumber), localRecord]);
  }, [draft, mounted, selectedId, workspaceId]);

  const updateField = <K extends keyof AgreementData>(field: K, value: AgreementData[K]) => setDraft((current) => ({ ...current, [field]: value }));

  const updateSection = (id: string, field: 'heading' | 'body', value: string) => setDraft((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, [field]: value } : section) }));
  const updateSectionItems = (id: string, value: string) => setDraft((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, items: value.split('\n').map((item) => item.trim()).filter(Boolean) } : section) }));
  const addSection = () => setDraft((current) => ({ ...current, sections: [...current.sections, { id: generateId(), heading: 'Bagian baru', body: '', items: [] }] }));
  const removeSection = (id: string) => setDraft((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== id) }));

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'backgroundImageUrl' | 'signatureImageUrl') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const isSignature = field === 'signatureImageUrl';
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (isSignature && !isPng) {
      setMessage({ type: 'error', text: 'Tanda tangan harus berupa file PNG.' });
      return;
    }
    if (!file.type.startsWith('image/') && !(isSignature && isPng)) return setMessage({ type: 'error', text: 'File harus berupa gambar.' });
    setUploading(field === 'logoUrl' ? 'logo' : isSignature ? 'signature' : 'background');
    try {
      updateField(field, await compressImage(file, field === 'logoUrl' ? 900 : isSignature ? 1200 : 1600, field === 'logoUrl' || isSignature ? 0.9 : 0.82));
      setMessage({ type: 'success', text: `${field === 'logoUrl' ? 'Logo' : isSignature ? 'Tanda tangan' : 'Background'} siap digunakan.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal memproses gambar.' });
    } finally {
      setUploading(null);
    }
  };

  const startNewAgreement = () => {
    setSelectedId('');
    setDraft(createDefaultAgreement());
    setMessage({ type: 'info', text: 'Draft collaboration agreement baru siap diedit.' });
  };

  const saveAgreement = async () => {
    const agreementNumber = draft.agreementNumber.trim() || generateAgreementNumber(draft.issuerName, draft.issueDate);
    const normalizedDraft = normalizeAgreementData({ ...draft, agreementNumber }, agreementNumber);
    setDraft(normalizedDraft);
    setSaving(true);
    setMessage(null);
    const payload = { workspace_id: workspaceId, agreement_number: agreementNumber, status: 'draft', data: normalizedDraft, created_by_email: getCurrentEmail() || null, updated_at: new Date().toISOString() };
    const selectedRecord = records.find((item) => item.id === selectedId);
    try {
      const result = selectedRecord && !selectedId.startsWith('local-') ? await supabase.from('app_agreements').update(payload).eq('id', selectedId).select('*').single() : await supabase.from('app_agreements').insert(payload).select('*').single();
      if (result.error) throw result.error;
      const savedRecord = normalizeRecord(result.data, workspaceId);
      setRecords((current) => [savedRecord, ...current.filter((item) => item.id !== savedRecord.id && item.agreement_number !== savedRecord.agreement_number)]);
      setSelectedId(savedRecord.id);
      setDraft(savedRecord.data);
      writeLocalRecords(workspaceId, [savedRecord, ...readLocalRecords(workspaceId).filter((item) => item.id !== savedRecord.id && item.agreement_number !== savedRecord.agreement_number)]);
      setMessage({ type: 'success', text: `Agreement ${savedRecord.agreement_number} tersimpan ke workspace.` });
    } catch (error: any) {
      const localRecord = normalizeRecord({ id: selectedRecord?.id?.startsWith('local-') ? selectedRecord.id : `local-${Date.now()}`, workspace_id: workspaceId, agreement_number: agreementNumber, status: 'draft', data: normalizedDraft, updated_at: new Date().toISOString() }, workspaceId);
      const nextRecords = [localRecord, ...records.filter((item) => item.id !== selectedRecord?.id && item.agreement_number !== agreementNumber)];
      setRecords(nextRecords);
      setSelectedId(localRecord.id);
      setDraft(localRecord.data);
      writeLocalRecords(workspaceId, nextRecords);
      setMessage({ type: 'info', text: `Tersimpan di perangkat. Jalankan migration collaboration agreement agar tersimpan lintas user. (${error?.message || 'Supabase belum siap'})` });
    } finally {
      setSaving(false);
    }
  };

  const deleteAgreement = async () => {
    const selectedRecord = records.find((item) => item.id === selectedId);
    if (!selectedRecord || !window.confirm(`Hapus agreement ${selectedRecord.agreement_number}?`)) return;
    try {
      if (!selectedId.startsWith('local-')) {
        const { error } = await supabase.from('app_agreements').delete().eq('id', selectedId);
        if (error) throw error;
      }
      const nextRecords = records.filter((item) => item.id !== selectedId);
      setRecords(nextRecords);
      writeLocalRecords(workspaceId, nextRecords);
      setSelectedId(nextRecords[0]?.id || '');
      setDraft(nextRecords[0]?.data || createDefaultAgreement());
      setMessage({ type: 'success', text: 'Agreement dihapus.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Agreement gagal dihapus.' });
    }
  };

  const exportPdf = async () => {
    const element = previewRef.current;
    if (!element) return;
    setExporting(true);
    setMessage(null);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: draft.backgroundColor || '#FFFFFF', logging: false, width: element.scrollWidth, height: element.scrollHeight, windowWidth: element.scrollWidth });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pxPerMm = canvas.width / pageWidth;
      const pagePixelHeight = Math.max(1, Math.floor(pageHeight * pxPerMm));
      let pageIndex = 0;
      for (let offset = 0; offset < canvas.height; offset += pagePixelHeight) {
        const sliceHeight = Math.min(pagePixelHeight, canvas.height - offset);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sliceHeight;
        const context = slice.getContext('2d');
        if (!context) throw new Error('Browser tidak mendukung export PDF.');
        context.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/png', 1), 'PNG', 0, 0, pageWidth, sliceHeight / pxPerMm, undefined, 'FAST');
        pageIndex += 1;
      }
      pdf.save(`${draft.agreementNumber || 'collaboration-agreement'}.pdf`);
      setMessage({ type: 'success', text: 'PDF collaboration agreement HD berhasil dibuat.' });
    } catch (error: any) {
      console.error('[Agreements] PDF export failed:', error);
      window.print();
      setMessage({ type: 'info', text: 'Export HD tidak tersedia di browser ini. Dialog cetak dibuka sebagai fallback PDF.' });
    } finally {
      setExporting(false);
    }
  };

  const replaceTokens = (value: string) => value
    .replaceAll('{{client_social}}', draft.clientSocialHandle || 'akun media sosial klien')
    .replaceAll('{{issuer_name}}', draft.issuerName || 'nama perusahaan')
    .replaceAll('{{client_name}}', draft.clientName || 'nama klien')
    .replaceAll('{{recipient_name}}', draft.recipientName || 'nama penerima');

  const previewStyle: React.CSSProperties = { backgroundColor: draft.backgroundColor, backgroundImage: draft.backgroundImageUrl ? `url(${draft.backgroundImageUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', color: draft.textColor, fontFamily: draft.fontFamily };

  const renderDataRow = (label: string, value: string) => <div className="grid grid-cols-[130px_14px_1fr] gap-1 text-[11px] leading-5"><span>{label}</span><span>:</span><span className="font-semibold">{value || '-'}</span></div>;

  return (
    <div className="agreement-page space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#F26B5E]"><FileSignature className="h-5 w-5" /><span className="text-[11px] font-bold uppercase tracking-[0.16em]">Agreement Studio</span></div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#24324A]">Collaboration Agreement</h1>
          <p className="mt-1 max-w-2xl text-xs text-[#737680]">Buat surat keterangan dan dokumen kerja sama yang dapat dikustomisasi, disimpan per workspace, dan diexport menjadi PDF tajam.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={startNewAgreement} className="inline-flex items-center gap-2 rounded-lg border border-[#DDE1E7] bg-white px-3.5 py-2.5 text-xs font-bold text-[#24324A] hover:border-[#24324A]"><Plus className="h-4 w-4" /> Agreement Baru</button>
          <button type="button" onClick={saveAgreement} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#24324A] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#1B263A] disabled:cursor-wait disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Menyimpan...' : 'Simpan Agreement'}</button>
          <button type="button" onClick={exportPdf} disabled={exporting} className="inline-flex items-center gap-2 rounded-lg bg-[#F26B5E] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#DD5C51] disabled:cursor-wait disabled:opacity-60">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{exporting ? 'Membuat PDF...' : 'Export PDF HD'}</button>
        </div>
      </div>

      {message && <div className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-3 text-xs ${message.type === 'error' ? 'border-[#F3B7B0] bg-[#FFF0ED] text-[#B5473D]' : message.type === 'success' ? 'border-[#A8D8C0] bg-[#EEF8F2] text-[#317A58]' : 'border-[#C8D5E5] bg-[#EEF2F7] text-[#40536F]'}`}><span>{message.text}</span><button type="button" onClick={() => setMessage(null)} title="Tutup pesan" className="shrink-0 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button></div>}

      <div className="flex items-center gap-2 overflow-x-auto border-b border-[#E8E8EC] pb-3">
        <button type="button" onClick={startNewAgreement} className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold transition ${!selectedId ? 'border-[#24324A] bg-[#24324A] text-white' : 'border-[#DDE1E7] bg-white text-[#737680]'}`}><Plus className="mr-1 inline h-3.5 w-3.5" /> Draft baru</button>
        {records.map((record) => <button type="button" key={record.id} onClick={() => { setSelectedId(record.id); setDraft(record.data); setMessage(null); }} className={`shrink-0 rounded-lg border px-3 py-2 text-left ${selectedId === record.id ? 'border-[#24324A] bg-[#EEF2F7]' : 'border-[#E8E8EC] bg-white'}`}><span className="block text-xs font-bold text-[#24324A]">{record.agreement_number}</span><span className="block text-[10px] text-[#737680]">{record.data.clientName || 'Tanpa klien'}</span></button>)}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#737680]" />}
        {!loading && records.length === 0 && <span className="text-xs text-[#737680]">Belum ada agreement tersimpan.</span>}
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(360px,520px)_minmax(640px,1fr)]">
        <section className="agreement-editor min-w-0 self-start rounded-xl border border-[#E8E8EC] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E8E8EC] px-5 py-4"><div><h2 className="text-sm font-extrabold text-[#24324A]">Editor Agreement</h2><p className="mt-0.5 text-[11px] text-[#737680]">Semua perubahan tampil langsung pada preview.</p></div>{selectedId && <button type="button" onClick={deleteAgreement} title="Hapus agreement" className="rounded-lg p-2 text-[#D95858] hover:bg-[#FFF0ED]"><Trash2 className="h-4 w-4" /></button>}</div>
          <div className="space-y-6 p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><FileSignature className="h-4 w-4 text-[#F26B5E]" /> Identitas Dokumen</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><InputLabel htmlFor="agreement-number">Nomor Dokumen</InputLabel><div className="flex gap-2"><input id="agreement-number" className={inputClass} value={draft.agreementNumber} onChange={(event) => updateField('agreementNumber', event.target.value)} /><button type="button" onClick={() => updateField('agreementNumber', generateAgreementNumber(draft.issuerName, draft.issueDate))} title="Buat nomor dokumen baru" className="shrink-0 rounded-lg border border-[#DDE1E7] px-2.5 text-[#24324A]"><RefreshCw className="h-4 w-4" /></button></div></div>
                <div><InputLabel htmlFor="agreement-document-title">Judul Atas</InputLabel><input id="agreement-document-title" className={inputClass} value={draft.documentTitle} onChange={(event) => updateField('documentTitle', event.target.value)} /></div>
                <div><InputLabel htmlFor="agreement-title">Judul Agreement</InputLabel><input id="agreement-title" className={inputClass} value={draft.agreementTitle} onChange={(event) => updateField('agreementTitle', event.target.value)} /></div>
                <div><InputLabel htmlFor="agreement-city">Kota Dokumen</InputLabel><input id="agreement-city" className={inputClass} value={draft.issueCity} onChange={(event) => updateField('issueCity', event.target.value)} /></div>
                <div><InputLabel htmlFor="agreement-date">Tanggal Dokumen</InputLabel><input id="agreement-date" type="date" className={inputClass} value={draft.issueDate} onChange={(event) => updateField('issueDate', event.target.value)} /></div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><Palette className="h-4 w-4 text-[#F26B5E]" /> Tampilan</div>
              <div className="grid gap-3 sm:grid-cols-2"><div><InputLabel htmlFor="agreement-font">Font</InputLabel><div className="relative"><select id="agreement-font" className={`${inputClass} appearance-none pr-8`} value={draft.fontFamily} onChange={(event) => updateField('fontFamily', event.target.value)}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[#737680]" /></div></div><div className="grid grid-cols-3 gap-2"><div><InputLabel htmlFor="agreement-bg">Background</InputLabel><input id="agreement-bg" type="color" className="h-[42px] w-full cursor-pointer rounded-lg border border-[#DDE1E7] bg-white p-1" value={draft.backgroundColor} onChange={(event) => updateField('backgroundColor', event.target.value)} /></div><div><InputLabel htmlFor="agreement-accent">Aksen</InputLabel><input id="agreement-accent" type="color" className="h-[42px] w-full cursor-pointer rounded-lg border border-[#DDE1E7] bg-white p-1" value={draft.accentColor} onChange={(event) => updateField('accentColor', event.target.value)} /></div><div><InputLabel htmlFor="agreement-text">Teks</InputLabel><input id="agreement-text" type="color" className="h-[42px] w-full cursor-pointer rounded-lg border border-[#DDE1E7] bg-white p-1" value={draft.textColor} onChange={(event) => updateField('textColor', event.target.value)} /></div></div></div>
              <div className="grid gap-2 sm:grid-cols-2"><label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-[#CBD3DE] px-3 py-2.5 text-xs text-[#40536F]"><span className="flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Background image</span>{uploading === 'background' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}<input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event, 'backgroundImageUrl')} /></label>{draft.backgroundImageUrl && <button type="button" onClick={() => updateField('backgroundImageUrl', '')} className="rounded-lg border border-[#F3B7B0] px-3 py-2 text-xs font-bold text-[#B5473D]">Hapus background image</button>}</div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><ImagePlus className="h-4 w-4 text-[#F26B5E]" /> Branding & Pihak</div>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-[#CBD3DE] p-3">{draft.logoUrl ? <img src={draft.logoUrl} alt="Logo agreement" className="h-12 w-20 rounded object-contain" /> : <div className="flex h-12 w-20 items-center justify-center rounded bg-[#F7F7F8] text-[#737680]"><ImagePlus className="h-5 w-5" /></div>}<div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#24324A]">Logo dokumen</p><p className="mt-0.5 text-[10px] text-[#737680]">PNG transparan tetap dipertahankan.</p></div><label className="cursor-pointer rounded-lg bg-[#EEF2F7] px-3 py-2 text-[11px] font-bold text-[#24324A]">{uploading === 'logo' ? 'Memproses...' : 'Upload'}<input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageUpload(event, 'logoUrl')} /></label>{draft.logoUrl && <button type="button" onClick={() => updateField('logoUrl', '')} title="Hapus logo" className="rounded-lg p-2 text-[#D95858]"><X className="h-4 w-4" /></button>}</div>
              <div className="grid gap-3 sm:grid-cols-2"><div><InputLabel htmlFor="agreement-issuer-name">Nama Bisnis / Agency</InputLabel><input id="agreement-issuer-name" className={inputClass} value={draft.issuerName} onChange={(event) => updateField('issuerName', event.target.value)} /></div><div><InputLabel htmlFor="agreement-client-name">Nama Klien</InputLabel><input id="agreement-client-name" className={inputClass} value={draft.clientName} onChange={(event) => updateField('clientName', event.target.value)} /></div><div><InputLabel htmlFor="agreement-issuer-address">Alamat Bisnis</InputLabel><textarea id="agreement-issuer-address" className={`${inputClass} min-h-20 resize-y`} value={draft.issuerAddress} onChange={(event) => updateField('issuerAddress', event.target.value)} /></div><div><InputLabel htmlFor="agreement-client-address">Alamat Klien</InputLabel><textarea id="agreement-client-address" className={`${inputClass} min-h-20 resize-y`} value={draft.clientAddress} onChange={(event) => updateField('clientAddress', event.target.value)} /></div><div><InputLabel htmlFor="agreement-issuer-email">Email Bisnis</InputLabel><input id="agreement-issuer-email" type="email" className={inputClass} value={draft.issuerEmail} onChange={(event) => updateField('issuerEmail', event.target.value)} /></div><div><InputLabel htmlFor="agreement-client-business">Tipe Usaha Klien</InputLabel><input id="agreement-client-business" className={inputClass} value={draft.clientBusinessType} onChange={(event) => updateField('clientBusinessType', event.target.value)} /></div><div><InputLabel htmlFor="agreement-client-social">Akun / Brand Klien</InputLabel><input id="agreement-client-social" className={inputClass} value={draft.clientSocialHandle} onChange={(event) => updateField('clientSocialHandle', event.target.value)} /></div><div><InputLabel htmlFor="agreement-issuer-phone">Telepon Bisnis</InputLabel><input id="agreement-issuer-phone" className={inputClass} value={draft.issuerPhone} onChange={(event) => updateField('issuerPhone', event.target.value)} /></div><div><InputLabel htmlFor="agreement-client-email">Email Klien</InputLabel><input id="agreement-client-email" type="email" className={inputClass} value={draft.clientEmail} onChange={(event) => updateField('clientEmail', event.target.value)} /></div><div><InputLabel htmlFor="agreement-client-phone">Telepon Klien</InputLabel><input id="agreement-client-phone" className={inputClass} value={draft.clientPhone} onChange={(event) => updateField('clientPhone', event.target.value)} /></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><InputLabel htmlFor="agreement-client-label">Label Data Klien</InputLabel><input id="agreement-client-label" className={inputClass} value={draft.clientBlockTitle} onChange={(event) => updateField('clientBlockTitle', event.target.value)} /></div><div><InputLabel htmlFor="agreement-recipient-label">Label Pihak Penerima</InputLabel><input id="agreement-recipient-label" className={inputClass} value={draft.recipientBlockTitle} onChange={(event) => updateField('recipientBlockTitle', event.target.value)} /></div><div><InputLabel htmlFor="agreement-recipient-name">Nama Penerima</InputLabel><input id="agreement-recipient-name" className={inputClass} value={draft.recipientName} onChange={(event) => updateField('recipientName', event.target.value)} /></div><div><InputLabel htmlFor="agreement-recipient-role">Jabatan / Peran</InputLabel><input id="agreement-recipient-role" className={inputClass} value={draft.recipientRole} onChange={(event) => updateField('recipientRole', event.target.value)} /></div><div className="sm:col-span-2"><InputLabel htmlFor="agreement-recipient-company">Perusahaan / Tim Penerima</InputLabel><input id="agreement-recipient-company" className={inputClass} value={draft.recipientCompany} onChange={(event) => updateField('recipientCompany', event.target.value)} /></div></div>
            </div>

            <div className="space-y-3"><div className="flex items-start justify-between gap-3 border-b border-[#E8E8EC] pb-2"><div><div className="flex items-center gap-2 text-xs font-extrabold text-[#24324A]"><FileSignature className="h-4 w-4 text-[#F26B5E]" /> Isi dan Ruang Lingkup</div><p className="mt-1 text-[10px] text-[#737680]">Gunakan satu baris untuk setiap poin daftar.</p></div><button type="button" onClick={addSection} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#F26B5E]"><Plus className="h-3.5 w-3.5" /> Tambah bagian</button></div><div><InputLabel htmlFor="agreement-opening">Pembuka</InputLabel><textarea id="agreement-opening" className={`${inputClass} min-h-20 resize-y`} value={draft.openingText} onChange={(event) => updateField('openingText', event.target.value)} /></div>{draft.sections.map((section, index) => <div key={section.id} className="space-y-2 rounded-lg bg-[#F7F7F8] p-3"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wide text-[#737680]">Bagian {index + 1}</span><button type="button" onClick={() => removeSection(section.id)} title="Hapus bagian" className="rounded-lg p-1.5 text-[#D95858]"><Trash2 className="h-3.5 w-3.5" /></button></div><input className={inputClass} value={section.heading} onChange={(event) => updateSection(section.id, 'heading', event.target.value)} placeholder="Judul bagian" aria-label={`Judul bagian ${index + 1}`} /><textarea className={`${inputClass} min-h-20 resize-y`} value={section.body} onChange={(event) => updateSection(section.id, 'body', event.target.value)} placeholder="Paragraf bagian" aria-label={`Paragraf bagian ${index + 1}`} /><textarea className={`${inputClass} min-h-24 resize-y`} value={section.items.join('\n')} onChange={(event) => updateSectionItems(section.id, event.target.value)} placeholder="Poin 1\nPoin 2\nPoin 3" aria-label={`Daftar poin bagian ${index + 1}`} /></div>)}</div>

            <div className="space-y-3"><div className="flex items-center gap-2 border-b border-[#E8E8EC] pb-2 text-xs font-extrabold text-[#24324A]"><CalendarDays className="h-4 w-4 text-[#F26B5E]" /> Penutup & Tanda Tangan</div><div><InputLabel htmlFor="agreement-closing">Klausul Penutup</InputLabel><textarea id="agreement-closing" className={`${inputClass} min-h-24 resize-y`} value={draft.closingText} onChange={(event) => updateField('closingText', event.target.value)} /></div><div className="grid gap-3 sm:grid-cols-2"><div><InputLabel htmlFor="agreement-signature-name">Nama Penandatangan</InputLabel><input id="agreement-signature-name" className={inputClass} value={draft.signatureName} onChange={(event) => updateField('signatureName', event.target.value)} /></div><div><InputLabel htmlFor="agreement-signature-role">Jabatan Penandatangan</InputLabel><input id="agreement-signature-role" className={inputClass} value={draft.signatureRole} onChange={(event) => updateField('signatureRole', event.target.value)} /></div><div className="sm:col-span-2"><InputLabel htmlFor="agreement-signature-company">Perusahaan / Tim Penandatangan</InputLabel><input id="agreement-signature-company" className={inputClass} value={draft.signatureCompany} onChange={(event) => updateField('signatureCompany', event.target.value)} /></div></div><div className="rounded-lg border border-dashed border-[#CBD3DE] p-3"><div className="flex items-center justify-between gap-3"><div><InputLabel>Tanda Tangan PNG</InputLabel><p className="text-[10px] text-[#737680]">Opsional. Jika kosong, nama akan langsung berada di bawah tanggal.</p></div><label className="cursor-pointer rounded-lg bg-[#EEF2F7] px-3 py-2 text-[11px] font-bold text-[#24324A]">{uploading === 'signature' ? 'Memproses...' : 'Upload PNG'}<input type="file" accept="image/png,.png" className="hidden" onChange={(event) => handleImageUpload(event, 'signatureImageUrl')} /></label></div>{draft.signatureImageUrl && <div className="mt-3 flex items-center gap-3"><img src={draft.signatureImageUrl} alt="Tanda tangan penandatangan" className="h-16 max-w-48 object-contain object-left" /><button type="button" onClick={() => updateField('signatureImageUrl', '')} title="Hapus tanda tangan" className="rounded-lg p-2 text-[#D95858] hover:bg-[#FFF0ED]"><X className="h-4 w-4" /></button></div>}</div><div><InputLabel htmlFor="agreement-footer">Footer</InputLabel><input id="agreement-footer" className={inputClass} value={draft.footerText} onChange={(event) => updateField('footerText', event.target.value)} /></div></div>
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-[#E8E8EC] bg-[#EEF2F7] p-3 shadow-sm"><div className="mb-3 flex items-center justify-between px-1"><div><h2 className="text-sm font-extrabold text-[#24324A]">Preview A4</h2><p className="text-[11px] text-[#737680]">Template mengikuti struktur collaboration agreement.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#4F9D78]"><Check className="mr-1 inline h-3 w-3" /> Live preview</span></div><div className="overflow-x-auto rounded-lg border border-[#D7DEE8] bg-[#DDE4ED] p-3"><div ref={previewRef} className="agreement-print-target mx-auto min-h-[1123px] w-[794px] overflow-visible shadow-xl" style={previewStyle}><div className="flex min-h-[1123px] flex-col p-[64px]" style={{ color: draft.textColor }}><div className="mb-8 text-center">{draft.logoUrl && <img src={draft.logoUrl} alt="Logo agreement" className="mx-auto mb-4 h-14 max-w-32 object-contain" />}<h1 className="text-2xl font-black tracking-wide">{draft.documentTitle}</h1><h2 className="mt-1 text-xl font-black tracking-wide">{draft.agreementTitle}</h2><p className="mt-2 font-mono text-[11px] font-bold">No. {draft.agreementNumber}</p></div><div className="space-y-5 text-[12px] leading-6"><div><p className="font-semibold">{draft.clientBlockTitle}</p>{renderDataRow('Nama Klien', draft.clientName)}{renderDataRow('Tipe Usaha', draft.clientBusinessType)}{draft.clientAddress && renderDataRow('Alamat', draft.clientAddress)}{draft.clientEmail && renderDataRow('Email', draft.clientEmail)}{draft.clientPhone && renderDataRow('Telepon', draft.clientPhone)}</div><div><p className="font-semibold">{draft.recipientBlockTitle}</p>{renderDataRow('Nama', draft.recipientName)}{renderDataRow('Jabatan', draft.recipientRole)}{renderDataRow('Perusahaan', draft.recipientCompany)}</div><p className="whitespace-pre-line">{replaceTokens(draft.openingText)}</p>{draft.sections.map((section) => <div key={section.id} className="space-y-2">{section.heading && <p className="whitespace-pre-line">{replaceTokens(section.heading)}</p>}{section.body && <p className="whitespace-pre-line">{replaceTokens(section.body)}</p>}{section.items.length > 0 && <ol className="ml-7 list-decimal space-y-0.5">{section.items.map((item, itemIndex) => <li key={`${section.id}-${itemIndex}`} className="pl-1">{replaceTokens(item)}</li>)}</ol>}</div>)}{draft.closingText && <p className="whitespace-pre-line">{replaceTokens(draft.closingText)}</p>}</div><div className="mt-8 text-[12px] leading-5"><p>{draft.issueCity}, {formatDate(draft.issueDate)}</p><div className={draft.signatureImageUrl ? 'mt-6' : 'mt-1'}>{draft.signatureImageUrl && <img src={draft.signatureImageUrl} alt="Tanda tangan penandatangan" className="mb-2 h-16 max-w-48 object-contain object-left" />}<p className="font-bold">{draft.signatureName}</p><p className="italic">{draft.signatureRole}</p><p className="italic">{draft.signatureCompany}</p></div></div><p className="mt-auto pt-8 text-center text-[9px] opacity-50">{draft.footerText}</p></div></div></div></section>
      </div>

      <style jsx global>{`@media print { body * { visibility: hidden !important; } .agreement-print-target, .agreement-print-target * { visibility: visible !important; } .agreement-print-target { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; } }`}</style>
    </div>
  );
}
