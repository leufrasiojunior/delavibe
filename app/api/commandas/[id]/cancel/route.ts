import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import { commandaMutationResponseSchema } from "@/lib/schemas/commanda";
import { cancelCommanda } from "@/lib/services/commanda-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(request, {
    auth: "required",
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ requestId, session, ipAddress }) => {
    const { id } = await context.params;
    const result = await cancelCommanda(id, session!.user.id, ipAddress);
    return ok(commandaMutationResponseSchema.parse(result), requestId);
  });
}
