import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { getAuthenticatedUser } from '@/lib/clickup/users';
import { supabaseRest as supabase } from '@/lib/supabase/rest-client';
import { appRoleToClickUpRole, isSuperuserEmail, normalizeAppRole } from '@/lib/auth/app-role';
import { normalizePageAccess } from '@/lib/auth/page-access';

async function withAppRole(payload: any) {
  const baseUser = payload?.user || payload || {};
  const email = String(baseUser.email || '').trim().toLowerCase();
  let appRole = normalizeAppRole(baseUser.role);
  let isSuperuser = isSuperuserEmail(email);
  let pageAccess = normalizePageAccess(undefined);

  if (email) {
    try {
      const roleResult = await supabase
        .from('app_user_roles')
        .select('role,is_superuser,status,page_access')
        .ilike('email', email)
        .maybeSingle();

      if (!roleResult.error && roleResult.data?.status !== 'inactive') {
        appRole = normalizeAppRole(roleResult.data?.role || appRole);
        isSuperuser = isSuperuser || roleResult.data?.is_superuser === true;
        pageAccess = normalizePageAccess(roleResult.data?.page_access);
      }
    } catch {
      // The app remains usable before the role migration is applied.
    }
  }

  if (isSuperuser) appRole = 'owner';

  return {
    user: {
      ...baseUser,
      email: baseUser.email || email,
      role: appRoleToClickUpRole(appRole),
      app_role: appRole,
      is_superuser: isSuperuser,
      page_access: pageAccess,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const isMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
    if (isMock) {
      return NextResponse.json({ mock: true });
    }

    // Check session cookies for authenticated user
    const cookieUserName = req.cookies.get('clickup_user_name')?.value;
    const cookieUserEmail = req.cookies.get('clickup_user_email')?.value;
    const cookieUserRole = req.cookies.get('clickup_user_role')?.value;
    const cookieUserAvatar = req.cookies.get('clickup_user_avatar')?.value;

    if (cookieUserName) {
      const cookieUser = {
        id: req.cookies.get('clickup_user_id')?.value || '101',
        username: cookieUserName,
        email: cookieUserEmail || `${cookieUserName.toLowerCase().replace(/\s+/g, '')}@bilikstrategi.id`,
        role: cookieUserRole === 'owner' ? 1 : cookieUserRole === 'admin' ? 2 : 3,
        profilePicture: cookieUserAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(cookieUserName)}&background=24324A&color=fff`,
      };

      return NextResponse.json(await withAppRole(cookieUser));
    }

    // Default fallback to API key user
    const token = req.cookies.get('clickup_access_token')?.value || process.env.CLICKUP_API_KEY || process.env.CLICKUP_PERSONAL_TOKEN;
    const userData = await getAuthenticatedUser(token);
    return NextResponse.json(await withAppRole(userData));
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil data user dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}
