import { NextRequest, NextResponse } from 'next/server';
import { getServerWorkspaceContext } from '@/lib/auth/server-workspace-context';
import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';
import type { ContentIndicator } from '@/lib/content-ideas/types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CONTENT_INDICATORS: ContentIndicator[] = ['is_brand_relevant', 'is_applied'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return NextResponse.json(data, { ...init, headers });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function cleanUuid(value: unknown, label: string) {
  const id = cleanText(value, 80);
  if (!UUID_PATTERN.test(id)) throw new RequestError(`${label} tidak valid.`);
  return id;
}

function normalizeContentUrl(value: unknown) {
  const raw = cleanText(value, 2000);
  if (!raw) throw new RequestError('Link konten wajib diisi.');
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
      throw new Error('unsupported protocol');
    }
    return parsed.toString();
  } catch {
    throw new RequestError('Link konten harus berupa alamat web yang valid.');
  }
}

async function adminJson(path: string, init: RequestInit = {}) {
  const response = await supabaseAdminFetch(path, init);
  const text = await response.text();
  let parsed: unknown = null;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const detail = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
    const message = typeof parsed === 'string'
      ? parsed
      : cleanText(detail.message || detail.error_description || detail.hint, 2000) || `Supabase REST error ${response.status}`;
    throw new Error(String(message));
  }

  return parsed;
}

function firstRow(value: unknown) {
  return Array.isArray(value) ? value[0] || null : value;
}

function storageUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /app_content_(references|ideas)|schema cache|relation .* does not exist|service_role/i.test(message);
}

async function findReference(referenceId: string, workspaceId: string) {
  const rows = await adminJson(
    `app_content_references?select=id&id=eq.${encodeURIComponent(referenceId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&limit=1`
  );
  return firstRow(rows);
}

export async function GET(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.email) {
    return json({ error: 'Sesi pengguna tidak memiliki identitas email.' }, { status: 401 });
  }
  if (!context.isActive) {
    return json({ error: 'Akun Anda sedang tidak aktif.' }, { status: 403 });
  }

  const viewer = { email: context.identity.email, name: context.identity.name };
  if (!isSupabaseAdminConfigured()) {
    return json({
      storage_ready: false,
      viewer,
      references: [],
      ideas: [],
      error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.',
    });
  }

  try {
    const workspace = encodeURIComponent(context.workspaceId);
    const [references, ideas] = await Promise.all([
      adminJson(`app_content_references?select=*&workspace_id=eq.${workspace}&order=updated_at.desc&limit=1000`),
      adminJson(`app_content_ideas?select=*&workspace_id=eq.${workspace}&order=updated_at.desc&limit=1000`),
    ]);

    return json({
      storage_ready: true,
      viewer,
      references: Array.isArray(references) ? references : [],
      ideas: Array.isArray(ideas) ? ideas : [],
    });
  } catch (error) {
    if (storageUnavailable(error)) {
      return json({
        storage_ready: false,
        viewer,
        references: [],
        ideas: [],
        error: 'Migration Content Idea Bank belum dijalankan.',
      });
    }
    return json({ error: error instanceof Error ? error.message : 'Gagal memuat Content Idea Bank.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.email) {
    return json({ error: 'Sesi pengguna tidak memiliki identitas email.' }, { status: 401 });
  }
  if (!context.isActive) {
    return json({ error: 'Akun Anda sedang tidak aktif.' }, { status: 403 });
  }
  if (!isSupabaseAdminConfigured()) {
    return json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server.' }, { status: 503 });
  }

  try {
    const parsedBody: unknown = await req.json().catch(() => ({}));
    const body = parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)
      ? parsedBody as Record<string, unknown>
      : {};
    const action = cleanText(body.action, 80);
    const now = new Date().toISOString();
    const workspace = encodeURIComponent(context.workspaceId);

    if (action === 'create_reference' || action === 'update_reference') {
      const platform = cleanText(body.platform, 80);
      const pillar = cleanText(body.pillar, 120);
      if (!platform) throw new RequestError('Platform wajib dipilih.');
      if (!pillar) throw new RequestError('Pillar wajib diisi.');

      const payload = {
        platform,
        pillar,
        content_url: normalizeContentUrl(body.content_url),
        description: cleanText(body.description, 5000),
        insight: cleanText(body.insight, 5000),
        is_brand_relevant: body.is_brand_relevant === true,
        is_applied: body.is_applied === true,
        updated_at: now,
      };

      if (action === 'create_reference') {
        const saved = await adminJson('app_content_references', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            ...payload,
            workspace_id: context.workspaceId,
            created_by_email: context.identity.email,
            created_by_name: context.identity.name,
            created_at: now,
          }),
        });
        return json({ success: true, reference: firstRow(saved) });
      }

      const id = cleanUuid(body.id, 'ID referensi');
      const saved = await adminJson(
        `app_content_references?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(payload),
        }
      );
      const reference = firstRow(saved);
      if (!reference) throw new RequestError('Referensi konten tidak ditemukan.', 404);
      return json({ success: true, reference });
    }

    if (action === 'create_idea' || action === 'update_idea') {
      const headline = cleanText(body.headline, 300);
      const pillar = cleanText(body.pillar, 120);
      if (!headline) throw new RequestError('Headline ide konten wajib diisi.');
      if (!pillar) throw new RequestError('Pillar wajib diisi.');

      const referenceId = body.reference_id ? cleanUuid(body.reference_id, 'ID referensi') : null;
      if (referenceId && !(await findReference(referenceId, context.workspaceId))) {
        throw new RequestError('Referensi yang dipilih tidak ditemukan di workspace ini.', 404);
      }

      const payload = {
        headline,
        pillar,
        reference_id: referenceId,
        notes: cleanText(body.notes, 5000),
        is_brand_relevant: body.is_brand_relevant === true,
        is_applied: body.is_applied === true,
        updated_at: now,
      };

      if (action === 'create_idea') {
        const saved = await adminJson('app_content_ideas', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            ...payload,
            workspace_id: context.workspaceId,
            created_by_email: context.identity.email,
            created_by_name: context.identity.name,
            created_at: now,
          }),
        });
        return json({ success: true, idea: firstRow(saved) });
      }

      const id = cleanUuid(body.id, 'ID ide');
      const saved = await adminJson(
        `app_content_ideas?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(payload),
        }
      );
      const idea = firstRow(saved);
      if (!idea) throw new RequestError('Ide konten tidak ditemukan.', 404);
      return json({ success: true, idea });
    }

    if (action === 'set_indicator') {
      const entityType = body.entity_type === 'reference' ? 'reference' : body.entity_type === 'idea' ? 'idea' : '';
      if (!entityType) throw new RequestError('Jenis data indikator tidak valid.');
      const indicator = typeof body.indicator === 'string' && CONTENT_INDICATORS.some((item) => item === body.indicator)
        ? body.indicator as ContentIndicator
        : null;
      if (!indicator) throw new RequestError('Indikator tidak valid.');
      const id = cleanUuid(body.id, 'ID data');
      const table = entityType === 'reference' ? 'app_content_references' : 'app_content_ideas';
      const saved = await adminJson(
        `${table}?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ [indicator]: body.value === true, updated_at: now }),
        }
      );
      const item = firstRow(saved);
      if (!item) throw new RequestError('Data yang akan diperbarui tidak ditemukan.', 404);
      return json({ success: true, item });
    }

    if (action === 'delete_reference' || action === 'delete_idea') {
      const id = cleanUuid(body.id, action === 'delete_reference' ? 'ID referensi' : 'ID ide');
      const table = action === 'delete_reference' ? 'app_content_references' : 'app_content_ideas';
      const deleted = await adminJson(
        `${table}?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}`,
        { method: 'DELETE', headers: { Prefer: 'return=representation' } }
      );
      if (!firstRow(deleted)) throw new RequestError('Data yang akan dihapus tidak ditemukan.', 404);
      return json({ success: true });
    }

    throw new RequestError('Aksi Content Idea Bank tidak dikenali.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memproses Content Idea Bank.';
    const status = error instanceof RequestError
      ? error.status
      : storageUnavailable(error)
        ? 503
        : 500;
    return json({ error: message }, { status });
  }
}
