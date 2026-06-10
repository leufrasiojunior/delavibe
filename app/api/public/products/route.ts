import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import { publicProductListSchema } from "@/lib/schemas/product";
import { listPublicProductsWithPromotions } from "@/lib/services/promotion-service";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(
    request,
    { auth: "none", rateLimitPolicy: "read_authenticated" },
    async ({ requestId }) => {
      const payload = await listPublicProductsWithPromotions();

      return ok(publicProductListSchema.parse(payload), requestId);
    },
  );
}
