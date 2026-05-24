import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { AppError, ok } from "@/lib/api/response";
import { db } from "@/lib/db";
import { publicProductSchema } from "@/lib/schemas/product";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(
    request,
    { auth: "none", rateLimitPolicy: "read_authenticated" },
    async ({ requestId }) => {
      const { id } = await context.params;
      const product = await db.product.findFirst({
        where: { id, isActive: true },
      });

      if (!product) {
        throw new AppError(404, "product_not_found", "Produto não encontrado.");
      }

      return ok(
        publicProductSchema.parse({
          id: product.id,
          name: product.name,
          category: product.category,
          imagePath: product.imagePath,
          unit: product.unit,
          priceCents: product.priceCents,
          stockQty: product.stockQty,
          minimumStock: product.minimumStock,
          isActive: product.isActive,
          updatedAt: product.updatedAt.toISOString(),
        }),
        requestId,
      );
    },
  );
}
