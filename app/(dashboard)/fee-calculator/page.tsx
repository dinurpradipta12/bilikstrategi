'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Film,
  Info,
  PackageCheck,
  Puzzle,
  RotateCcw,
  Save,
  Sparkles,
  TrendingUp,
  WalletCards,
  Wrench,
} from 'lucide-react';
import {
  FEE_CALCULATOR_STORAGE_KEY,
  calculateFee,
  createDefaultFeeSettings,
  normalizeFeeSettings,
  type FeeCalculatorSettings,
} from '@/lib/fee-calculator';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 1,
});

const packageStyles = [
  {
    border: 'border-[#BFD3F5] dark:border-[#3B5476]',
    top: 'bg-[#EAF2FF] dark:bg-[#29364A]',
    icon: 'bg-[#D8E7FF] text-[#315F98] dark:bg-[#344967] dark:text-[#AFC9EE]',
    accent: 'text-[#315F98] dark:text-[#AFC9EE]',
    badge: 'bg-[#D8E7FF] text-[#315F98] dark:bg-[#344967] dark:text-[#AFC9EE]',
  },
  {
    border: 'border-[#F4C1BA] dark:border-[#72443E]',
    top: 'bg-[#FFF0ED] dark:bg-[#3B272B]',
    icon: 'bg-[#FFDCD6] text-[#B64D43] dark:bg-[#543139] dark:text-[#FFAAA0]',
    accent: 'text-[#B64D43] dark:text-[#FFAAA0]',
    badge: 'bg-[#F26B5E] text-white',
  },
  {
    border: 'border-[#D7C9F1] dark:border-[#574C78]',
    top: 'bg-[#F2E9FA] dark:bg-[#32294C]',
    icon: 'bg-[#E4D7F5] text-[#765096] dark:bg-[#493A68] dark:text-[#D1B8F1]',
    accent: 'text-[#765096] dark:text-[#D1B8F1]',
    badge: 'bg-[#E4D7F5] text-[#765096] dark:bg-[#493A68] dark:text-[#D1B8F1]',
  },
];

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number) {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

function toNonNegativeNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="relative min-w-0">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-[#8A8E98] dark:text-[#98A2B3]">
        Rp
      </span>
      <input
        aria-label={label}
        type="number"
        min="0"
        step="50000"
        value={value}
        onChange={(event) => onChange(toNonNegativeNumber(event.target.value))}
        className="h-10 w-full min-w-0 rounded-xl border border-[#DDE2EA] bg-white pl-9 pr-3 text-right text-xs font-extrabold text-[#24324A] outline-none transition focus:border-[#7F91B0] focus:ring-2 focus:ring-[#DCE7F6] dark:border-[#303742] dark:bg-[#20242C] dark:text-[#F4F6FA] dark:focus:border-[#66758A] dark:focus:ring-[#334052]"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  suffix,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  max?: number;
}) {
  return (
    <div className="relative min-w-0">
      <input
        aria-label={label}
        type="number"
        min="0"
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(toNonNegativeNumber(event.target.value))}
        className={`h-10 w-full min-w-0 rounded-xl border border-[#DDE2EA] bg-white px-3 text-right text-xs font-extrabold text-[#24324A] outline-none transition focus:border-[#7F91B0] focus:ring-2 focus:ring-[#DCE7F6] dark:border-[#303742] dark:bg-[#20242C] dark:text-[#F4F6FA] dark:focus:border-[#66758A] dark:focus:ring-[#334052] ${suffix ? 'pr-11' : ''}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#8A8E98] dark:text-[#98A2B3]">
          {suffix}
        </span>
      )}
    </div>
  );
}

function SectionTitle({
  number,
  title,
  description,
  icon: Icon,
  colorClass,
}: {
  number: string;
  title: string;
  description: string;
  icon: typeof Calculator;
  colorClass: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[#ECEEF2] px-4 py-4 dark:border-[#303742] sm:px-5">
      <div className={`mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-2xl ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8A8E98] dark:text-[#98A2B3]">Bagian {number}</p>
        <h2 className="mt-0.5 text-base font-black text-[#24324A] dark:text-[#F4F6FA] sm:text-lg">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[#737680] dark:text-[#98A2B3]">{description}</p>
      </div>
    </div>
  );
}

export default function FeeCalculatorPage() {
  const [settings, setSettings] = useState<FeeCalculatorSettings>(() => createDefaultFeeSettings());
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(FEE_CALCULATOR_STORAGE_KEY);
        if (saved) setSettings(normalizeFeeSettings(JSON.parse(saved)));
      } catch {
        window.localStorage.removeItem(FEE_CALCULATOR_STORAGE_KEY);
      }
      setStorageReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(FEE_CALCULATOR_STORAGE_KEY, JSON.stringify(settings));
  }, [settings, storageReady]);

  const calculation = useMemo(() => calculateFee(settings), [settings]);

  const sanityChecks = [
    {
      label: 'Fee jasa minimum sudah menutup living cost',
      detail: calculation.livingCostTotal > 0
        ? `${formatCurrency(calculation.baseServiceFee)} dibanding ${formatCurrency(calculation.livingCostTotal)}`
        : 'Isi living cost agar pengecekan dapat dilakukan.',
      passed: calculation.livingCostTotal > 0 && calculation.baseServiceFee >= calculation.livingCostTotal,
    },
    {
      label: 'Margin profit minimal 20%',
      detail: `Margin saat ini ${formatNumber(settings.profitMarginPercent)}%.`,
      passed: settings.profitMarginPercent >= 20,
    },
    {
      label: 'Budget operasional dipisahkan dari fee jasa',
      detail: `${formatCurrency(calculation.operationalTotal)} ditambahkan setelah fee jasa.`,
      passed: true,
    },
    {
      label: 'Jam produksi masih dalam kapasitas retainer',
      detail: `${formatNumber(calculation.productionHours)} dari ${formatNumber(calculation.monthlyWorkHours)} jam per bulan.`,
      passed: calculation.monthlyWorkHours > 0 && calculation.productionHours <= calculation.monthlyWorkHours,
    },
  ];

  const resetCalculator = () => {
    if (!window.confirm('Kembalikan semua nilai ke template awal dari worksheet?')) return;
    setSettings(createDefaultFeeSettings());
  };

  return (
    <div className="min-w-0 space-y-6 pb-28 animate-fade-in md:pb-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#F26B5E]">
            <Calculator className="h-4 w-4" /> Pricing Workspace
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#24324A] dark:text-[#F4F6FA] sm:text-4xl">Fee Calculator</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#737680] dark:text-[#98A2B3]">
            Hitung rate sehat, produksi, add-on, dan budget operasional berdasarkan formula worksheet. Tiga harga paket berubah otomatis saat angka diperbarui.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-4 text-[11px] font-bold text-[#737680] shadow-sm dark:border-[#303742] dark:bg-[#20242C] dark:text-[#AAB4C5]">
            <Save className="h-4 w-4 text-[#4F9D78]" /> {storageReady ? 'Tersimpan otomatis di perangkat' : 'Menyiapkan kalkulator...'}
          </div>
          <button
            type="button"
            onClick={resetCalculator}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DDE2EA] bg-white px-4 text-xs font-extrabold text-[#24324A] shadow-sm transition hover:bg-[#F7F8FA] dark:border-[#303742] dark:bg-[#20242C] dark:text-[#F4F6FA] dark:hover:bg-[#282D36]"
          >
            <RotateCcw className="h-4 w-4 text-[#F26B5E]" /> Reset Template
          </button>
        </div>
      </header>

      {calculation.livingCostTotal === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#F1D5A8] bg-[#FFF9ED] p-4 text-[#8A5B16] dark:border-[#66502C] dark:bg-[#3D321F] dark:text-[#F2C879]">
          <Info className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="text-sm font-extrabold">Mulai dari living cost bulanan</p>
            <p className="mt-1 text-xs leading-5 opacity-90">Rate dan fee jasa masih nol sampai kebutuhan hidup di Bagian 1 diisi. Budget operasional awal Rp600.000 mengikuti worksheet.</p>
          </div>
        </div>
      )}

      <section aria-label="Tiga hasil paket" className="grid gap-3 lg:grid-cols-3">
        {calculation.packages.map((feePackage, index) => {
          const style = packageStyles[index] || packageStyles[0];
          return (
            <article key={feePackage.id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-[#20242C] ${style.border}`}>
              <div className={`flex items-center justify-between gap-3 px-5 py-4 ${style.top}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${style.icon}`}>
                    {index === 0 ? <PackageCheck className="h-5 w-5" /> : index === 1 ? <TrendingUp className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#737680] dark:text-[#AAB4C5]">Paket {index + 1}</p>
                    <h2 className="text-lg font-black text-[#24324A] dark:text-[#F4F6FA]">{feePackage.name}</h2>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${style.badge}`}>
                  +{formatNumber(feePackage.markupPercent)}%
                </span>
              </div>
              <div className="p-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8A8E98] dark:text-[#98A2B3]">Harga all-in / bulan</p>
                <p className={`mt-1 break-words text-2xl font-black tracking-tight sm:text-3xl ${style.accent}`}>{formatCurrency(feePackage.allInPrice)}</p>
                <div className="mt-4 space-y-2 border-t border-[#ECEEF2] pt-4 text-xs dark:border-[#303742]">
                  <div className="flex items-center justify-between gap-3 text-[#737680] dark:text-[#AAB4C5]"><span>Fee jasa dasar</span><span className="font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{formatCurrency(calculation.baseServiceFee)}</span></div>
                  <div className="flex items-center justify-between gap-3 text-[#737680] dark:text-[#AAB4C5]"><span>Markup paket</span><span className="font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{formatCurrency(feePackage.markupAmount)}</span></div>
                  <div className="flex items-center justify-between gap-3 text-[#737680] dark:text-[#AAB4C5]"><span>Operasional</span><span className="font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{formatCurrency(calculation.operationalTotal)}</span></div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section aria-label="Ringkasan komponen harga" className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { label: 'Rate Rekomendasi', value: `${formatCurrency(calculation.recommendedHourlyRate)}/jam`, icon: Clock3, color: 'text-[#315F98]', bg: 'bg-[#EAF2FF] dark:bg-[#29364A]' },
          { label: 'Retainer', value: formatCurrency(calculation.retainerTotal), icon: WalletCards, color: 'text-[#39785D]', bg: 'bg-[#E7F4ED] dark:bg-[#1E392C]' },
          { label: 'Produksi', value: formatCurrency(calculation.productionTotal), icon: Film, color: 'text-[#B64D43]', bg: 'bg-[#FFF0ED] dark:bg-[#3B272B]' },
          { label: 'Add-On', value: formatCurrency(calculation.addOnTotal), icon: Puzzle, color: 'text-[#765096]', bg: 'bg-[#F2E9FA] dark:bg-[#32294C]' },
          { label: 'Operasional', value: formatCurrency(calculation.operationalTotal), icon: Wrench, color: 'text-[#9B6514]', bg: 'bg-[#FFF2DF] dark:bg-[#3D321F]' },
        ].map((item) => (
          <article key={item.label} className="rounded-2xl border border-[#E1E5EB] bg-white p-4 shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${item.bg}`}><item.icon className={`h-4 w-4 ${item.color}`} /></div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8A8E98] dark:text-[#98A2B3]">{item.label}</p>
            <p className="mt-1 break-words text-sm font-black text-[#24324A] dark:text-[#F4F6FA] sm:text-base">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#E1E5EB] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
        <SectionTitle number="1" title="Rate & Retainer" description="Formula worksheet: living cost ÷ jam kerja bulanan, lalu ditambah target margin profit." icon={CircleDollarSign} colorClass="bg-[#EAF2FF] text-[#315F98] dark:bg-[#29364A] dark:text-[#AFC9EE]" />
        <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[#24324A] dark:text-[#F4F6FA]">Kebutuhan hidup bulanan</h3>
              <span className="text-xs font-black text-[#315F98] dark:text-[#AFC9EE]">{formatCurrency(calculation.livingCostTotal)}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {settings.livingCosts.map((item) => (
                <label key={item.id} className="rounded-2xl border border-[#E7EAF0] bg-[#FAFAFB] p-3 dark:border-[#303742] dark:bg-[#282D36]">
                  <span className="block text-xs font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{item.label}</span>
                  <span className="mb-2 mt-0.5 block min-h-4 text-[10px] leading-4 text-[#8A8E98] dark:text-[#98A2B3]">{item.description}</span>
                  <MoneyInput
                    label={item.label}
                    value={item.amount}
                    onChange={(amount) => setSettings((current) => ({
                      ...current,
                      livingCosts: current.livingCosts.map((candidate) => candidate.id === item.id ? { ...candidate, amount } : candidate),
                    }))}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[#E7EAF0] bg-[#F7F8FA] p-4 dark:border-[#303742] dark:bg-[#282D36]">
              <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[#24324A] dark:text-[#F4F6FA]">Pengaturan jam & margin</h3>
              <div className="mt-4 space-y-3">
                <label className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3"><span className="text-xs font-bold text-[#626874] dark:text-[#AAB4C5]">Jam kerja / hari</span><NumberInput label="Jam kerja per hari" value={settings.hoursPerDay} step={0.5} max={24} suffix="jam" onChange={(hoursPerDay) => setSettings((current) => ({ ...current, hoursPerDay }))} /></label>
                <label className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3"><span className="text-xs font-bold text-[#626874] dark:text-[#AAB4C5]">Hari kerja / minggu</span><NumberInput label="Hari kerja per minggu" value={settings.daysPerWeek} max={7} suffix="hari" onChange={(daysPerWeek) => setSettings((current) => ({ ...current, daysPerWeek }))} /></label>
                <label className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3"><span className="text-xs font-bold text-[#626874] dark:text-[#AAB4C5]">Target margin profit</span><NumberInput label="Target margin profit" value={settings.profitMarginPercent} max={300} suffix="%" onChange={(profitMarginPercent) => setSettings((current) => ({ ...current, profitMarginPercent }))} /></label>
              </div>
            </div>
            <div className="rounded-2xl bg-[#24324A] p-4 text-white dark:bg-[#111822]">
              <div className="space-y-3 text-xs">
                <div className="flex justify-between gap-3 text-white/70"><span>Total jam / bulan</span><span className="font-extrabold text-white">{formatNumber(calculation.monthlyWorkHours)} jam</span></div>
                <div className="flex justify-between gap-3 text-white/70"><span>Rate minimum</span><span className="font-extrabold text-white">{formatCurrency(calculation.minimumHourlyRate)}</span></div>
                <div className="border-t border-white/10 pt-3"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/60">Rate rekomendasi</p><p className="mt-1 text-2xl font-black text-[#7FD0A6]">{formatCurrency(calculation.recommendedHourlyRate)}<span className="text-xs text-white/60">/jam</span></p></div>
                <div className="flex justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-white/70"><span>Subtotal retainer</span><span className="font-black text-white">{formatCurrency(calculation.retainerTotal)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#E1E5EB] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
        <SectionTitle number="2" title="Produksi Konten" description="Setiap biaya dihitung dari jam produksi per konten × jumlah konten × rate rekomendasi." icon={Film} colorClass="bg-[#FFF0ED] text-[#B64D43] dark:bg-[#3B272B] dark:text-[#FFAAA0]" />
        <div className="p-4 sm:p-5">
          <div className="hidden grid-cols-[minmax(0,1fr)_130px_130px_170px] gap-3 px-3 pb-2 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8A8E98] dark:text-[#98A2B3] lg:grid">
            <span>Jenis konten</span><span className="text-right">Jam / konten</span><span className="text-right">Jumlah / bulan</span><span className="text-right">Total biaya</span>
          </div>
          <div className="space-y-2">
            {settings.productionItems.map((item) => {
              const total = item.hoursPerItem * item.quantity * calculation.recommendedHourlyRate;
              return (
                <div key={item.id} className="grid gap-3 rounded-2xl border border-[#E7EAF0] bg-[#FAFAFB] p-3 dark:border-[#303742] dark:bg-[#282D36] lg:grid-cols-[minmax(0,1fr)_130px_130px_170px] lg:items-center">
                  <div><p className="text-xs font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{item.label}</p><p className="mt-0.5 text-[10px] text-[#8A8E98] dark:text-[#98A2B3] lg:hidden">Atur jam dan jumlah konten</p></div>
                  <label><span className="mb-1 block text-[9px] font-bold uppercase text-[#8A8E98] dark:text-[#98A2B3] lg:hidden">Jam / konten</span><NumberInput label={`Jam produksi ${item.label}`} value={item.hoursPerItem} step={0.25} suffix="jam" onChange={(hoursPerItem) => setSettings((current) => ({ ...current, productionItems: current.productionItems.map((candidate) => candidate.id === item.id ? { ...candidate, hoursPerItem } : candidate) }))} /></label>
                  <label><span className="mb-1 block text-[9px] font-bold uppercase text-[#8A8E98] dark:text-[#98A2B3] lg:hidden">Jumlah / bulan</span><NumberInput label={`Jumlah ${item.label}`} value={item.quantity} suffix="item" onChange={(quantity) => setSettings((current) => ({ ...current, productionItems: current.productionItems.map((candidate) => candidate.id === item.id ? { ...candidate, quantity } : candidate) }))} /></label>
                  <div className="flex h-10 items-center justify-between rounded-xl bg-[#EEF8F3] px-3 text-xs dark:bg-[#1E392C] lg:justify-end"><span className="font-bold text-[#5E6470] dark:text-[#AAB4C5] lg:hidden">Total</span><span className="font-black text-[#39785D] dark:text-[#8DD0A9]">{formatCurrency(total)}</span></div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#F7F8FA] p-4 dark:bg-[#282D36]"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8A8E98] dark:text-[#98A2B3]">Total konten</p><p className="mt-1 text-lg font-black text-[#24324A] dark:text-[#F4F6FA]">{formatNumber(calculation.contentCount)} konten</p></div>
            <div className="rounded-2xl bg-[#F7F8FA] p-4 dark:bg-[#282D36]"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8A8E98] dark:text-[#98A2B3]">Beban produksi</p><p className="mt-1 text-lg font-black text-[#24324A] dark:text-[#F4F6FA]">{formatNumber(calculation.productionHours)} jam</p><p className="text-[10px] text-[#8A8E98] dark:text-[#98A2B3]">≈ {formatNumber(calculation.equivalentProductionDays)} hari kerja</p></div>
            <div className="rounded-2xl bg-[#24324A] p-4 text-white dark:bg-[#111822]"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/60">Subtotal produksi</p><p className="mt-1 text-lg font-black text-white">{formatCurrency(calculation.productionTotal)}</p></div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-3xl border border-[#E1E5EB] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
          <SectionTitle number="3" title="Add-On & Deliverable" description="Harga × kuantitas yang digunakan untuk klien ini." icon={Puzzle} colorClass="bg-[#F2E9FA] text-[#765096] dark:bg-[#32294C] dark:text-[#D1B8F1]" />
          <div className="space-y-2 p-4 sm:p-5">
            {settings.addOnItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[#E7EAF0] bg-[#FAFAFB] p-3 dark:border-[#303742] dark:bg-[#282D36]">
                <p className="text-xs font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{item.label}</p>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_90px] gap-2">
                  <MoneyInput label={`Harga ${item.label}`} value={item.price} onChange={(price) => setSettings((current) => ({ ...current, addOnItems: current.addOnItems.map((candidate) => candidate.id === item.id ? { ...candidate, price } : candidate) }))} />
                  <NumberInput label={`Kuantitas ${item.label}`} value={item.quantity} suffix="×" onChange={(quantity) => setSettings((current) => ({ ...current, addOnItems: current.addOnItems.map((candidate) => candidate.id === item.id ? { ...candidate, quantity } : candidate) }))} />
                </div>
                <div className="mt-2 flex justify-between gap-3 text-[10px] text-[#8A8E98] dark:text-[#98A2B3]"><span>Subtotal</span><span className="font-extrabold text-[#765096] dark:text-[#D1B8F1]">{formatCurrency(item.price * item.quantity)}</span></div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#765096] px-4 py-3 text-white dark:bg-[#493A68]"><span className="text-xs font-extrabold uppercase tracking-[0.1em]">Total Add-On</span><span className="text-base font-black">{formatCurrency(calculation.addOnTotal)}</span></div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[#E1E5EB] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
          <SectionTitle number="4" title="Budget Operasional" description="Biaya pendukung wajib dipisahkan dari fee jasa dan idealnya ditanggung klien." icon={Wrench} colorClass="bg-[#FFF2DF] text-[#9B6514] dark:bg-[#3D321F] dark:text-[#F2C879]" />
          <div className="space-y-2 p-4 sm:p-5">
            {settings.operationalItems.map((item) => (
              <label key={item.id} className="block rounded-2xl border border-[#E7EAF0] bg-[#FAFAFB] p-3 dark:border-[#303742] dark:bg-[#282D36]">
                <div className="mb-2"><span className="block text-xs font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{item.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-[#8A8E98] dark:text-[#98A2B3]">{item.description}</span></div>
                <MoneyInput label={item.label} value={item.amount} onChange={(amount) => setSettings((current) => ({ ...current, operationalItems: current.operationalItems.map((candidate) => candidate.id === item.id ? { ...candidate, amount } : candidate) }))} />
              </label>
            ))}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#E07A00] px-4 py-3 text-white dark:bg-[#9A5A0C]"><span className="text-xs font-extrabold uppercase tracking-[0.1em]">Total Operasional</span><span className="text-base font-black">{formatCurrency(calculation.operationalTotal)}</span></div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="overflow-hidden rounded-3xl border border-[#E1E5EB] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
          <SectionTitle number="5" title="Pengaturan Tiga Paket" description="Markup diterapkan hanya pada fee jasa dasar; budget operasional tetap ditambahkan terpisah." icon={PackageCheck} colorClass="bg-[#E7F4ED] text-[#39785D] dark:bg-[#1E392C] dark:text-[#8DD0A9]" />
          <div className="grid gap-3 p-4 sm:p-5 xl:grid-cols-3">
            {settings.packages.map((item, index) => {
              const style = packageStyles[index] || packageStyles[0];
              return (
                <div key={item.id} className={`rounded-2xl border p-4 ${style.border} ${style.top}`}>
                  <label className="block"><span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#AAB4C5]">Nama paket</span><input aria-label={`Nama paket ${index + 1}`} value={item.name} onChange={(event) => setSettings((current) => ({ ...current, packages: current.packages.map((candidate) => candidate.id === item.id ? { ...candidate, name: event.target.value } : candidate) }))} className="h-10 w-full rounded-xl border border-white/70 bg-white px-3 text-xs font-extrabold text-[#24324A] outline-none focus:border-[#7F91B0] dark:border-[#4A5361] dark:bg-[#20242C] dark:text-[#F4F6FA]" /></label>
                  <label className="mt-3 block"><span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#AAB4C5]">Markup fee jasa</span><NumberInput label={`Markup ${item.name}`} value={item.markupPercent} max={300} suffix="%" onChange={(markupPercent) => setSettings((current) => ({ ...current, packages: current.packages.map((candidate) => candidate.id === item.id ? { ...candidate, markupPercent } : candidate) }))} /></label>
                  <p className={`mt-3 text-sm font-black ${style.accent}`}>{formatCurrency(calculation.packages[index]?.allInPrice || 0)}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[#E1E5EB] bg-white shadow-sm dark:border-[#303742] dark:bg-[#20242C]">
          <div className="border-b border-[#ECEEF2] px-4 py-4 dark:border-[#303742] sm:px-5"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-[#4F9D78]" /><h2 className="text-base font-black text-[#24324A] dark:text-[#F4F6FA]">Sanity Check Proposal</h2></div><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Pengecekan otomatis mengikuti dashboard worksheet.</p></div>
          <div className="space-y-2 p-4 sm:p-5">
            {sanityChecks.map((check) => (
              <div key={check.label} className={`flex items-start gap-3 rounded-2xl border p-3 ${check.passed ? 'border-[#CDE7D9] bg-[#EEF8F3] dark:border-[#315D49] dark:bg-[#1E392C]' : 'border-[#F1D5A8] bg-[#FFF9ED] dark:border-[#66502C] dark:bg-[#3D321F]'}`}>
                {check.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[#39785D] dark:text-[#8DD0A9]" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-[#A46D18] dark:text-[#F2C879]" />}
                <div><p className="text-xs font-extrabold text-[#24324A] dark:text-[#F4F6FA]">{check.label}</p><p className="mt-0.5 text-[10px] leading-4 text-[#737680] dark:text-[#AAB4C5]">{check.detail}</p></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-[#DCE5F2] bg-[#F4F8FD] p-4 text-xs leading-5 text-[#536176] dark:border-[#3B4A5D] dark:bg-[#2A3443] dark:text-[#B9C5D5]">
        <Info className="mt-0.5 h-4 w-4 flex-none text-[#315F98] dark:text-[#AFC9EE]" />
        <p><span className="font-extrabold text-[#24324A] dark:text-[#F4F6FA]">Catatan formula:</span> satu bulan dihitung sebagai 4 minggu seperti worksheet. Harga paket = retainer + produksi + add-on + markup paket, kemudian budget operasional ditambahkan sebagai komponen terpisah.</p>
      </div>
    </div>
  );
}
