import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', req.url));
  
  // Clear all session cookies
  response.cookies.delete('clickup_logged_in');
  response.cookies.delete('clickup_access_token');
  response.cookies.delete('clickup_user_name');
  response.cookies.delete('clickup_user_email');
  response.cookies.delete('clickup_user_role');
  response.cookies.delete('clickup_user_avatar');

  return response;
}
