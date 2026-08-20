'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpenCheck,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  FileSignature,
  Film,
  Info,
  ListChecks,
  Pencil,
  Plus,
  Puzzle,
  ReceiptText,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import FeeSettingsModal, { type FeeSettingsSection } from '@/components/fee-calculator/FeeSettingsModal';
import ModalPortal from '@/components/ui/ModalPortal';
import {
  FEE_CALCULATOR_STORAGE_KEY,
  FEE_CUSTOM_QUOTE_STORAGE_KEY,
  FEE_QUOTE_HANDOFF_STORAGE_KEY,
  calculateCustomQuote,
  calculateFee,
  createDefaultCustomQuote,
  createDefaultFeeSettings,
  createItemId,
  normalizeCustomQuote,
  normalizeFeeSettings,
  type CustomQuoteDraft,
  type FeeCalculation,
  type FeeCalculatorSettings,
  type QuoteHandoff,
  type UnitPriceCategory,
  type UnitPriceItem,
} from '@/lib/fee-calculator';

type PageTab = 'dashboard' | 'custom' | 'catalog';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

const inputClass = 'h-11 w-full min-w-0 rounded-xl border border-[#DDE2EA] bg-white px-3 text-sm font-semibold text-[#24324A] outline-none transition focus:border-[#7F91B0] focus:ring-2 focus:ring-[#DCE7F6] dark:border-[#3A424E] dark:bg-[#20242C] dark:text-[#F4F6FA] dark:focus:border-[#66758A] dark:focus:ring-[#334052]';

const tabs: Array<{ id: PageTab; label: string; compactLabel: string; icon: typeof Calculator }> = [
  { id: 'dashboard', label: 'Ringkasan Harga', compactLabel: 'Ringkasan', icon: Calculator },
  { id: 'custom', label: 'Penawaran Custom', compactLabel: 'Custom', icon: FileSignature },
  { id: 'catalog', label: 'Harga Satuan', compactLabel: 'Satuan', icon: BookOpenCheck },
];

const packageStyles = [
  { border: 'border-[#BFD3F5] dark:border-[#3B5476]', surface: 'bg-[#EAF2FF] dark:bg-[#29364A]', accent: 'text-[#315F98] dark:text-[#AFC9EE]' },
  { border: 'border-[#F4C1BA] dark:border-[#72443E]', surface: 'bg-[#FFF0ED] dark:bg-[#3B272B]', accent: 'text-[#B64D43] dark:text-[#FFAAA0]' },
  { border: 'border-[#D7C9F1] dark:border-[#574C78]', surface: 'bg-[#F2E9FA] dark:bg-[#32294C]', accent: 'text-[#765096] dark:text-[#D1B8F1]' },
];

const categoryLabels: Record<UnitPriceCategory, string> = {
  produksi: 'Produksi',
  'add-on': 'Add-on',
  operasional: 'Operasional',
  lainnya: 'Lainnya',
};

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number) {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

function toNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function SettingsButton({ section, onClick }: { section: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-3 text-[11px] font-extrabold text-[#40536F] transition hover:border-[#24324A] hover:text-[#24324A] dark:border-[#3A424E] dark:bg-[#20242C] dark:text-[#C0C9D6] dark:hover:border-[#718096] dark:hover:text-white"
      aria-label={`Atur ${section}`}
    >
      <Settings2 className="h-3.5 w-3.5" /> Atur
    </button>
  );
}

function SummaryCard({
  title,
  description,
  value,
  detail,
  icon: Icon,
  iconClass,
  section,
  onOpen,
}: {
  title: string;
  description: string;
  value: string;
  detail: string;
  icon: typeof Calculator;
  iconClass: string;
  section: FeeSettingsSection;
  onOpen: (section: FeeSettingsSection) => void;
}) {
  return (
    <article className="rounded-2xl border border-[#E1E5EB] bg-white p-4 shadow-sm dark:border-[#303742] dark:bg-[#20242C] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconClass}`}><Icon className="h-5 w-5" /></div>
        <SettingsButton section={title} onClick={() => onOpen(section)} />
      </div>
      <h3 className="mt-4 text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">{title}</h3>
      <p className="mt-1 min-h-8 text-[11px] leading-4 text-[#737680] dark:text-[#98A2B3]">{description}</p>
      <div className="mt-4 border-t border-[#ECEEF2] pt-3 dark:border-[#303742]">
        <p className="text-lg font-black text-[#24324A] dark:text-[#F4F6FA]">{value}</p>
        <p className="mt-0.5 text-[10px] text-[#737680] dark:text-[#98A2B3]">{detail}</p>
      </div>
    </article>
  );
}

function DashboardTab({ calculation, settings, onOpen }: { calculation: FeeCalculation; settings: FeeCalculatorSettings; onOpen: (section: FeeSettingsSection) => void }) {
  const selectedAddOns = settings.addOnItems.filter((item) => item.quantity > 0).length;
  const operationalCount = settings.operationalItems.filter((item) => item.amount > 0).length;

  return (
    <div className="space-y-5">
      <section data-fee-result-panel className="rounded-3xl bg-[#24324A] p-4 text-white shadow-sm dark:bg-[#111822] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#FFAAA0]"><Sparkles className="h-4 w-4" /><span className="text-[10px] font-extrabold uppercase tracking-[0.16em]">Hasil Otomatis</span></div>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">Tiga harga paket siap dibandingkan</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/65">Semua angka mengikuti rate, produksi, add-on, dan operasional yang diatur melalui tombol pengaturan.</p>
          </div>
          <SettingsButton section="tiga paket" onClick={() => onOpen('packages')} />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {calculation.packages.map((item, index) => {
            const style = packageStyles[index] || packageStyles[0];
            return (
              <div
                key={item.id}
                data-fee-package-tone={index === 0 ? 'primary' : index === 1 ? 'error' : 'secondary'}
                className={`rounded-2xl border p-4 ${style.border} ${style.surface}`}
              >
                <div className="flex items-center justify-between gap-2"><p data-fee-package-accent className={`text-sm font-black ${style.accent}`}>{item.name}</p><span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-extrabold text-[#536176] dark:bg-black/15 dark:text-[#C0C9D6]">+{formatNumber(item.markupPercent)}%</span></div>
                <p data-fee-package-accent className={`mt-4 text-xl font-black ${style.accent}`}>{formatCurrency(item.allInPrice)}</p>
                <p className="mt-1 text-[10px] text-[#536176] dark:text-[#B9C5D5]">Termasuk operasional {formatCurrency(calculation.operationalTotal)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Rate & Retainer" description="Kebutuhan bulanan, jam kerja, dan target margin." value={`${formatCurrency(calculation.recommendedHourlyRate)}/jam`} detail={`Retainer ${formatCurrency(calculation.retainerTotal)} · ${formatNumber(calculation.monthlyWorkHours)} jam`} icon={CircleDollarSign} iconClass="bg-[#EAF2FF] text-[#315F98] dark:bg-[#29364A] dark:text-[#AFC9EE]" section="rate" onOpen={onOpen} />
        <SummaryCard title="Produksi Konten" description="Jam per konten dikalikan kuantitas dan rate rekomendasi." value={formatCurrency(calculation.productionTotal)} detail={`${formatNumber(calculation.contentCount)} konten · ${formatNumber(calculation.productionHours)} jam`} icon={Film} iconClass="bg-[#FFF0ED] text-[#B64D43] dark:bg-[#3B272B] dark:text-[#FFAAA0]" section="production" onOpen={onOpen} />
        <SummaryCard title="Add-On" description="Deliverable tambahan di luar produksi utama." value={formatCurrency(calculation.addOnTotal)} detail={`${selectedAddOns} dari ${settings.addOnItems.length} komponen digunakan`} icon={Puzzle} iconClass="bg-[#F2E9FA] text-[#765096] dark:bg-[#32294C] dark:text-[#D1B8F1]" section="addons" onOpen={onOpen} />
        <SummaryCard title="Operasional" description="Biaya pendukung yang dipisahkan dari fee jasa." value={formatCurrency(calculation.operationalTotal)} detail={`${operationalCount} komponen bernilai aktif`} icon={Wrench} iconClass="bg-[#FFF2DF] text-[#9B6514] dark:bg-[#3D321F] dark:text-[#F2C879]" section="operational" onOpen={onOpen} />
      </div>

      <section className="grid gap-4 rounded-2xl border border-[#DCE5F2] bg-[#F4F8FD] p-4 dark:border-[#3B4A5D] dark:bg-[#2A3443] md:grid-cols-4">
        <div><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#AAB4C5]">Kebutuhan bulanan</p><p className="mt-1 text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">{formatCurrency(calculation.livingCostTotal)}</p></div>
        <div><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#AAB4C5]">Fee jasa dasar</p><p className="mt-1 text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">{formatCurrency(calculation.baseServiceFee)}</p></div>
        <div><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#AAB4C5]">Total all-in dasar</p><p className="mt-1 text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">{formatCurrency(calculation.baseAllInPrice)}</p></div>
        <div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[#39785D] dark:text-[#8DD0A9]" /><p className="text-[10px] leading-4 text-[#536176] dark:text-[#B9C5D5]">Formula 4 minggu per bulan tetap sama dengan worksheet awal.</p></div>
      </section>
    </div>
  );
}

function CustomQuoteTab({
  quote,
  setQuote,
  settings,
  onContinue,
}: {
  quote: CustomQuoteDraft;
  setQuote: React.Dispatch<React.SetStateAction<CustomQuoteDraft>>;
  settings: FeeCalculatorSettings;
  onContinue: () => void;
}) {
  const [selectedUnitId, setSelectedUnitId] = useState(settings.unitPrices[0]?.id || '');
  const calculation = useMemo(() => calculateCustomQuote(quote), [quote]);
  const effectiveSelectedUnitId = settings.unitPrices.some((item) => item.id === selectedUnitId)
    ? selectedUnitId
    : settings.unitPrices[0]?.id || '';

  const addFromCatalog = () => {
    const unit = settings.unitPrices.find((item) => item.id === effectiveSelectedUnitId);
    if (!unit) return;
    setQuote((current) => ({
      ...current,
      items: [...current.items, { id: createItemId('quote'), unitPriceId: unit.id, description: unit.label, quantity: 1, unitPrice: unit.price }],
    }));
  };

  const addManual = () => {
    setQuote((current) => ({ ...current, items: [...current.items, { id: createItemId('quote'), description: 'Item custom baru', quantity: 1, unitPrice: 0 }] }));
  };

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 rounded-3xl border border-[#E1E5EB] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
        <div className="flex flex-col gap-3 border-b border-[#ECEEF2] p-4 dark:border-[#303742] sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div><div className="flex items-center gap-2 text-[#F26B5E]"><ReceiptText className="h-4 w-4" /><span className="text-[10px] font-extrabold uppercase tracking-[0.15em]">Custom Calculator</span></div><h2 className="mt-1 text-lg font-black text-[#24324A] dark:text-[#F4F6FA]">Susun kebutuhan customer</h2><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Pilih dari harga patokan atau tambahkan item manual.</p></div>
          <button type="button" onClick={addManual} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DDE2EA] px-3 text-xs font-extrabold text-[#40536F] hover:border-[#24324A] dark:border-[#3A424E] dark:text-[#C0C9D6] dark:hover:border-[#718096]"><Plus className="h-4 w-4" /> Item manual</button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid gap-2 rounded-2xl bg-[#F7F8FA] p-3 dark:bg-[#282D36] sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="min-w-0"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">Ambil dari harga satuan</span><select aria-label="Pilih harga satuan" value={effectiveSelectedUnitId} onChange={(event) => setSelectedUnitId(event.target.value)} className={inputClass}><option value="">Pilih item...</option>{settings.unitPrices.map((item) => <option key={item.id} value={item.id}>{item.label} · {formatCurrency(item.price)}/{item.unit}</option>)}</select></label>
            <button type="button" onClick={addFromCatalog} disabled={!effectiveSelectedUnitId} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#F4F6FA] dark:text-[#171A20]"><Plus className="h-4 w-4" /> Tambahkan</button>
          </div>

          <div className="mt-4 space-y-3">
            {quote.items.map((item, index) => (
              <div key={item.id} className="rounded-2xl border border-[#E7EAF0] bg-[#FAFAFB] p-3 dark:border-[#303742] dark:bg-[#282D36]">
                <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8A8E98] dark:text-[#98A2B3]">Item {index + 1}</span><button type="button" onClick={() => setQuote((current) => ({ ...current, items: current.items.filter((candidate) => candidate.id !== item.id) }))} aria-label={`Hapus ${item.description}`} className="rounded-lg p-1.5 text-[#D95858] hover:bg-[#FFF0ED] dark:text-[#FF9393] dark:hover:bg-[#3B272B]"><Trash2 className="h-4 w-4" /></button></div>
                <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_100px_170px]">
                  <label><span className="mb-1.5 block text-[10px] font-bold text-[#737680] dark:text-[#98A2B3]">Deskripsi</span><input aria-label={`Deskripsi item ${index + 1}`} value={item.description} onChange={(event) => setQuote((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === item.id ? { ...candidate, description: event.target.value } : candidate) }))} className={inputClass} /></label>
                  <label><span className="mb-1.5 block text-[10px] font-bold text-[#737680] dark:text-[#98A2B3]">Qty</span><input aria-label={`Kuantitas item ${index + 1}`} type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => setQuote((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === item.id ? { ...candidate, quantity: toNumber(event.target.value) } : candidate) }))} className={`${inputClass} text-right`} /></label>
                  <label><span className="mb-1.5 block text-[10px] font-bold text-[#737680] dark:text-[#98A2B3]">Harga satuan</span><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-[#8A8E98]">Rp</span><input aria-label={`Harga item ${index + 1}`} type="number" min="0" step="50000" value={item.unitPrice} onChange={(event) => setQuote((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === item.id ? { ...candidate, unitPrice: toNumber(event.target.value) } : candidate) }))} className={`${inputClass} pl-9 text-right`} /></div></label>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#E7EAF0] pt-2 text-[10px] dark:border-[#3A424E]"><span className="text-[#737680] dark:text-[#98A2B3]">Subtotal item</span><span className="font-black text-[#24324A] dark:text-[#F4F6FA]">{formatCurrency(item.quantity * item.unitPrice)}</span></div>
              </div>
            ))}
            {quote.items.length === 0 && <div className="rounded-2xl border border-dashed border-[#CBD3DE] px-4 py-10 text-center dark:border-[#4A5361]"><ListChecks className="mx-auto h-7 w-7 text-[#AAB5C5]" /><p className="mt-3 text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">Belum ada item penawaran</p><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Pilih harga satuan di atas atau tambahkan item manual.</p></div>}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">Diskon</span><div className="relative"><input aria-label="Diskon penawaran" type="number" min="0" value={quote.discountPercent} onChange={(event) => setQuote((current) => ({ ...current, discountPercent: toNumber(event.target.value) }))} className={`${inputClass} pr-10 text-right`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#8A8E98]">%</span></div></label>
            <label><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">Pajak</span><div className="relative"><input aria-label="Pajak penawaran" type="number" min="0" value={quote.taxPercent} onChange={(event) => setQuote((current) => ({ ...current, taxPercent: toNumber(event.target.value) }))} className={`${inputClass} pr-10 text-right`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#8A8E98]">%</span></div></label>
            <label className="sm:col-span-2"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">Keterangan penawaran</span><textarea aria-label="Keterangan penawaran custom" rows={3} value={quote.notes} onChange={(event) => setQuote((current) => ({ ...current, notes: event.target.value }))} className={`${inputClass} h-auto resize-y py-3 leading-5`} /></label>
          </div>
        </div>
      </section>

      <aside className="self-start rounded-3xl bg-[#24324A] p-5 text-white shadow-sm dark:bg-[#111822] xl:sticky xl:top-4">
        <div className="flex items-center gap-2 text-[#FFAAA0]"><Calculator className="h-4 w-4" /><span className="text-[10px] font-extrabold uppercase tracking-[0.15em]">Ringkasan Penawaran</span></div>
        <div className="mt-5 space-y-3 text-xs">
          <div className="flex justify-between gap-4 text-white/65"><span>Subtotal</span><strong className="text-white">{formatCurrency(calculation.subtotal)}</strong></div>
          <div className="flex justify-between gap-4 text-white/65"><span>Diskon ({formatNumber(quote.discountPercent)}%)</span><strong className="text-white">− {formatCurrency(calculation.discount)}</strong></div>
          <div className="flex justify-between gap-4 text-white/65"><span>Pajak ({formatNumber(quote.taxPercent)}%)</span><strong className="text-white">{formatCurrency(calculation.tax)}</strong></div>
        </div>
        <div className="mt-5 border-t border-white/15 pt-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/50">Total penawaran</p><p className="mt-2 text-2xl font-black text-[#82D5A8]">{formatCurrency(calculation.total)}</p></div>
        <button type="button" onClick={onContinue} disabled={quote.items.length === 0} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#F26B5E] px-4 text-xs font-extrabold text-white transition hover:bg-[#DD5C51] disabled:cursor-not-allowed disabled:opacity-45">Lanjut ke Penawaran Harga <ArrowRight className="h-4 w-4" /></button>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/8 p-3 text-[10px] leading-4 text-white/65"><Info className="mt-0.5 h-3.5 w-3.5 flex-none" /><p>Item, diskon, pajak, dan total akan otomatis masuk ke template PDF. Di halaman berikutnya tinggal lengkapi penerima dan detail dokumen.</p></div>
      </aside>
    </div>
  );
}

function CatalogTab({ settings, setSettings, onEdit }: { settings: FeeCalculatorSettings; setSettings: React.Dispatch<React.SetStateAction<FeeCalculatorSettings>>; onEdit: (item?: UnitPriceItem) => void }) {
  const grouped = useMemo(() => Object.entries(categoryLabels).map(([category, label]) => ({ category: category as UnitPriceCategory, label, items: settings.unitPrices.filter((item) => item.category === category) })).filter((group) => group.items.length > 0), [settings.unitPrices]);

  const remove = (item: UnitPriceItem) => {
    if (!window.confirm(`Hapus harga satuan “${item.label}”?`)) return;
    setSettings((current) => ({ ...current, unitPrices: current.unitPrices.filter((candidate) => candidate.id !== item.id) }));
  };

  return (
    <section className="rounded-3xl border border-[#E1E5EB] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
      <div className="flex flex-col gap-3 border-b border-[#ECEEF2] p-4 dark:border-[#303742] sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div><div className="flex items-center gap-2 text-[#F26B5E]"><BookOpenCheck className="h-4 w-4" /><span className="text-[10px] font-extrabold uppercase tracking-[0.15em]">Price Book</span></div><h2 className="mt-1 text-lg font-black text-[#24324A] dark:text-[#F4F6FA]">Patokan harga satuan</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#737680] dark:text-[#98A2B3]">Katalog ini menjadi sumber harga cepat saat menyusun penawaran custom.</p></div>
        <button type="button" onClick={() => onEdit()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#24324A] px-4 text-xs font-extrabold text-white dark:bg-[#F4F6FA] dark:text-[#171A20]"><Plus className="h-4 w-4" /> Tambah harga satuan</button>
      </div>
      <div className="space-y-6 p-4 sm:p-5">
        {grouped.map((group) => (
          <div key={group.category}>
            <div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-[#EEF2F7] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#40536F] dark:bg-[#2A3443] dark:text-[#B9C5D5]">{group.label}</span><span className="text-[10px] text-[#8A8E98] dark:text-[#98A2B3]">{group.items.length} item</span></div>
            <div className="divide-y divide-[#E7EAF0] overflow-hidden rounded-2xl border border-[#E7EAF0] dark:divide-[#303742] dark:border-[#303742]">
              {group.items.map((item) => (
                <div key={item.id} className="grid gap-3 bg-[#FAFAFB] p-3 dark:bg-[#282D36] sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-center sm:p-4">
                  <div className="min-w-0"><p className="truncate text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">{item.label}</p><p className="mt-1 text-[10px] leading-4 text-[#737680] dark:text-[#98A2B3]">{item.description || 'Tanpa keterangan'}</p></div>
                  <div><p className="text-sm font-black text-[#39785D] dark:text-[#8DD0A9]">{formatCurrency(item.price)}</p><p className="text-[10px] text-[#737680] dark:text-[#98A2B3]">per {item.unit}</p></div>
                  <div className="flex justify-end gap-1"><button type="button" onClick={() => onEdit(item)} aria-label={`Edit ${item.label}`} className="rounded-xl p-2 text-[#40536F] hover:bg-[#EEF2F7] dark:text-[#B9C5D5] dark:hover:bg-[#2A3443]"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => remove(item)} aria-label={`Hapus ${item.label}`} className="rounded-xl p-2 text-[#D95858] hover:bg-[#FFF0ED] dark:text-[#FF9393] dark:hover:bg-[#3B272B]"><Trash2 className="h-4 w-4" /></button></div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {settings.unitPrices.length === 0 && <div className="rounded-2xl border border-dashed border-[#CBD3DE] p-10 text-center dark:border-[#4A5361]"><BookOpenCheck className="mx-auto h-7 w-7 text-[#AAB5C5]" /><p className="mt-3 text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">Katalog masih kosong</p><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Tambahkan harga satuan pertama untuk mulai membuat penawaran custom.</p></div>}
      </div>
    </section>
  );
}

function CatalogEditorModal({ item, onChange, onSave, onClose }: { item: UnitPriceItem; onChange: (item: UnitPriceItem) => void; onSave: () => void; onClose: () => void }) {
  return (
    <ModalPortal onClose={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="catalog-editor-title" onSubmit={(event) => { event.preventDefault(); onSave(); }} className="max-h-[92svh] w-full overflow-y-auto rounded-t-3xl border border-[#E1E5EB] bg-white p-5 shadow-2xl dark:border-[#3A424E] dark:bg-[#20242C] sm:max-w-xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#F26B5E]">Harga Satuan</p><h2 id="catalog-editor-title" className="mt-1 text-lg font-black text-[#24324A] dark:text-[#F4F6FA]">{item.id ? 'Edit item katalog' : 'Tambah item katalog'}</h2><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Harga ini akan tersedia pada kalkulator penawaran custom.</p></div><button type="button" onClick={onClose} aria-label="Tutup modal" className="rounded-xl p-2 text-[#737680] hover:bg-[#F2F4F7] dark:text-[#AAB4C5] dark:hover:bg-[#282D36]"><X className="h-5 w-5" /></button></div>
        <div className="mt-6 space-y-4">
          <label><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">Nama layanan</span><input required autoFocus value={item.label} onChange={(event) => onChange({ ...item, label: event.target.value })} className={inputClass} placeholder="Contoh: Reels pendek" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">Kategori</span><select value={item.category} onChange={(event) => onChange({ ...item, category: event.target.value as UnitPriceCategory })} className={inputClass}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">Satuan</span><input required value={item.unit} onChange={(event) => onChange({ ...item, unit: event.target.value })} className={inputClass} placeholder="konten / sesi / jam" /></label>
          </div>
          <label><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">Harga fix</span><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-[#8A8E98]">Rp</span><input type="number" min="0" step="50000" value={item.price} onChange={(event) => onChange({ ...item, price: toNumber(event.target.value) })} className={`${inputClass} pl-9 text-right`} /></div></label>
          <label><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">Keterangan</span><textarea rows={3} value={item.description} onChange={(event) => onChange({ ...item, description: event.target.value })} className={`${inputClass} h-auto resize-y py-3 leading-5`} placeholder="Scope singkat untuk membantu tim memilih harga" /></label>
        </div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 rounded-xl border border-[#DDE2EA] px-4 text-xs font-extrabold text-[#737680] dark:border-[#3A424E] dark:text-[#AAB4C5]">Batal</button><button type="button" onClick={onSave} disabled={!item.label.trim() || !item.unit.trim()} className="h-10 rounded-xl bg-[#24324A] px-5 text-xs font-extrabold text-white disabled:opacity-45 dark:bg-[#F4F6FA] dark:text-[#171A20]">Simpan harga</button></div>
      </form>
    </ModalPortal>
  );
}

export default function FeeCalculatorPage() {
  const router = useRouter();
  const [tab, setTab] = useState<PageTab>('dashboard');
  const [settings, setSettings] = useState<FeeCalculatorSettings>(() => createDefaultFeeSettings());
  const [customQuote, setCustomQuote] = useState<CustomQuoteDraft>(() => createDefaultCustomQuote());
  const [activeSettings, setActiveSettings] = useState<FeeSettingsSection | null>(null);
  const [catalogEditor, setCatalogEditor] = useState<UnitPriceItem | null>(null);
  const [mounted, setMounted] = useState(false);

  const calculation = useMemo(() => calculateFee(settings), [settings]);

  useEffect(() => {
    let cancelled = false;
    try {
      const savedSettings = window.localStorage.getItem(FEE_CALCULATOR_STORAGE_KEY);
      const savedQuote = window.localStorage.getItem(FEE_CUSTOM_QUOTE_STORAGE_KEY);
      const restoredSettings = savedSettings ? normalizeFeeSettings(JSON.parse(savedSettings)) : null;
      const restoredQuote = savedQuote ? normalizeCustomQuote(JSON.parse(savedQuote)) : null;
      queueMicrotask(() => {
        if (cancelled) return;
        if (restoredSettings) setSettings(restoredSettings);
        if (restoredQuote) setCustomQuote(restoredQuote);
        setMounted(true);
      });
    } catch (error) {
      console.warn('[Fee Calculator] Local settings could not be restored:', error);
      queueMicrotask(() => {
        if (!cancelled) setMounted(true);
      });
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(FEE_CALCULATOR_STORAGE_KEY, JSON.stringify(settings));
  }, [mounted, settings]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(FEE_CUSTOM_QUOTE_STORAGE_KEY, JSON.stringify(customQuote));
  }, [customQuote, mounted]);

  const resetAll = () => {
    if (!window.confirm('Kembalikan seluruh kalkulator dan katalog ke pengaturan awal?')) return;
    setSettings(createDefaultFeeSettings());
    setCustomQuote(createDefaultCustomQuote());
  };

  const openCatalogEditor = (item?: UnitPriceItem) => {
    setCatalogEditor(item ? { ...item } : { id: '', label: '', category: 'produksi', unit: 'item', price: 0, description: '' });
  };

  const saveCatalogEditor = () => {
    if (!catalogEditor || !catalogEditor.label.trim() || !catalogEditor.unit.trim()) return;
    const normalized = { ...catalogEditor, id: catalogEditor.id || createItemId('unit'), label: catalogEditor.label.trim(), unit: catalogEditor.unit.trim(), description: catalogEditor.description.trim() };
    setSettings((current) => ({
      ...current,
      unitPrices: current.unitPrices.some((item) => item.id === normalized.id)
        ? current.unitPrices.map((item) => item.id === normalized.id ? normalized : item)
        : [...current.unitPrices, normalized],
    }));
    setCatalogEditor(null);
  };

  const continueToQuote = () => {
    const handoff: QuoteHandoff = {
      source: 'fee-calculator',
      createdAt: new Date().toISOString(),
      items: customQuote.items.map((item) => ({ id: item.id, description: item.description.trim() || 'Item penawaran', quantity: item.quantity, unitPrice: item.unitPrice })),
      discountPercent: customQuote.discountPercent,
      taxPercent: customQuote.taxPercent,
      notes: customQuote.notes,
    };
    window.localStorage.setItem(FEE_QUOTE_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
    router.push('/quotes?prefill=fee-calculator');
  };

  return (
    <div className="min-w-0 space-y-5 pb-8 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#F26B5E]"><Calculator className="h-5 w-5" /><span className="text-[11px] font-extrabold uppercase tracking-[0.16em]">Pricing Workspace</span></div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#24324A] dark:text-[#F4F6FA] sm:text-3xl">Fee Calculator</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#737680] dark:text-[#98A2B3]">Hitung paket, susun penawaran custom, dan kelola harga satuan tanpa memenuhi halaman dengan form panjang.</p>
        </div>
        <div className="flex items-center gap-2"><div className="hidden items-center gap-2 text-[10px] font-bold text-[#39785D] dark:text-[#8DD0A9] sm:flex"><CheckCircle2 className="h-4 w-4" /> Tersimpan otomatis</div><button type="button" onClick={resetAll} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-3 text-xs font-extrabold text-[#40536F] hover:border-[#24324A] dark:border-[#3A424E] dark:bg-[#20242C] dark:text-[#C0C9D6] dark:hover:border-[#718096]"><RotateCcw className="h-4 w-4" /> Reset</button></div>
      </div>

      <nav aria-label="Tab Fee Calculator" className="flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-[#E1E5EB] bg-white p-1.5 shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex h-10 min-w-fit flex-1 items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold transition ${active ? 'bg-[#24324A] text-white shadow-sm dark:bg-[#F4F6FA] dark:text-[#171A20]' : 'text-[#737680] hover:bg-[#F4F6F9] hover:text-[#24324A] dark:text-[#98A2B3] dark:hover:bg-[#282D36] dark:hover:text-white'}`}><Icon className="h-4 w-4" /><span className="hidden sm:inline">{item.label}</span><span className="sm:hidden">{item.compactLabel}</span></button>;
        })}
      </nav>

      {tab === 'dashboard' && <DashboardTab calculation={calculation} settings={settings} onOpen={setActiveSettings} />}
      {tab === 'custom' && <CustomQuoteTab quote={customQuote} setQuote={setCustomQuote} settings={settings} onContinue={continueToQuote} />}
      {tab === 'catalog' && <CatalogTab settings={settings} setSettings={setSettings} onEdit={openCatalogEditor} />}

      {activeSettings && <FeeSettingsModal section={activeSettings} settings={settings} calculation={calculation} onChange={setSettings} onClose={() => setActiveSettings(null)} />}
      {catalogEditor && <CatalogEditorModal item={catalogEditor} onChange={setCatalogEditor} onSave={saveCatalogEditor} onClose={() => setCatalogEditor(null)} />}
    </div>
  );
}
