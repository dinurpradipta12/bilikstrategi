import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
import { getAuthenticatedUser } from '@/lib/clickup/users';

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
      return NextResponse.json({
        user: {
          id: req.cookies.get('clickup_user_id')?.value || '101',
          username: cookieUserName,
          email: cookieUserEmail || `${cookieUserName.toLowerCase().replace(/\s+/g, '')}@bilikstrategi.id`,
          role: cookieUserRole === 'owner' ? 1 : cookieUserRole === 'admin' ? 2 : 3,
          profilePicture: cookieUserAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(cookieUserName)}&background=24324A&color=fff`,
        },
      });
    }

    // Default fallback to API key user
    const token = req.cookies.get('clickup_access_token')?.value || process.env.CLICKUP_API_KEY || process.env.CLICKUP_PERSONAL_TOKEN;
    const userData = await getAuthenticatedUser(token);
    return NextResponse.json(userData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil data user dari ClickUp' },
      { status: error.status || 500 }
    );
  }
}
