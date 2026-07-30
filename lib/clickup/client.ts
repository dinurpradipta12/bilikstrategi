import { ClickUpError, normalizeClickUpError } from './errors';
import { checkRateLimit, updateRateLimitFromHeaders, withRetry } from './rate-limit';

const CLICKUP_BASE_URL = 'https://api.clickup.com/api/v2';

export interface RequestOptions extends RequestInit {
  token?: string;
  timeoutMs?: number;
}

export async function clickUpFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
  if (isMock) {
    throw new ClickUpError('Aplikasi sedang berjalan dalam Mock Data Mode.', 200, 'MOCK_MODE');
  }

  const token = options.token || process.env.CLICKUP_PERSONAL_TOKEN;
  if (!token) {
    throw new ClickUpError('ClickUp Personal Token / Access Token belum dikonfigurasi.', 401, 'MISSING_TOKEN');
  }

  await checkRateLimit();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 12000);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: token,
    ...(options.headers as Record<string, string>),
  };

  try {
    return await withRetry(async () => {
      const response = await fetch(`${CLICKUP_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      updateRateLimitFromHeaders(response.headers);

      if (!response.ok) {
        let errorBody: { err?: string; ECODE?: string } = {};
        try {
          errorBody = await response.json();
        } catch {
          // Ignore JSON parse failure
        }
        throw new ClickUpError(
          errorBody.err || `ClickUp API Error (${response.status}: ${response.statusText})`,
          response.status,
          errorBody.ECODE
        );
      }

      const data = await response.json();
      return data as T;
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ClickUpError('Permintaan ke ClickUp API melebihi batas waktu (timeout).', 408);
    }
    throw normalizeClickUpError(error);
  } finally {
    clearTimeout(timeoutId);
  }
}
