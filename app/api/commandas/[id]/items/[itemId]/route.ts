import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { commandaMutationResponseSchema } from "@/lib/schemas/commanda";
import { removeItemFromCommanda, updateCommandaItemQuantity } from "@/lib/services/commanda-service";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(request, {
    auth: "required",
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ requestId, session, ipAddress }) => {
    const { id, itemId } = await context.params;
    const result = await removeItemFromCommanda(id, itemId, session!.user.id, ipAddress);
    return ok(commandaMutationResponseSchema.parse(result), requestId);
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(request, {
    auth: "required",
    requireJsonBody: true,
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ request: currentRequest, requestId, session, ipAddress }) => {
    const payload = await parseJsonBody(currentRequest);
    const { id, itemId } = await context.params;
    const result = await updateCommandaItemQuantity(id, itemId, payload, session!.user.id, ipAddress);
    return ok(commandaMutationResponseSchema.parse(result), requestId);
  });
}
