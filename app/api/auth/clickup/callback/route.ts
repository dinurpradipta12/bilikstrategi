import { NextRequest, NextResponse } from 'next/server';
import { isSuperuserEmail } from '@/lib/auth/app-role';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const queryName = searchParams.get('name');
  const queryEmail = searchParams.get('email');
  const queryRole = searchParams.get('role');
  const queryAvatar = searchParams.get('avatar');

  if (!code && !queryName) {
    return NextResponse.redirect(new URL('/login?error=no_code', req.url));
  }

  try {
    const origin = new URL(req.url).origin;
    const clientId = process.env.NEXT_PUBLIC_CLICKUP_CLIENT_ID || process.env.CLICKUP_CLIENT_ID;
    const clientSecret = process.env.CLICKUP_CLIENT_SECRET;
    const redirectUri = process.env.CLICKUP_REDIRECT_URI || `${origin}/api/auth/clickup/callback`;

    const response = NextResponse.redirect(new URL('/dashboard', req.url));

    // If queryName/email was provided in login request
    if (queryName) {
      response.cookies.set('clickup_user_name', queryName, { path: '/' });
      if (queryEmail) response.cookies.set('clickup_user_email', queryEmail, { path: '/' });
      if (queryRole || isSuperuserEmail(queryEmail)) {
        response.cookies.set('clickup_user_role', isSuperuserEmail(queryEmail) ? 'owner' : queryRole!, { path: '/' });
      }
      if (queryAvatar) response.cookies.set('clickup_user_avatar', queryAvatar, { path: '/' });
      response.cookies.set('clickup_logged_in', 'true', { path: '/' });
      return response;
    }

    if (!clientId || !clientSecret || clientId === 'dummy-client-id') {
      // Set logged in session cookie
      response.cookies.set('clickup_logged_in', 'true', { path: '/' });
      return response;
    }

    // Exchange authorization code for ClickUp access_token
    const tokenRes = await fetch('https://api.clickup.com/api/v2/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (tokenRes.ok) {
      const data = await tokenRes.json();
      const accessToken = data.access_token;

      // Fetch user profile from official ClickUp API
      const userRes = await fetch('https://api.clickup.com/api/v2/user', {
        headers: { Authorization: accessToken },
      });
      const userData = userRes.ok ? await userRes.json() : null;

      response.cookies.set('clickup_access_token', accessToken, { path: '/', httpOnly: true });
      response.cookies.set('clickup_logged_in', 'true', { path: '/' });
      if (userData?.user) {
        const username = userData.user.username;
        const email = userData.user.email;
        const role = isSuperuserEmail(email) ? 'owner' : userData.user.role === 1 ? 'owner' : userData.user.role === 2 ? 'admin' : 'member';
        const avatar = userData.user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=24324A&color=fff`;

        response.cookies.set('clickup_user_name', username, { path: '/' });
        response.cookies.set('clickup_user_email', email, { path: '/' });
        response.cookies.set('clickup_user_role', role, { path: '/' });
        response.cookies.set('clickup_user_avatar', avatar, { path: '/' });
      }
      return response;
    }

    return response;
  } catch (error) {
    console.error('[ClickUp OAuth Callback Error]', error);
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
}
