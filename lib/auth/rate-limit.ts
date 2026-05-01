import { AppError } from "@/lib/api/response";

type RateBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateBucket>();

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return;
  }

  if (bucket.count >= limit) {
    throw new AppError(
      429,
      "rate_limited",
      "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
      null,
      "Espere alguns segundos antes de repetir a operação.",
    );
  }

  bucket.count += 1;
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function getRateLimitState(key: string) {
  return buckets.get(key) ?? null;
}
