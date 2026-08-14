import { NextRequest, NextResponse } from 'next/server';
import { isSuperuserEmail, normalizeIdentityEmail } from '@/lib/auth/app-role';
import { setClickUpSessionCookie } from '@/lib/auth/clickup-session';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const queryName = searchParams.get('name');
  const queryEmail = searchParams.get('email');
  const queryRole = searchParams.get('role');
  const queryAvatar = searchParams.get('avatar');
  const normalizedQueryEmail = normalizeIdentityEmail(queryEmail);

  if (!code && !queryName) {
    return NextResponse.redirect(new URL('/login?error=no_code', req.url));
  }

  try {
    const clientId = process.env.NEXT_PUBLIC_CLICKUP_CLIENT_ID || process.env.CLICKUP_CLIENT_ID;
    const clientSecret = process.env.CLICKUP_CLIENT_SECRET;

    const response = NextResponse.redirect(new URL('/dashboard', req.url));

    // If queryName/email was provided in login request
    if (queryName) {
      setClickUpSessionCookie(response, req, 'clickup_user_name', queryName);
      if (normalizedQueryEmail) {
        setClickUpSessionCookie(response, req, 'clickup_user_email', normalizedQueryEmail);
      }
      if (queryRole || isSuperuserEmail(normalizedQueryEmail)) {
        setClickUpSessionCookie(
          response,
          req,
          'clickup_user_role',
          isSuperuserEmail(normalizedQueryEmail) ? 'owner' : queryRole!,
        );
      }
      if (queryAvatar) setClickUpSessionCookie(response, req, 'clickup_user_avatar', queryAvatar);
      setClickUpSessionCookie(response, req, 'clickup_logged_in', 'true');
      return response;
    }

    if (!clientId || !clientSecret || clientId === 'dummy-client-id') {
      // Set logged in session cookie
      setClickUpSessionCookie(response, req, 'clickup_logged_in', 'true');
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

      setClickUpSessionCookie(response, req, 'clickup_access_token', accessToken);
      setClickUpSessionCookie(response, req, 'clickup_logged_in', 'true');
      if (userData?.user) {
        const userId = String(userData.user.id || '');
        const username = userData.user.username;
        const email = normalizeIdentityEmail(userData.user.email);
        const role = isSuperuserEmail(email) ? 'owner' : userData.user.role === 1 ? 'owner' : userData.user.role === 2 ? 'admin' : 'member';
        const avatar = userData.user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=24324A&color=fff`;

        if (userId) setClickUpSessionCookie(response, req, 'clickup_user_id', userId);
        setClickUpSessionCookie(response, req, 'clickup_user_name', username);
        setClickUpSessionCookie(response, req, 'clickup_user_email', email);
        setClickUpSessionCookie(response, req, 'clickup_user_role', role);
        setClickUpSessionCookie(response, req, 'clickup_user_avatar', avatar);
      }
      return response;
    }

    return response;
  } catch (error) {
    console.error('[ClickUp OAuth Callback Error]', error);
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
}
