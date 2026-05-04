import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { getRequestIp } from "@/lib/utils/http";

type SessionLike = {
  user: {
    id: string;
  };
} | null | undefined;

type RateLimitBucketState = {
  count: number;
  limit: number;
  windowMs: number;
  resetAt: Date;
};

type MemoryBucket = {
  count: number;
  limit: number;
  windowMs: number;
  resetAt: number;
};

type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

export type RateLimitPolicyName =
  | "auth_login"
  | "bootstrap_setup"
  | "auth_logout"
  | "read_authenticated"
  | "write_authenticated";

const policies: Record<RateLimitPolicyName, RateLimitPolicy> = {
  auth_login: {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  },
  bootstrap_setup: {
    limit: 5,
    windowMs: 30 * 60 * 1000,
  },
  auth_logout: {
    limit: 30,
    windowMs: 60 * 1000,
  },
  read_authenticated: {
    limit: 300,
    windowMs: 60 * 1000,
  },
  write_authenticated: {
    limit: 180,
    windowMs: 60 * 1000,
  },
};

const memoryBuckets = new Map<string, MemoryBucket>();
let cleanupScheduledAt = 0;

function shouldUseMemoryDriver() {
  return process.env.RATE_LIMIT_DRIVER === "memory" || process.execArgv.includes("--test");
}

function buildRateLimitError(resetAt: Date) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

  return new AppError(
    429,
    "rate_limited",
    "Muitas tentativas. Aguarde alguns instantes e tente novamente.",
    {
      retryAfterSeconds,
      resetAt: resetAt.toISOString(),
    },
    "Espere alguns segundos antes de repetir a operação.",
    {
      "Retry-After": String(retryAfterSeconds),
    },
  );
}

function getRateLimitPolicy(policyName: RateLimitPolicyName) {
  return policies[policyName];
}

export function buildRateLimitKey(
  policyName: RateLimitPolicyName,
  request: NextRequest,
  session?: SessionLike,
  options?: {
    identifier?: string | null;
  },
) {
  const ipAddress = getRequestIp(request);
  const route = request.nextUrl.pathname;

  switch (policyName) {
    case "auth_login":
      return `${policyName}:${options?.identifier || "anonymous"}:${ipAddress}`;
    case "bootstrap_setup":
      return `${policyName}:${ipAddress}`;
    case "auth_logout":
      return `${policyName}:${session?.user.id || "anonymous"}:${ipAddress}`;
    case "read_authenticated":
    case "write_authenticated":
      return `${policyName}:${session?.user.id || "anonymous"}:${ipAddress}:${route}`;
  }
}

function toState(count: number, limit: number, windowMs: number, resetAt: Date): RateLimitBucketState {
  return {
    count,
    limit,
    windowMs,
    resetAt,
  };
}

function maybeCleanupMemoryBuckets() {
  const now = Date.now();

  if (cleanupScheduledAt > now - 60_000) {
    return;
  }

  cleanupScheduledAt = now;

  for (const [key, value] of memoryBuckets.entries()) {
    if (value.resetAt <= now) {
      memoryBuckets.delete(key);
    }
  }
}

function assertMemoryRateLimit(key: string, policy: RateLimitPolicy) {
  maybeCleanupMemoryBuckets();

  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = new Date(now + policy.windowMs);
    memoryBuckets.set(key, {
      count: 1,
      limit: policy.limit,
      windowMs: policy.windowMs,
      resetAt: resetAt.getTime(),
    });
    return toState(1, policy.limit, policy.windowMs, resetAt);
  }

  if (bucket.count >= policy.limit) {
    throw buildRateLimitError(new Date(bucket.resetAt));
  }

  bucket.count += 1;

  return toState(bucket.count, bucket.limit, bucket.windowMs, new Date(bucket.resetAt));
}

async function withSerializableRetry<T>(operation: () => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("unreachable");
}

function maybeCleanupDatabaseBuckets() {
  const now = Date.now();

  if (cleanupScheduledAt > now - 60_000) {
    return;
  }

  cleanupScheduledAt = now;

  void db.rateLimitBucket.deleteMany({
    where: {
      resetAt: {
        lt: new Date(),
      },
    },
  }).catch(() => null);
}

async function assertDatabaseRateLimit(key: string, policy: RateLimitPolicy) {
  maybeCleanupDatabaseBuckets();

  return withSerializableRetry(() =>
    db.$transaction(
      async (tx) => {
        const now = new Date();
        const bucket = await tx.rateLimitBucket.findUnique({
          where: { key },
        });

        if (!bucket || bucket.resetAt <= now) {
          const resetAt = new Date(now.getTime() + policy.windowMs);
          const nextBucket = bucket
            ? await tx.rateLimitBucket.update({
                where: { key },
                data: {
                  count: 1,
                  limit: policy.limit,
                  windowMs: policy.windowMs,
                  resetAt,
                },
              })
            : await tx.rateLimitBucket.create({
                data: {
                  key,
                  count: 1,
                  limit: policy.limit,
                  windowMs: policy.windowMs,
                  resetAt,
                },
              });

          return toState(nextBucket.count, nextBucket.limit, nextBucket.windowMs, nextBucket.resetAt);
        }

        if (bucket.count >= policy.limit) {
          throw buildRateLimitError(bucket.resetAt);
        }

        const updatedBucket = await tx.rateLimitBucket.update({
          where: { key },
          data: {
            count: {
              increment: 1,
            },
            limit: policy.limit,
            windowMs: policy.windowMs,
          },
        });

        return toState(updatedBucket.count, updatedBucket.limit, updatedBucket.windowMs, updatedBucket.resetAt);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export async function assertRateLimit(
  policyName: RateLimitPolicyName,
  request: NextRequest,
  session?: SessionLike,
  options?: {
    identifier?: string | null;
  },
) {
  const policy = getRateLimitPolicy(policyName);
  const key = buildRateLimitKey(policyName, request, session, options);

  if (shouldUseMemoryDriver()) {
    return assertMemoryRateLimit(key, policy);
  }

  return assertDatabaseRateLimit(key, policy);
}

export async function resetRateLimit(key: string) {
  memoryBuckets.delete(key);

  if (!shouldUseMemoryDriver()) {
    await db.rateLimitBucket.delete({
      where: { key },
    }).catch(() => null);
  }
}

export async function getRateLimitState(key: string) {
  const memoryBucket = memoryBuckets.get(key);

  if (memoryBucket) {
    return toState(
      memoryBucket.count,
      memoryBucket.limit,
      memoryBucket.windowMs,
      new Date(memoryBucket.resetAt),
    );
  }

  if (shouldUseMemoryDriver()) {
    return null;
  }

  const bucket = await db.rateLimitBucket.findUnique({
    where: { key },
  });

  if (!bucket) {
    return null;
  }

  return toState(bucket.count, bucket.limit, bucket.windowMs, bucket.resetAt);
}
