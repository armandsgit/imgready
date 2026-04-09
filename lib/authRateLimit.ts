const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 10;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, RateLimitEntry>();

function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of attempts.entries()) {
    if (entry.resetAt <= now) {
      attempts.delete(key);
    }
  }
}

export function getRequestIp(request: Request | { headers?: Headers | Record<string, string | string[] | undefined> }) {
  const headers = request.headers;

  if (!headers) {
    return 'unknown';
  }

  const getHeader = (name: string) => {
    if (headers instanceof Headers) {
      return headers.get(name) ?? '';
    }

    const value = headers[name];
    if (Array.isArray(value)) {
      return value[0] ?? '';
    }

    return value ?? '';
  };

  const forwardedFor = getHeader('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return getHeader('x-real-ip') || 'unknown';
}

export function checkAuthRateLimit(scope: string, identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase() || 'unknown';
  const key = `${scope}:${normalizedIdentifier}`;
  const now = Date.now();

  cleanupExpiredEntries(now);

  const existing = attempts.get(key);
  if (!existing || existing.resetAt <= now) {
    attempts.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  attempts.set(key, existing);

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}
