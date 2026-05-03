import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { commandaMutationResponseSchema } from "@/lib/schemas/commanda";
import { addItemToCommanda } from "@/lib/services/commanda-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(request, {
    auth: "required",
    requireJsonBody: true,
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ request: currentRequest, requestId, session, ipAddress }) => {
    const payload = await parseJsonBody(currentRequest);
    const { id } = await context.params;
    const result = await addItemToCommanda(id, payload, session!.user.id, ipAddress);
    return ok(commandaMutationResponseSchema.parse(result), requestId);
  });
}
