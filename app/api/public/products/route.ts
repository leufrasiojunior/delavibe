import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import { db } from "@/lib/db";
import { publicProductListSchema } from "@/lib/schemas/product";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(
    request,
    { auth: "none", rateLimitPolicy: "read_authenticated" },
    async ({ requestId }) => {
      const products = await db.product.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });

      const payload = products.map((product) => ({
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
      }));

      return ok(publicProductListSchema.parse(payload), requestId);
    },
  );
}
