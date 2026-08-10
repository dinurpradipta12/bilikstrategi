import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/clickup/users';
import { isSuperuserEmail, normalizeIdentityEmail } from '@/lib/auth/app-role';
import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WORKSPACE_ID = 'bilik-strategi';
const OWNER_EMAIL = 'snllabsarchive@gmail.com';

type RequestIdentity = { email: string; name: string };

function decodeCookie(value: string | undefined) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : value == null ? fallback : String(value).trim();
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function monthKey(value: unknown) {
  const candidate = text(value);
  return /^\d{4}-\d{2}$/.test(candidate) ? `${candidate}-01` : `${new Date().toISOString().slice(0, 7)}-01`;
}

function optionalDate(value: unknown) {
  const candidate = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

function cleanLongText(value: unknown, fallback = '', maxLength = 500) {
  return text(value, fallback).slice(0, maxLength);
}

function cleanImage(value: unknown, fallback = '/landscape.png') {
  const candidate = text(value, fallback);
  if (candidate.length > 3_000_000) throw new Error('Logo terlalu besar. Kompres atau gunakan gambar di bawah 2 MB.');
  if (candidate.startsWith('data:image/') || candidate.startsWith('/') || /^https?:\/\//i.test(candidate)) return candidate;
  return fallback;
}

function cleanLineItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 30)
    .map((item, index) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        id: cleanLongText(row.id, `line-${index}-${crypto.randomUUID()}`, 80),
        label: cleanLongText(row.label || row.description, '', 140),
        amount: Math.max(0, number(row.amount)),
      };
    })
    .filter((item) => item.label || item.amount > 0);
}

async function getRequestIdentity(req: NextRequest): Promise<RequestIdentity> {
  const cookieEmail = normalizeIdentityEmail(decodeCookie(req.cookies.get('clickup_user_email')?.value));
  const cookieName = decodeCookie(req.cookies.get('clickup_user_name')?.value);
  if (cookieEmail) return { email: cookieEmail, name: cookieName || cookieEmail.split('@')[0] };

  const accessToken = req.cookies.get('clickup_access_token')?.value;
  if (accessToken) {
    try {
      const authenticated = await getAuthenticatedUser(accessToken);
      const user = authenticated?.user || {};
      const email = normalizeIdentityEmail(user.email);
      if (email) return { email, name: text(user.username, email.split('@')[0]) };
    } catch {
      // Fall through to the cookie identity when ClickUp has expired.
    }
  }

  return { email: '', name: cookieName || 'Pengguna' };
}

async function requireOwner(req: NextRequest) {
  const identity = await getRequestIdentity(req);
  return { identity, allowed: isSuperuserEmail(identity.email) && identity.email === OWNER_EMAIL };
}

function errorResponse(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : text(error, fallback);
  return NextResponse.json({ error: message || fallback }, { status });
}

async function readRows(path: string) {
  const response = await supabaseAdminFetch(path);
  if (!response.ok) throw new Error((await response.text()) || `Supabase REST error ${response.status}`);
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function writeRow(path: string, body: Record<string, unknown>) {
  const response = await supabaseAdminFetch(path, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.text()) || `Supabase REST error ${response.status}`);
  return response.json().catch(() => []);
}

export async function GET(req: NextRequest) {
  try {
    const owner = await requireOwner(req);
    if (!owner.allowed) return NextResponse.json({ error: 'Halaman ini hanya dapat dibuka oleh Owner utama workspace.' }, { status: 403 });
    if (!isSupabaseAdminConfigured()) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server.' }, { status: 503 });

    const month = encodeURIComponent(monthKey(new URL(req.url).searchParams.get('month')));
    const workspace = encodeURIComponent(WORKSPACE_ID);
    const [branding, slips] = await Promise.all([
      readRows(`app_owner_salary_slip_branding?workspace_id=eq.${workspace}&select=*`),
      readRows(`app_owner_salary_slips?workspace_id=eq.${workspace}&month_key=eq.${month}&order=display_name.asc&select=*`),
    ]);

    return NextResponse.json({
      workspaceId: WORKSPACE_ID,
      branding: branding[0] || {
        workspace_id: WORKSPACE_ID,
        company_name: 'Bilik Strategi',
        company_address: '',
        company_email: 'hello@bilikstrategi.com',
        company_phone: '',
        logo_url: '/landscape.png',
        footer_text: 'Slip gaji ini bersifat rahasia dan hanya ditujukan untuk penerima yang tercantum.',
        currency: 'IDR',
      },
      slips,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil data slip gaji. Jalankan migration owner salary slips terlebih dahulu.', 503);
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = await requireOwner(req);
    if (!owner.allowed) return NextResponse.json({ error: 'Hanya Owner utama yang dapat mengubah slip gaji.' }, { status: 403 });
    if (!isSupabaseAdminConfigured()) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server.' }, { status: 503 });

    const body = await req.json().catch(() => ({}));
    const action = text(body.action);
    const now = new Date().toISOString();
    const workspace = encodeURIComponent(WORKSPACE_ID);

    if (action === 'save_branding') {
      const payload = {
        workspace_id: WORKSPACE_ID,
        company_name: cleanLongText(body.company_name, 'Bilik Strategi', 160),
        company_address: cleanLongText(body.company_address, '', 500),
        company_email: cleanLongText(body.company_email, '', 160),
        company_phone: cleanLongText(body.company_phone, '', 80),
        logo_url: cleanImage(body.logo_url),
        footer_text: cleanLongText(body.footer_text, '', 500),
        currency: cleanLongText(body.currency, 'IDR', 8),
        created_by_email: owner.identity.email,
        updated_at: now,
      };
      const saved = await writeRow('app_owner_salary_slip_branding?on_conflict=workspace_id', payload);
      return NextResponse.json({ success: true, branding: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === 'save_slip') {
      const userEmail = normalizeIdentityEmail(body.user_email);
      if (!userEmail) return NextResponse.json({ error: 'Email anggota wajib diisi.' }, { status: 400 });
      const month = monthKey(body.month);
      const overtimeHours = Math.max(0, number(body.overtime_hours));
      const overtimeRate = Math.max(0, number(body.overtime_rate));
      const payload = {
        workspace_id: WORKSPACE_ID,
        month_key: month,
        user_email: userEmail,
        display_name: cleanLongText(body.display_name, userEmail.split('@')[0], 160),
        employee_role: cleanLongText(body.employee_role, '', 160),
        department: cleanLongText(body.department, '', 160),
        slip_number: cleanLongText(body.slip_number, `SLIP/${month.slice(0, 7).replace('-', '')}/${userEmail.split('@')[0].replace(/[^a-z0-9]+/gi, '').toUpperCase()}`, 80),
        base_salary: Math.max(0, number(body.base_salary)),
        attendance_days: Math.max(0, number(body.attendance_days)),
        worked_hours: Math.max(0, number(body.worked_hours)),
        overtime_hours: overtimeHours,
        overtime_rate: overtimeRate,
        allowances: cleanLineItems(body.allowances),
        deductions: cleanLineItems(body.deductions),
        status: new Set(['draft', 'issued', 'paid']).has(text(body.status)) ? text(body.status) : 'draft',
        payment_date: optionalDate(body.payment_date),
        notes: cleanLongText(body.notes, '', 1000),
        created_by_email: owner.identity.email,
        updated_at: now,
      };
      const saved = await writeRow(`app_owner_salary_slips?on_conflict=workspace_id,month_key,user_email`, payload);
      return NextResponse.json({ success: true, slip: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === 'delete_slip') {
      const id = text(body.id);
      if (!id) return NextResponse.json({ error: 'ID slip gaji wajib diisi.' }, { status: 400 });
      const response = await supabaseAdminFetch(`app_owner_salary_slips?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${workspace}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.text());
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Aksi slip gaji tidak dikenali.' }, { status: 400 });
  } catch (error) {
    return errorResponse(error, 'Gagal menyimpan slip gaji.', 500);
  }
}
