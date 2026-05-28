import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import {
  webOrderSchema,
  webOrderStatusTransitionSchema,
} from "@/lib/schemas/web-order";
import { updateWebOrderStatus } from "@/lib/services/web-order-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(
    request,
    {
      auth: "required",
      requireJsonBody: true,
      requireOrigin: true,
      requireCsrf: true,
      rateLimitPolicy: "write_authenticated",
    },
    async ({ request: currentRequest, requestId, session, ipAddress }) => {
      const { id } = await context.params;
      const payload = await parseJsonBody(currentRequest, webOrderStatusTransitionSchema);

      const order = await updateWebOrderStatus(
        id,
        payload.toStatus,
        session!.user.id,
        ipAddress,
        payload.notes ?? null,
        payload.payments ?? null,
      );

      return ok(webOrderSchema.parse(order), requestId);
    },
  );
}
