import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { AppError, ok } from "@/lib/api/response";
import { publicProductSchema } from "@/lib/schemas/product";
import { listPublicProductsWithPromotions } from "@/lib/services/promotion-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(
    request,
    { auth: "none", rateLimitPolicy: "read_authenticated" },
    async ({ requestId }) => {
      const { id } = await context.params;
      const [product] = await listPublicProductsWithPromotions({ id });

      if (!product) {
        throw new AppError(404, "product_not_found", "Produto não encontrado.");
      }

      return ok(publicProductSchema.parse(product), requestId);
    },
  );
}
