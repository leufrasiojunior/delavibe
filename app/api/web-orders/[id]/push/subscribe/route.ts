import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { handleProtectedRoute } from "@/lib/api/route-security";
import { AppError, ok, parseJsonBody } from "@/lib/api/response";
import {
  pushSubscribeResponseSchema,
  pushSubscriptionInputSchema,
  pushUnsubscribeInputSchema,
} from "@/lib/schemas/push";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function resolveOrderCustomerId(orderId: string, sessionCustomerId?: string | null) {
  const order = await db.webOrder.findUnique({
    where: { id: orderId },
    select: { customerId: true },
  });

  if (!order) {
    throw new AppError(404, "web_order_not_found", "Pedido web não encontrado.");
  }

  if (sessionCustomerId && sessionCustomerId !== order.customerId) {
    throw new AppError(
      403,
      "customer_order_mismatch",
      "Este pedido não pertence ao cliente logado.",
      null,
      "Abra o pedido pela conta correta ou saia da conta atual.",
    );
  }

  return order.customerId;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(
    request,
    {
      auth: "none",
      customerAuth: "optional",
      requireJsonBody: true,
      requireOrigin: true,
      requireCustomerCsrf: true,
      rateLimitPolicy: "public_push",
    },
    async ({ request: currentRequest, requestId, customerSession }) => {
      const { id } = await context.params;
      const payload = await parseJsonBody(currentRequest, pushSubscriptionInputSchema);
      const customerId = await resolveOrderCustomerId(id, customerSession?.customer.id);

      await db.customerPushSubscription.upsert({
        where: { endpoint: payload.endpoint },
        create: {
          customerId,
          endpoint: payload.endpoint,
          p256dh: payload.keys.p256dh,
          auth: payload.keys.auth,
          userAgent: payload.userAgent ?? null,
        },
        update: {
          customerId,
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(
    request,
    {
      auth: "none",
      customerAuth: "optional",
      requireJsonBody: true,
      requireOrigin: true,
      requireCustomerCsrf: true,
      rateLimitPolicy: "public_push",
    },
    async ({ request: currentRequest, requestId, customerSession }) => {
      const { id } = await context.params;
      const payload = await parseJsonBody(currentRequest, pushUnsubscribeInputSchema);
      const customerId = await resolveOrderCustomerId(id, customerSession?.customer.id);

      await db.customerPushSubscription.deleteMany({
        where: { endpoint: payload.endpoint, customerId },
      });

      return ok(pushSubscribeResponseSchema.parse({ ok: true }), requestId);
    },
  );
}
