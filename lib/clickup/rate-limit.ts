import { ClickUpError } from './errors';

interface RateLimitTracker {
  remaining: number;
  resetAt: number;
}

const tracker: RateLimitTracker = {
  remaining: 100,
  resetAt: Date.now() + 60000,
};

export function updateRateLimitFromHeaders(headers: Headers): void {
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');

  if (remaining !== null) {
    tracker.remaining = parseInt(remaining, 10);
  }
  if (reset !== null) {
    tracker.resetAt = parseInt(reset, 10) * 1000;
  }
}

export async function checkRateLimit(): Promise<void> {
  if (tracker.remaining <= 1 && Date.now() < tracker.resetAt) {
    const delay = Math.max(100, tracker.resetAt - Date.now());
    console.warn(`[ClickUp RateLimit] Pausing for ${delay}ms due to rate limit threshold.`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 2,
  backoffMs: number = 500
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ClickUpError && (error.isRateLimit || error.status >= 500) && retries > 0) {
      console.warn(`[ClickUp Retry] Retrying request after ${backoffMs}ms... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return withRetry(fn, retries - 1, backoffMs * 2);
    }
    throw error;
  }
}
