export type LivingCostItem = {
  id: string;
  label: string;
  description: string;
  amount: number;
};

export type ProductionItem = {
  id: string;
  label: string;
  hoursPerItem: number;
  quantity: number;
};

export type AddOnItem = {
  id: string;
  label: string;
  price: number;
  quantity: number;
};

export type OperationalItem = {
  id: string;
  label: string;
  description: string;
  amount: number;
};

export type FeePackageSetting = {
  id: string;
  name: string;
  markupPercent: number;
};

export type UnitPriceCategory = 'produksi' | 'add-on' | 'operasional' | 'lainnya';

export type UnitPriceItem = {
  id: string;
  label: string;
  category: UnitPriceCategory;
  unit: string;
  price: number;
  description: string;
};

export type FeeCalculatorSettings = {
  version: 2;
  livingCosts: LivingCostItem[];
  hoursPerDay: number;
  daysPerWeek: number;
  profitMarginPercent: number;
  productionItems: ProductionItem[];
  addOnItems: AddOnItem[];
  operationalItems: OperationalItem[];
  packages: FeePackageSetting[];
  unitPrices: UnitPriceItem[];
};

export type CustomQuoteItem = {
  id: string;
  unitPriceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type CustomQuoteDraft = {
  version: 1;
  items: CustomQuoteItem[];
  discountPercent: number;
  taxPercent: number;
  notes: string;
};

export type QuoteHandoff = {
  source: 'fee-calculator';
  createdAt: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  discountPercent: number;
  taxPercent: number;
  notes: string;
};

export type FeePackageResult = FeePackageSetting & {
  markupAmount: number;
  serviceFee: number;
  allInPrice: number;
};

export type FeeCalculation = {
  livingCostTotal: number;
  monthlyWorkHours: number;
  minimumHourlyRate: number;
  recommendedHourlyRate: number;
  retainerTotal: number;
  productionTotal: number;
  productionHours: number;
  contentCount: number;
  equivalentProductionDays: number;
  addOnTotal: number;
  operationalTotal: number;
  baseServiceFee: number;
  baseAllInPrice: number;
  packages: FeePackageResult[];
};

export type CustomQuoteCalculation = {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
};

export const FEE_CALCULATOR_STORAGE_KEY = 'bilik_fee_calculator_v1';
export const FEE_CUSTOM_QUOTE_STORAGE_KEY = 'bilik_fee_custom_quote_v1';
export const FEE_QUOTE_HANDOFF_STORAGE_KEY = 'bilik_fee_quote_handoff_v1';

const DEFAULT_FEE_SETTINGS: FeeCalculatorSettings = {
  version: 2,
  livingCosts: [
    { id: 'housing', label: 'Sewa / kos / cicilan rumah', description: 'Biaya tempat tinggal utama', amount: 0 },
    { id: 'food', label: 'Makan & minum', description: 'Estimasi makan 3× sehari × 30 hari', amount: 0 },
    { id: 'transport', label: 'Transportasi', description: 'Bensin, Grab, KRL, dan lainnya', amount: 0 },
    { id: 'utilities', label: 'Internet & listrik', description: 'Kebutuhan kerja wajib', amount: 0 },
    { id: 'health', label: 'Kesehatan & pribadi', description: 'Skincare, obat, vitamin, dan lainnya', amount: 0 },
    { id: 'social', label: 'Hiburan & sosial', description: 'Makan bersama, nonton, dan lainnya', amount: 0 },
    { id: 'saving', label: 'Tabungan / investasi target', description: 'Rekomendasi minimal 20% income', amount: 0 },
    { id: 'buffer', label: 'Lain-lain / tak terduga', description: 'Buffer kebutuhan tidak terencana', amount: 0 },
  ],
  hoursPerDay: 7,
  daysPerWeek: 5,
  profitMarginPercent: 40,
  productionItems: [
    { id: 'static', label: 'Foto / Grafis (static post)', hoursPerItem: 1.5, quantity: 0 },
    { id: 'carousel', label: 'Carousel / Infografis', hoursPerItem: 3, quantity: 0 },
    { id: 'short-video', label: 'Video / Reels pendek (<60 detik)', hoursPerItem: 4.5, quantity: 0 },
    { id: 'long-video', label: 'Long-form Video (>60 detik)', hoursPerItem: 7, quantity: 0 },
    { id: 'caption', label: 'Copywriting caption saja', hoursPerItem: 0.75, quantity: 0 },
    { id: 'story', label: 'Story / Ephemeral content', hoursPerItem: 0.75, quantity: 0 },
    { id: 'thumbnail', label: 'Thumbnail / Cover design', hoursPerItem: 1, quantity: 0 },
    { id: 'other-content', label: 'Jenis konten lainnya', hoursPerItem: 1, quantity: 0 },
  ],
  addOnItems: [
    { id: 'strategy-deck', label: 'Strategy deck / content plan bulanan', price: 250000, quantity: 0 },
    { id: 'monthly-report', label: 'Monthly report & analitik mendalam', price: 200000, quantity: 0 },
    { id: 'client-meeting', label: 'Meeting klien (per sesi)', price: 150000, quantity: 0 },
    { id: 'brand-audit', label: 'Brand audit / riset kompetitor', price: 350000, quantity: 0 },
    { id: 'community-basic', label: 'Community management dasar', price: 750000, quantity: 0 },
    { id: 'community-full', label: 'Community management penuh', price: 1500000, quantity: 0 },
    { id: 'paid-ads', label: 'Paid ads setup & monitoring', price: 750000, quantity: 0 },
    { id: 'consultation', label: 'Konsultasi per jam (non-retainer)', price: 200000, quantity: 0 },
    { id: 'other-addon-1', label: 'Add-on lainnya 1', price: 0, quantity: 0 },
    { id: 'other-addon-2', label: 'Add-on lainnya 2', price: 0, quantity: 0 },
  ],
  operationalItems: [
    { id: 'tools', label: 'Aplikasi / tools berbayar', description: 'Canva Pro, Later, Buffer, dan lainnya', amount: 200000 },
    { id: 'design-software', label: 'Adobe CC / software desain', description: 'Figma, Premiere, CapCut Premium, dan lainnya', amount: 250000 },
    { id: 'licensed-assets', label: 'Musik / stock foto berlisensi', description: 'Envato, Shutterstock, dan lainnya', amount: 0 },
    { id: 'cloud', label: 'Penyimpanan cloud', description: 'Google Drive, Dropbox, dan lainnya', amount: 50000 },
    { id: 'extra-internet', label: 'Internet / kuota tambahan', description: 'Upload konten besar atau WFH', amount: 100000 },
    { id: 'client-transport', label: 'Transport ke klien', description: 'WFC, meeting, atau kunjungan klien', amount: 0 },
    { id: 'field-cost', label: 'Parkir & operasional lapangan', description: 'Kunjungan, event, dan aktivitas lapangan', amount: 0 },
    { id: 'other-operational', label: 'Operasional lainnya', description: 'Biaya pendukung lain di luar fee jasa', amount: 0 },
  ],
  packages: [
    { id: 'starter', name: 'Starter', markupPercent: 0 },
    { id: 'growth', name: 'Growth', markupPercent: 20 },
    { id: 'scale', name: 'Scale', markupPercent: 40 },
  ],
  unitPrices: [
    { id: 'unit-static', label: 'Foto / Grafis (static post)', category: 'produksi', unit: 'konten', price: 150000, description: 'Harga satuan patokan untuk satu static post.' },
    { id: 'unit-carousel', label: 'Carousel / Infografis', category: 'produksi', unit: 'konten', price: 250000, description: 'Harga satuan patokan untuk satu carousel.' },
    { id: 'unit-short-video', label: 'Video / Reels pendek', category: 'produksi', unit: 'video', price: 400000, description: 'Video vertikal berdurasi kurang dari 60 detik.' },
    { id: 'unit-long-video', label: 'Long-form video', category: 'produksi', unit: 'video', price: 750000, description: 'Video berdurasi lebih dari 60 detik.' },
    { id: 'unit-caption', label: 'Copywriting caption', category: 'produksi', unit: 'caption', price: 75000, description: 'Copywriting caption tanpa produksi visual.' },
    { id: 'unit-story', label: 'Story / ephemeral content', category: 'produksi', unit: 'konten', price: 75000, description: 'Harga satuan per story.' },
    { id: 'unit-thumbnail', label: 'Thumbnail / cover design', category: 'produksi', unit: 'desain', price: 100000, description: 'Harga satuan per desain cover.' },
    { id: 'unit-strategy', label: 'Strategy deck / content plan', category: 'add-on', unit: 'dokumen', price: 250000, description: 'Per dokumen atau periode bulanan.' },
    { id: 'unit-report', label: 'Monthly report & analitik', category: 'add-on', unit: 'laporan', price: 200000, description: 'Laporan dan analisis performa bulanan.' },
    { id: 'unit-meeting', label: 'Meeting klien', category: 'add-on', unit: 'sesi', price: 150000, description: 'Harga per sesi meeting.' },
    { id: 'unit-brand-audit', label: 'Brand audit / riset kompetitor', category: 'add-on', unit: 'proyek', price: 350000, description: 'Audit awal untuk kebutuhan proyek.' },
    { id: 'unit-consultation', label: 'Konsultasi non-retainer', category: 'add-on', unit: 'jam', price: 200000, description: 'Harga konsultasi per jam.' },
  ],
};

function finiteNumber(value: unknown, fallback: number) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
}

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function savedArray(value: unknown) {
  return Array.isArray(value) ? value.map(recordValue) : [];
}

function legacyItems<T extends { id: string }>(
  defaults: T[],
  value: unknown,
  normalize: (candidate: Record<string, unknown>, fallback: T, index: number) => T,
) {
  const saved = savedArray(value);
  const merged = defaults.map((fallback, index) => {
    const candidate = saved.find((item) => item.id === fallback.id) || {};
    return normalize(candidate, fallback, index);
  });
  const extra = saved.filter((item) => !defaults.some((fallback) => fallback.id === item.id));
  return [...merged, ...extra.map((item, index) => normalize(item, defaults[0], defaults.length + index))];
}

function dynamicItems<T extends { id: string }>(
  defaults: T[],
  value: unknown,
  isVersionTwo: boolean,
  normalize: (candidate: Record<string, unknown>, fallback: T, index: number) => T,
) {
  if (!Array.isArray(value)) return defaults.map((item) => ({ ...item }));
  if (!isVersionTwo) return legacyItems(defaults, value, normalize);
  return savedArray(value).map((candidate, index) => normalize(candidate, defaults[index] || defaults[0], index));
}

function normalizeCategory(value: unknown, fallback: UnitPriceCategory): UnitPriceCategory {
  return value === 'produksi' || value === 'add-on' || value === 'operasional' || value === 'lainnya'
    ? value
    : fallback;
}

export function createItemId(prefix = 'item') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultFeeSettings(): FeeCalculatorSettings {
  return {
    ...DEFAULT_FEE_SETTINGS,
    livingCosts: DEFAULT_FEE_SETTINGS.livingCosts.map((item) => ({ ...item })),
    productionItems: DEFAULT_FEE_SETTINGS.productionItems.map((item) => ({ ...item })),
    addOnItems: DEFAULT_FEE_SETTINGS.addOnItems.map((item) => ({ ...item })),
    operationalItems: DEFAULT_FEE_SETTINGS.operationalItems.map((item) => ({ ...item })),
    packages: DEFAULT_FEE_SETTINGS.packages.map((item) => ({ ...item })),
    unitPrices: DEFAULT_FEE_SETTINGS.unitPrices.map((item) => ({ ...item })),
  };
}

export function normalizeFeeSettings(value: unknown): FeeCalculatorSettings {
  const defaults = createDefaultFeeSettings();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const saved = value as Record<string, unknown>;
  const isVersionTwo = Number(saved.version) >= 2;

  return {
    version: 2,
    hoursPerDay: finiteNumber(saved.hoursPerDay, defaults.hoursPerDay),
    daysPerWeek: finiteNumber(saved.daysPerWeek, defaults.daysPerWeek),
    profitMarginPercent: finiteNumber(saved.profitMarginPercent, defaults.profitMarginPercent),
    livingCosts: dynamicItems(defaults.livingCosts, saved.livingCosts, isVersionTwo, (candidate, fallback, index) => ({
      id: textValue(candidate.id, fallback?.id || `living-${index}`),
      label: textValue(candidate.label, fallback?.label || `Kebutuhan ${index + 1}`),
      description: textValue(candidate.description, fallback?.description || ''),
      amount: finiteNumber(candidate.amount, fallback?.amount || 0),
    })),
    productionItems: dynamicItems(defaults.productionItems, saved.productionItems, isVersionTwo, (candidate, fallback, index) => ({
      id: textValue(candidate.id, fallback?.id || `production-${index}`),
      label: textValue(candidate.label, fallback?.label || `Konten ${index + 1}`),
      hoursPerItem: finiteNumber(candidate.hoursPerItem, fallback?.hoursPerItem || 0),
      quantity: finiteNumber(candidate.quantity, fallback?.quantity || 0),
    })),
    addOnItems: dynamicItems(defaults.addOnItems, saved.addOnItems, isVersionTwo, (candidate, fallback, index) => ({
      id: textValue(candidate.id, fallback?.id || `addon-${index}`),
      label: textValue(candidate.label, fallback?.label || `Add-on ${index + 1}`),
      price: finiteNumber(candidate.price, fallback?.price || 0),
      quantity: finiteNumber(candidate.quantity, fallback?.quantity || 0),
    })),
    operationalItems: dynamicItems(defaults.operationalItems, saved.operationalItems, isVersionTwo, (candidate, fallback, index) => ({
      id: textValue(candidate.id, fallback?.id || `operational-${index}`),
      label: textValue(candidate.label, fallback?.label || `Operasional ${index + 1}`),
      description: textValue(candidate.description, fallback?.description || ''),
      amount: finiteNumber(candidate.amount, fallback?.amount || 0),
    })),
    packages: dynamicItems(defaults.packages, saved.packages, isVersionTwo, (candidate, fallback, index) => ({
      id: textValue(candidate.id, fallback?.id || `package-${index}`),
      name: textValue(candidate.name, fallback?.name || `Paket ${index + 1}`),
      markupPercent: finiteNumber(candidate.markupPercent, fallback?.markupPercent || 0),
    })).slice(0, 3),
    unitPrices: dynamicItems(defaults.unitPrices, saved.unitPrices, isVersionTwo, (candidate, fallback, index) => ({
      id: textValue(candidate.id, fallback?.id || `unit-${index}`),
      label: textValue(candidate.label, fallback?.label || `Harga satuan ${index + 1}`),
      category: normalizeCategory(candidate.category, fallback?.category || 'lainnya'),
      unit: textValue(candidate.unit, fallback?.unit || 'item'),
      price: finiteNumber(candidate.price, fallback?.price || 0),
      description: textValue(candidate.description, fallback?.description || ''),
    })),
  };
}

export function createDefaultCustomQuote(): CustomQuoteDraft {
  return {
    version: 1,
    items: [],
    discountPercent: 0,
    taxPercent: 0,
    notes: 'Harga dan ruang lingkup dapat disesuaikan berdasarkan kebutuhan proyek.',
  };
}

export function normalizeCustomQuote(value: unknown): CustomQuoteDraft {
  const defaults = createDefaultCustomQuote();
  const source = recordValue(value);
  const items = savedArray(source.items).map((item, index) => ({
    id: textValue(item.id, `custom-${index}`),
    unitPriceId: typeof item.unitPriceId === 'string' ? item.unitPriceId : undefined,
    description: textValue(item.description, `Item penawaran ${index + 1}`),
    quantity: finiteNumber(item.quantity, 1),
    unitPrice: finiteNumber(item.unitPrice, 0),
  }));
  return {
    version: 1,
    items,
    discountPercent: finiteNumber(source.discountPercent, defaults.discountPercent),
    taxPercent: finiteNumber(source.taxPercent, defaults.taxPercent),
    notes: textValue(source.notes, defaults.notes),
  };
}

export function calculateCustomQuote(draft: CustomQuoteDraft): CustomQuoteCalculation {
  const subtotal = draft.items.reduce(
    (total, item) => total + finiteNumber(item.quantity, 0) * finiteNumber(item.unitPrice, 0),
    0,
  );
  const discount = subtotal * (finiteNumber(draft.discountPercent, 0) / 100);
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * (finiteNumber(draft.taxPercent, 0) / 100);
  return { subtotal, discount, taxable, tax, total: taxable + tax };
}

export function calculateFee(settings: FeeCalculatorSettings): FeeCalculation {
  const livingCostTotal = settings.livingCosts.reduce((total, item) => total + finiteNumber(item.amount, 0), 0);
  const monthlyWorkHours = finiteNumber(settings.hoursPerDay, 0) * finiteNumber(settings.daysPerWeek, 0) * 4;
  const minimumHourlyRate = monthlyWorkHours > 0 ? livingCostTotal / monthlyWorkHours : 0;
  const recommendedHourlyRate = minimumHourlyRate * (1 + finiteNumber(settings.profitMarginPercent, 0) / 100);
  const retainerTotal = recommendedHourlyRate * monthlyWorkHours;
  const productionHours = settings.productionItems.reduce(
    (total, item) => total + finiteNumber(item.hoursPerItem, 0) * finiteNumber(item.quantity, 0),
    0,
  );
  const contentCount = settings.productionItems.reduce(
    (total, item) => total + finiteNumber(item.quantity, 0),
    0,
  );
  const productionTotal = productionHours * recommendedHourlyRate;
  const equivalentProductionDays = settings.hoursPerDay > 0 ? productionHours / settings.hoursPerDay : 0;
  const addOnTotal = settings.addOnItems.reduce(
    (total, item) => total + finiteNumber(item.price, 0) * finiteNumber(item.quantity, 0),
    0,
  );
  const operationalTotal = settings.operationalItems.reduce(
    (total, item) => total + finiteNumber(item.amount, 0),
    0,
  );
  const baseServiceFee = retainerTotal + productionTotal + addOnTotal;
  const baseAllInPrice = baseServiceFee + operationalTotal;
  const packages = settings.packages.map((item) => {
    const markupAmount = baseServiceFee * (finiteNumber(item.markupPercent, 0) / 100);
    const serviceFee = baseServiceFee + markupAmount;
    return {
      ...item,
      markupAmount,
      serviceFee,
      allInPrice: serviceFee + operationalTotal,
    };
  });

  return {
    livingCostTotal,
    monthlyWorkHours,
    minimumHourlyRate,
    recommendedHourlyRate,
    retainerTotal,
    productionTotal,
    productionHours,
    contentCount,
    equivalentProductionDays,
    addOnTotal,
    operationalTotal,
    baseServiceFee,
    baseAllInPrice,
    packages,
  };
}
