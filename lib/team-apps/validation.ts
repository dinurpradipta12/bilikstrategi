export type TeamAppDraft = {
  name: string;
  slug: string;
  short_name: string;
  owner_email: string;
  tagline: string;
  primary_color: string;
  accent_color: string;
};

export function normalizeTeamSlug(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function color(value: unknown, fallback: string) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toUpperCase() : fallback;
}

export function parseTeamAppDraft(input: unknown): TeamAppDraft {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const name = text(body.name, 100);
  const slug = normalizeTeamSlug(text(body.slug, 100) || name);
  const shortName = text(body.short_name, 40) || name.slice(0, 40);
  const ownerEmail = text(body.owner_email, 254).toLowerCase();
  if (name.length < 2) throw new Error('Nama tim minimal 2 karakter.');
  if (slug.length < 2) throw new Error('Slug tim minimal 2 karakter.');
  if (shortName.length < 2) throw new Error('Nama singkat minimal 2 karakter.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) throw new Error('Email Owner tidak valid.');
  return {
    name,
    slug,
    short_name: shortName,
    owner_email: ownerEmail,
    tagline: text(body.tagline, 180),
    primary_color: color(body.primary_color, '#24324A'),
    accent_color: color(body.accent_color, '#F26B5E'),
  };
}

export function parseTeamAppLink(input: unknown) {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const id = text(body.id, 36);
  const hostingProvider = text(body.hosting_provider, 32);
  const rawUrl = text(body.app_url, 500);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('ID aplikasi tidak valid.');
  }
  if (!['vercel', 'cloudflare_workers', 'other'].includes(hostingProvider)) {
    throw new Error('Pilih penyedia hosting aplikasi.');
  }
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error('Tautan aplikasi tidak valid.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Gunakan alamat HTTPS utama aplikasi, tanpa path atau parameter.');
  }
  if (!url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname)) {
    throw new Error('Gunakan domain publik aplikasi.');
  }
  return { id, hosting_provider: hostingProvider, app_url: url.origin };
}
