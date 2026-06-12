import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { promotionListQuerySchema, promotionListSchema, promotionSchema } from "@/lib/schemas/promotion";
import { createPromotion, listPromotions, updatePromotion } from "@/lib/services/promotion-service";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    rateLimitPolicy: "read_authenticated",
  }, async ({ requestId }) => {
    const parsed = promotionListQuerySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
    });
    const promotions = await listPromotions(parsed.q);
    return ok(promotionListSchema.parse(promotions), requestId);
  });
}

export async function POST(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    roles: ["admin"],
    requireJsonBody: true,
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ request: currentRequest, requestId, session, ipAddress }) => {
    const payload = await parseJsonBody(currentRequest);
    const promotion = await createPromotion(payload, session!.user.id, ipAddress);
    return ok(promotionSchema.parse(promotion), requestId, 201);
  });
}

export async function PATCH(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    roles: ["admin"],
    requireJsonBody: true,
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ request: currentRequest, requestId, session, ipAddress }) => {
    const payload = await parseJsonBody(currentRequest);
    const promotion = await updatePromotion(payload, session!.user.id, ipAddress);
    return ok(promotionSchema.parse(promotion), requestId);
  });
}
