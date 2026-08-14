import type { NextRequest, NextResponse } from 'next/server';

// A session remains active while the dashboard is used. Users who return at
// least once within this window keep their ClickUp login without re-authorizing.
export const CLICKUP_SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export const CLICKUP_SESSION_COOKIE_NAMES = [
  'clickup_logged_in',
  'clickup_access_token',
  'clickup_user_id',
  'clickup_user_name',
  'clickup_user_email',
  'clickup_user_role',
  'clickup_user_avatar',
] as const;

export type ClickUpSessionCookieName = (typeof CLICKUP_SESSION_COOKIE_NAMES)[number];

function requestUsesHttps(request: NextRequest) {
  const forwardedProtocol = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();

  if (forwardedProtocol) return forwardedProtocol === 'https';
  return request.nextUrl.protocol === 'https:';
}

function cookieOptions(request: NextRequest, name: ClickUpSessionCookieName) {
  return {
    path: '/',
    maxAge: CLICKUP_SESSION_MAX_AGE_SECONDS,
    expires: new Date(Date.now() + CLICKUP_SESSION_MAX_AGE_SECONDS * 1000),
    sameSite: 'lax' as const,
    secure: requestUsesHttps(request),
    httpOnly: name === 'clickup_access_token',
    priority: 'high' as const,
  };
}

export function setClickUpSessionCookie(
  response: NextResponse,
  request: NextRequest,
  name: ClickUpSessionCookieName,
  value: string,
) {
  response.cookies.set(name, value, cookieOptions(request, name));
}

export function refreshClickUpSessionCookies(request: NextRequest, response: NextResponse) {
  for (const name of CLICKUP_SESSION_COOKIE_NAMES) {
    const value = request.cookies.get(name)?.value;
    if (value) setClickUpSessionCookie(response, request, name, value);
  }

  return response;
}

export function clearClickUpSessionCookies(response: NextResponse, request: NextRequest) {
  for (const name of CLICKUP_SESSION_COOKIE_NAMES) {
    response.cookies.set(name, '', {
      ...cookieOptions(request, name),
      expires: new Date(0),
      maxAge: 0,
    });
  }
}
