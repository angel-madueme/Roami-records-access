import { AI_CONFIG } from "@/lib/ai-config";

export interface JobRateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, WindowEntry>();

function checkFixedWindow(
  key: string,
  limit: number,
  windowMs: number
): JobRateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count < limit) {
    entry.count += 1;
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterMs: entry.windowStart + windowMs - now,
  };
}

/** Upload/extraction trigger: 5 requests per user per 10 minutes. */
export function checkUploadRateLimit(userId: string): JobRateLimitResult {
  return checkFixedWindow(
    `itinerary-upload:${userId}`,
    AI_CONFIG.rateLimits.upload.maxRequests,
    AI_CONFIG.rateLimits.upload.windowMs
  );
}

/** Expand action: 10 requests per user per 10 minutes. */
export function checkExpandRateLimit(userId: string): JobRateLimitResult {
  return checkFixedWindow(
    `itinerary-expand:${userId}`,
    AI_CONFIG.rateLimits.expand.maxRequests,
    AI_CONFIG.rateLimits.expand.windowMs
  );
}
