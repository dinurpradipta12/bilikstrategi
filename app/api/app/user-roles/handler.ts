import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/clickup/users';
import {
  isSuperuserEmail,
  normalizeAppRole,
  normalizeIdentityEmail,
  type AppRole,
} from '@/lib/auth/app-role';
import { supabaseRest } from '@/lib/supabase/rest-client';
import {
  isSupabaseAdminConfigured,
  supabaseAdminFetch,
} from '@/lib/supabase/admin-rest-client';
import { normalizePageAccess } from '@/lib/auth/page-access';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RequestIdentity = {
  email: string;
  name: string;
};

function decodeCookie(value: string | undefined) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeEmail(value: unknown) {
  return normalizeIdentityEmail(value);
}

async function getRequestIdentity(req: NextRequest): Promise<RequestIdentity> {
  // The application session is authoritative. A ClickUp access token can be
  // for a different member account while the user is managing app roles.
  const cookieEmail = normalizeEmail(decodeCookie(req.cookies.get('clickup_user_email')?.value));
  const cookieName = decodeCookie(req.cookies.get('clickup_user_name')?.value);
  if (cookieEmail) {
    return { email: cookieEmail, name: cookieName || cookieEmail.split('@')[0] };
  }

  const accessToken = req.cookies.get('clickup_access_token')?.value;
  if (accessToken) {
    try {
      const authenticated = await getAuthenticatedUser(accessToken);
      const user = authenticated?.user || {};
      const email = normalizeEmail(user.email);
      if (email) {
        return { email, name: String(user.username || email.split('@')[0]) };
      }
    } catch {
      // Fall back to the existing app session when the ClickUp token has expired.
    }
  }

  return { email: '', name: cookieName || 'Pengguna' };
}

async function getStoredRole(email: string) {
  if (!email) return null;
  const result = await supabaseRest
    .from('app_user_roles')
    .select('email,display_name,role,is_superuser,status')
    .ilike('email', email)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data;
}

async function requireRoleManager(req: NextRequest) {
  const identity = await getRequestIdentity(req);
  if (!identity.email) {
    return { identity, allowed: false };
  }

  if (isSuperuserEmail(identity.email)) {
    return { identity, allowed: true, appRole: 'owner' as AppRole };
  }

  const storedRole = await getStoredRole(identity.email);
  const appRole = normalizeAppRole(storedRole?.role);
  const allowed = storedRole?.status !== 'inactive' && (appRole === 'owner' || appRole === 'admin');
  return { identity, allowed, appRole };
}

function errorResponse(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : String(error || fallback);
  return NextResponse.json({ error: message || fallback }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const manager = await requireRoleManager(req);
    if (!manager.allowed) {
      return NextResponse.json({ error: 'Hanya Owner atau Admin Workspace yang dapat membaca role pengguna.' }, { status: 403 });
    }

    const result = await supabaseRest
      .from('app_user_roles')
      .select('email,display_name,role,is_superuser,status,page_access,updated_at')
      .order('display_name', { ascending: true });

    if (result.error) throw result.error;
    return NextResponse.json(
      { roles: Array.isArray(result.data) ? result.data : [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil role pengguna. Pastikan migration app_user_roles sudah dijalankan.');
  }
}

export async function PUT(req: NextRequest) {
  try {
    const manager = await requireRoleManager(req);
    if (!manager.allowed) {
      return NextResponse.json({ error: 'Hanya Owner atau Admin Workspace yang dapat mengubah role pengguna.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const displayName = String(body.display_name || body.name || email.split('@')[0] || 'Pengguna').trim();
    if (!email) {
      return NextResponse.json({ error: 'Email pengguna wajib diisi agar role dapat disimpan.' }, { status: 400 });
    }

    if (isSuperuserEmail(email)) {
      return NextResponse.json({ error: 'Akun superuser utama tidak dapat diturunkan dari Owner.' }, { status: 403 });
    }

    const requestedRole = normalizeAppRole(body.role);
    const role = body.is_admin === false || requestedRole === 'member' ? 'member' : requestedRole === 'admin' ? 'admin' : null;
    if (!role) {
      return NextResponse.json({ error: 'Role yang dapat diatur dari menu ini hanya Admin atau Member.' }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server.' },
        { status: 503 }
      );
    }

    const existingResponse = await supabaseAdminFetch(
      `app_user_roles?select=is_superuser,status,page_access&email=eq.${encodeURIComponent(email)}`
    );
    if (!existingResponse.ok) {
      return errorResponse(await existingResponse.text(), 'Gagal membaca role pengguna.', 502);
    }
    const existingRows = await existingResponse.json().catch(() => []);
    if (Array.isArray(existingRows) && existingRows[0]?.is_superuser === true) {
      return NextResponse.json({ error: 'Akun superuser utama tidak dapat diubah dari menu ini.' }, { status: 403 });
    }

    const existingPageAccess = Array.isArray(existingRows) ? existingRows[0]?.page_access : undefined;
    const pageAccess = normalizePageAccess(body.page_access ?? existingPageAccess);

    const upsertResponse = await supabaseAdminFetch('app_user_roles?on_conflict=email', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        email,
        display_name: displayName,
        role,
        is_superuser: false,
        status: 'active',
        page_access: pageAccess,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!upsertResponse.ok) {
      return errorResponse(await upsertResponse.text(), 'Gagal menyimpan role ke Supabase.', 502);
    }

    const savedRows = await upsertResponse.json().catch(() => []);
    const savedRole = Array.isArray(savedRows) ? savedRows[0] : savedRows;
    return NextResponse.json({
      success: true,
      role: savedRole || { email, display_name: displayName, role, page_access: pageAccess },
    });
  } catch (error) {
    return errorResponse(error, 'Gagal menyimpan role pengguna. Pastikan migration app_user_roles sudah dijalankan.');
  }
}
