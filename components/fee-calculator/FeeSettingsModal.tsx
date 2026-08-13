'use client';

import React from 'react';
import {
  CircleDollarSign,
  Film,
  PackageCheck,
  Plus,
  Puzzle,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import {
  createItemId,
  type FeeCalculation,
  type FeeCalculatorSettings,
} from '@/lib/fee-calculator';

export type FeeSettingsSection = 'rate' | 'production' | 'addons' | 'operational' | 'packages';

type FeeSettingsModalProps = {
  section: FeeSettingsSection;
  settings: FeeCalculatorSettings;
  calculation: FeeCalculation;
  onChange: React.Dispatch<React.SetStateAction<FeeCalculatorSettings>>;
  onClose: () => void;
};

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function toNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

const inputClass = 'h-11 w-full rounded-xl border border-[#DDE2EA] bg-white px-3 text-sm font-semibold text-[#24324A] outline-none transition focus:border-[#7F91B0] focus:ring-2 focus:ring-[#DCE7F6] dark:border-[#3A424E] dark:bg-[#20242C] dark:text-[#F4F6FA] dark:focus:border-[#66758A] dark:focus:ring-[#334052]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#737680] dark:text-[#98A2B3]">
        {label}
      </span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(toNumber(event.target.value))}
          className={`${inputClass} text-right ${suffix ? 'pr-14' : ''}`}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#8A8E98] dark:text-[#98A2B3]">{suffix}</span>}
      </div>
    </Field>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-[#8A8E98] dark:text-[#98A2B3]">Rp</span>
        <input
          type="number"
          min="0"
          step="50000"
          value={value}
          onChange={(event) => onChange(toNumber(event.target.value))}
          className={`${inputClass} pl-9 text-right`}
        />
      </div>
    </Field>
  );
}

const sectionMeta = {
  rate: {
    eyebrow: 'Bagian 1',
    title: 'Rate & Retainer',
    description: 'Atur kebutuhan bulanan, jam kerja, dan target margin untuk mendapatkan rate dasar.',
    icon: CircleDollarSign,
    iconClass: 'bg-[#EAF2FF] text-[#315F98] dark:bg-[#29364A] dark:text-[#AFC9EE]',
  },
  production: {
    eyebrow: 'Bagian 2',
    title: 'Produksi Konten',
    description: 'Tambah, ubah, atau hapus komponen produksi sesuai scope setiap klien.',
    icon: Film,
    iconClass: 'bg-[#FFF0ED] text-[#B64D43] dark:bg-[#3B272B] dark:text-[#FFAAA0]',
  },
  addons: {
    eyebrow: 'Bagian 3',
    title: 'Add-On & Deliverable',
    description: 'Atur deliverable tambahan beserta harga dan kuantitasnya.',
    icon: Puzzle,
    iconClass: 'bg-[#F2E9FA] text-[#765096] dark:bg-[#32294C] dark:text-[#D1B8F1]',
  },
  operational: {
    eyebrow: 'Bagian 4',
    title: 'Budget Operasional',
    description: 'Catat biaya pendukung yang tetap dipisahkan dari fee jasa.',
    icon: Wrench,
    iconClass: 'bg-[#FFF2DF] text-[#9B6514] dark:bg-[#3D321F] dark:text-[#F2C879]',
  },
  packages: {
    eyebrow: 'Bagian 5',
    title: 'Pengaturan Tiga Paket',
    description: 'Atur nama dan markup tiga paket yang dihitung otomatis.',
    icon: PackageCheck,
    iconClass: 'bg-[#E7F4ED] text-[#39785D] dark:bg-[#1E392C] dark:text-[#8DD0A9]',
  },
} satisfies Record<FeeSettingsSection, {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof CircleDollarSign;
  iconClass: string;
}>;

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[#D95858] transition hover:bg-[#FFF0ED] dark:text-[#FF9393] dark:hover:bg-[#3B272B]"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function AddButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-[#AEB9C8] px-3 text-xs font-extrabold text-[#40536F] transition hover:border-[#24324A] hover:text-[#24324A] dark:border-[#596575] dark:text-[#C0C9D6] dark:hover:border-[#AAB5C5] dark:hover:text-white"
    >
      <Plus className="h-4 w-4" /> {children}
    </button>
  );
}

export default function FeeSettingsModal({ section, settings, calculation, onChange, onClose }: FeeSettingsModalProps) {
  const meta = sectionMeta[section];
  const Icon = meta.icon;

  return (
    <ModalPortal onClose={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`fee-modal-${section}`}
        className="flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl border border-[#E1E5EB] bg-white shadow-2xl dark:border-[#3A424E] dark:bg-[#20242C] sm:max-w-4xl sm:rounded-3xl"
      >
        <div className="flex items-start gap-3 border-b border-[#E7EAF0] px-4 py-4 dark:border-[#303742] sm:px-6 sm:py-5">
          <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-2xl ${meta.iconClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8A8E98] dark:text-[#98A2B3]">{meta.eyebrow}</p>
            <h2 id={`fee-modal-${section}`} className="mt-0.5 text-lg font-black text-[#24324A] dark:text-[#F4F6FA]">{meta.title}</h2>
            <p className="mt-1 text-xs leading-5 text-[#737680] dark:text-[#98A2B3]">{meta.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup pengaturan" className="rounded-xl p-2 text-[#737680] transition hover:bg-[#F2F4F7] dark:text-[#AAB4C5] dark:hover:bg-[#282D36]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {section === 'rate' && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-2xl bg-[#F7F8FA] p-4 dark:bg-[#282D36] sm:grid-cols-3">
                <NumberField label="Jam kerja / hari" value={settings.hoursPerDay} step={0.5} suffix="jam" onChange={(hoursPerDay) => onChange((current) => ({ ...current, hoursPerDay }))} />
                <NumberField label="Hari kerja / minggu" value={settings.daysPerWeek} step={0.5} suffix="hari" onChange={(daysPerWeek) => onChange((current) => ({ ...current, daysPerWeek }))} />
                <NumberField label="Target margin profit" value={settings.profitMarginPercent} suffix="%" onChange={(profitMarginPercent) => onChange((current) => ({ ...current, profitMarginPercent }))} />
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">Kebutuhan hidup bulanan</h3><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Total {formatCurrency(calculation.livingCostTotal)}</p></div>
                <AddButton onClick={() => onChange((current) => ({ ...current, livingCosts: [...current.livingCosts, { id: createItemId('living'), label: 'Kebutuhan baru', description: 'Tambahkan keterangan', amount: 0 }] }))}>Tambah kebutuhan</AddButton>
              </div>
              <div className="space-y-3">
                {settings.livingCosts.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-2xl border border-[#E7EAF0] bg-[#FAFAFB] p-3 dark:border-[#303742] dark:bg-[#282D36] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_40px] sm:items-end">
                    <Field label="Nama kebutuhan"><input className={inputClass} value={item.label} onChange={(event) => onChange((current) => ({ ...current, livingCosts: current.livingCosts.map((candidate) => candidate.id === item.id ? { ...candidate, label: event.target.value } : candidate) }))} /></Field>
                    <Field label="Keterangan"><input className={inputClass} value={item.description} onChange={(event) => onChange((current) => ({ ...current, livingCosts: current.livingCosts.map((candidate) => candidate.id === item.id ? { ...candidate, description: event.target.value } : candidate) }))} /></Field>
                    <MoneyField label="Nominal / bulan" value={item.amount} onChange={(amount) => onChange((current) => ({ ...current, livingCosts: current.livingCosts.map((candidate) => candidate.id === item.id ? { ...candidate, amount } : candidate) }))} />
                    <RemoveButton label={`Hapus ${item.label}`} onClick={() => onChange((current) => ({ ...current, livingCosts: current.livingCosts.filter((candidate) => candidate.id !== item.id) }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'production' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">Komponen produksi</h3><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">{calculation.contentCount} konten · {calculation.productionHours.toLocaleString('id-ID', { maximumFractionDigits: 1 })} jam · {formatCurrency(calculation.productionTotal)}</p></div>
                <AddButton onClick={() => onChange((current) => ({ ...current, productionItems: [...current.productionItems, { id: createItemId('production'), label: 'Jenis konten baru', hoursPerItem: 1, quantity: 0 }] }))}>Tambah komponen produksi</AddButton>
              </div>
              <div className="space-y-3">
                {settings.productionItems.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-2xl border border-[#E7EAF0] bg-[#FAFAFB] p-3 dark:border-[#303742] dark:bg-[#282D36] sm:grid-cols-[minmax(0,1fr)_150px_150px_40px] sm:items-end">
                    <Field label="Jenis konten"><input className={inputClass} value={item.label} onChange={(event) => onChange((current) => ({ ...current, productionItems: current.productionItems.map((candidate) => candidate.id === item.id ? { ...candidate, label: event.target.value } : candidate) }))} /></Field>
                    <NumberField label="Jam / konten" value={item.hoursPerItem} step={0.25} suffix="jam" onChange={(hoursPerItem) => onChange((current) => ({ ...current, productionItems: current.productionItems.map((candidate) => candidate.id === item.id ? { ...candidate, hoursPerItem } : candidate) }))} />
                    <NumberField label="Jumlah / bulan" value={item.quantity} suffix="item" onChange={(quantity) => onChange((current) => ({ ...current, productionItems: current.productionItems.map((candidate) => candidate.id === item.id ? { ...candidate, quantity } : candidate) }))} />
                    <RemoveButton label={`Hapus ${item.label}`} onClick={() => onChange((current) => ({ ...current, productionItems: current.productionItems.filter((candidate) => candidate.id !== item.id) }))} />
                  </div>
                ))}
                {settings.productionItems.length === 0 && <div className="rounded-2xl border border-dashed border-[#CBD3DE] p-8 text-center text-xs text-[#737680] dark:border-[#4A5361] dark:text-[#98A2B3]">Belum ada komponen produksi. Tambahkan sesuai kebutuhan klien.</div>}
              </div>
            </div>
          )}

          {section === 'addons' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">Add-on aktif</h3><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Subtotal {formatCurrency(calculation.addOnTotal)}</p></div>
                <AddButton onClick={() => onChange((current) => ({ ...current, addOnItems: [...current.addOnItems, { id: createItemId('addon'), label: 'Add-on baru', price: 0, quantity: 0 }] }))}>Tambah add-on</AddButton>
              </div>
              <div className="space-y-3">
                {settings.addOnItems.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-2xl border border-[#E7EAF0] bg-[#FAFAFB] p-3 dark:border-[#303742] dark:bg-[#282D36] sm:grid-cols-[minmax(0,1fr)_180px_130px_40px] sm:items-end">
                    <Field label="Nama add-on"><input className={inputClass} value={item.label} onChange={(event) => onChange((current) => ({ ...current, addOnItems: current.addOnItems.map((candidate) => candidate.id === item.id ? { ...candidate, label: event.target.value } : candidate) }))} /></Field>
                    <MoneyField label="Harga satuan" value={item.price} onChange={(price) => onChange((current) => ({ ...current, addOnItems: current.addOnItems.map((candidate) => candidate.id === item.id ? { ...candidate, price } : candidate) }))} />
                    <NumberField label="Kuantitas" value={item.quantity} suffix="×" onChange={(quantity) => onChange((current) => ({ ...current, addOnItems: current.addOnItems.map((candidate) => candidate.id === item.id ? { ...candidate, quantity } : candidate) }))} />
                    <RemoveButton label={`Hapus ${item.label}`} onClick={() => onChange((current) => ({ ...current, addOnItems: current.addOnItems.filter((candidate) => candidate.id !== item.id) }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'operational' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="text-sm font-black text-[#24324A] dark:text-[#F4F6FA]">Komponen operasional</h3><p className="mt-1 text-xs text-[#737680] dark:text-[#98A2B3]">Subtotal {formatCurrency(calculation.operationalTotal)}</p></div>
                <AddButton onClick={() => onChange((current) => ({ ...current, operationalItems: [...current.operationalItems, { id: createItemId('operational'), label: 'Operasional baru', description: 'Tambahkan keterangan', amount: 0 }] }))}>Tambah operasional</AddButton>
              </div>
              <div className="space-y-3">
                {settings.operationalItems.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-2xl border border-[#E7EAF0] bg-[#FAFAFB] p-3 dark:border-[#303742] dark:bg-[#282D36] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_40px] sm:items-end">
                    <Field label="Nama komponen"><input className={inputClass} value={item.label} onChange={(event) => onChange((current) => ({ ...current, operationalItems: current.operationalItems.map((candidate) => candidate.id === item.id ? { ...candidate, label: event.target.value } : candidate) }))} /></Field>
                    <Field label="Keterangan"><input className={inputClass} value={item.description} onChange={(event) => onChange((current) => ({ ...current, operationalItems: current.operationalItems.map((candidate) => candidate.id === item.id ? { ...candidate, description: event.target.value } : candidate) }))} /></Field>
                    <MoneyField label="Nominal" value={item.amount} onChange={(amount) => onChange((current) => ({ ...current, operationalItems: current.operationalItems.map((candidate) => candidate.id === item.id ? { ...candidate, amount } : candidate) }))} />
                    <RemoveButton label={`Hapus ${item.label}`} onClick={() => onChange((current) => ({ ...current, operationalItems: current.operationalItems.filter((candidate) => candidate.id !== item.id) }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'packages' && (
            <div className="grid gap-4 md:grid-cols-3">
              {settings.packages.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-[#E1E5EB] bg-[#FAFAFB] p-4 dark:border-[#303742] dark:bg-[#282D36]">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8A8E98] dark:text-[#98A2B3]">Paket {index + 1}</p>
                  <div className="mt-4 space-y-4">
                    <Field label="Nama paket"><input className={inputClass} value={item.name} onChange={(event) => onChange((current) => ({ ...current, packages: current.packages.map((candidate) => candidate.id === item.id ? { ...candidate, name: event.target.value } : candidate) }))} /></Field>
                    <NumberField label="Markup fee jasa" value={item.markupPercent} suffix="%" onChange={(markupPercent) => onChange((current) => ({ ...current, packages: current.packages.map((candidate) => candidate.id === item.id ? { ...candidate, markupPercent } : candidate) }))} />
                  </div>
                  <div className="mt-4 rounded-xl bg-[#24324A] p-3 text-white dark:bg-[#111822]"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/60">Harga otomatis</p><p className="mt-1 text-base font-black">{formatCurrency(calculation.packages[index]?.allInPrice || 0)}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#E7EAF0] bg-[#FAFAFB] px-4 py-3 dark:border-[#303742] dark:bg-[#282D36] sm:px-6">
          <p className="hidden text-[10px] text-[#737680] dark:text-[#98A2B3] sm:block">Perubahan tersimpan otomatis di perangkat ini.</p>
          <button type="button" onClick={onClose} className="ml-auto inline-flex h-10 items-center rounded-xl bg-[#24324A] px-5 text-xs font-extrabold text-white transition hover:bg-[#1B263A] dark:bg-[#F4F6FA] dark:text-[#171A20] dark:hover:bg-white">Selesai</button>
        </div>
      </section>
    </ModalPortal>
  );
}
