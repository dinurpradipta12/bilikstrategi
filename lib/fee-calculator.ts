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

export type FeeCalculatorSettings = {
  version: 1;
  livingCosts: LivingCostItem[];
  hoursPerDay: number;
  daysPerWeek: number;
  profitMarginPercent: number;
  productionItems: ProductionItem[];
  addOnItems: AddOnItem[];
  operationalItems: OperationalItem[];
  packages: FeePackageSetting[];
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

export const FEE_CALCULATOR_STORAGE_KEY = 'bilik_fee_calculator_v1';

const DEFAULT_FEE_SETTINGS: FeeCalculatorSettings = {
  version: 1,
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
};

function finiteNumber(value: unknown, fallback: number) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
}

function textValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function mergeItems<T extends { id: string }>(
  defaults: T[],
  value: unknown,
  merge: (defaultItem: T, savedItem: Record<string, unknown>) => T,
) {
  const savedItems = Array.isArray(value) ? value : [];
  return defaults.map((defaultItem) => {
    const savedItem = savedItems.find(
      (candidate) => candidate && typeof candidate === 'object' && (candidate as Record<string, unknown>).id === defaultItem.id,
    );
    return savedItem && typeof savedItem === 'object'
      ? merge(defaultItem, savedItem as Record<string, unknown>)
      : { ...defaultItem };
  });
}

export function createDefaultFeeSettings(): FeeCalculatorSettings {
  return {
    ...DEFAULT_FEE_SETTINGS,
    livingCosts: DEFAULT_FEE_SETTINGS.livingCosts.map((item) => ({ ...item })),
    productionItems: DEFAULT_FEE_SETTINGS.productionItems.map((item) => ({ ...item })),
    addOnItems: DEFAULT_FEE_SETTINGS.addOnItems.map((item) => ({ ...item })),
    operationalItems: DEFAULT_FEE_SETTINGS.operationalItems.map((item) => ({ ...item })),
    packages: DEFAULT_FEE_SETTINGS.packages.map((item) => ({ ...item })),
  };
}

export function normalizeFeeSettings(value: unknown): FeeCalculatorSettings {
  const defaults = createDefaultFeeSettings();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const saved = value as Record<string, unknown>;

  return {
    version: 1,
    hoursPerDay: finiteNumber(saved.hoursPerDay, defaults.hoursPerDay),
    daysPerWeek: finiteNumber(saved.daysPerWeek, defaults.daysPerWeek),
    profitMarginPercent: finiteNumber(saved.profitMarginPercent, defaults.profitMarginPercent),
    livingCosts: mergeItems(defaults.livingCosts, saved.livingCosts, (item, candidate) => ({
      ...item,
      amount: finiteNumber(candidate.amount, item.amount),
    })),
    productionItems: mergeItems(defaults.productionItems, saved.productionItems, (item, candidate) => ({
      ...item,
      hoursPerItem: finiteNumber(candidate.hoursPerItem, item.hoursPerItem),
      quantity: finiteNumber(candidate.quantity, item.quantity),
    })),
    addOnItems: mergeItems(defaults.addOnItems, saved.addOnItems, (item, candidate) => ({
      ...item,
      price: finiteNumber(candidate.price, item.price),
      quantity: finiteNumber(candidate.quantity, item.quantity),
    })),
    operationalItems: mergeItems(defaults.operationalItems, saved.operationalItems, (item, candidate) => ({
      ...item,
      amount: finiteNumber(candidate.amount, item.amount),
    })),
    packages: mergeItems(defaults.packages, saved.packages, (item, candidate) => ({
      ...item,
      name: textValue(candidate.name, item.name),
      markupPercent: finiteNumber(candidate.markupPercent, item.markupPercent),
    })),
  };
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
