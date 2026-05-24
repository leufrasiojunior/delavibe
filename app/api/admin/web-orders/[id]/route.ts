import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import { webOrderSchema } from "@/lib/schemas/web-order";
import { getWebOrderWithAccessLog } from "@/lib/services/web-order-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(
    request,
    {
      auth: "required",
      rateLimitPolicy: "read_authenticated",
    },
    async ({ requestId, session, ipAddress }) => {
      const { id } = await context.params;
      const order = await getWebOrderWithAccessLog(id, session!.user.id, ipAddress);
      return ok(webOrderSchema.parse(order), requestId);
    },
  );
}
