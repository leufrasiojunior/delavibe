import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import {
  pushSubscribeResponseSchema,
  pushSubscriptionInputSchema,
  pushUnsubscribeInputSchema,
} from "@/lib/schemas/push";

export async function POST(request: NextRequest) {
  return handleProtectedRoute(
    request,
    {
      auth: "required",
      requireJsonBody: true,
      requireOrigin: true,
      requireCsrf: true,
      rateLimitPolicy: "write_authenticated",
    },
    async ({ request: currentRequest, requestId, session }) => {
      const payload = await parseJsonBody(currentRequest, pushSubscriptionInputSchema);
      const userId = session!.user.id;

      await db.pushSubscription.upsert({
        where: { endpoint: payload.endpoint },
        create: {
          userId,
          endpoint: payload.endpoint,
          p256dh: payload.keys.p256dh,
          auth: payload.keys.auth,
          userAgent: payload.userAgent ?? null,
        },
        update: {
          userId,
          p256dh: payload.keys.p256dh,
          auth: payload.keys.auth,
          userAgent: payload.userAgent ?? null,
          lastUsedAt: new Date(),
        },
      });

      return ok(pushSubscribeResponseSchema.parse({ ok: true }), requestId);
    },
  );
}

export async function DELETE(request: NextRequest) {
  return handleProtectedRoute(
    request,
    {
      auth: "required",
      requireJsonBody: true,
      requireOrigin: true,
      requireCsrf: true,
      rateLimitPolicy: "write_authenticated",
    },
    async ({ request: currentRequest, requestId, session }) => {
      const payload = await parseJsonBody(currentRequest, pushUnsubscribeInputSchema);
      const userId = session!.user.id;

      await db.pushSubscription.deleteMany({
        where: { endpoint: payload.endpoint, userId },
      });

      return ok(pushSubscribeResponseSchema.parse({ ok: true }), requestId);
    },
  );
}
