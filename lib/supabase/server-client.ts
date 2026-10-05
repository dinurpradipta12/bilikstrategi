import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabasePublicConfig } from '@/lib/supabase/config';

type PendingCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

/**
 * Creates a request-scoped Supabase SSR client. Route handlers must call
 * applyAuthCookies() on their final response so token refreshes are persisted.
 */
export function createSupabaseServerClient(request: NextRequest) {
  const pendingCookies = new Map<string, PendingCookie>();
  const { url, anonKey } = getSupabasePublicConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          pendingCookies.set(cookie.name, {
            name: cookie.name,
            value: cookie.value,
            options: cookie.options,
          });
        }
      },
    },
  });

  function applyAuthCookies<T extends NextResponse>(response: T) {
    for (const cookie of pendingCookies.values()) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return response;
  }

  return { supabase, applyAuthCookies };
}
