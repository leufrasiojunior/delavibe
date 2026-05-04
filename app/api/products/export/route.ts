import { NextResponse, type NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { listProducts } from "@/lib/services/product-service";
import { buildProductsCsv } from "@/lib/utils/product-export";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    rateLimitPolicy: "read_authenticated",
  }, async () => {
    const products = await listProducts();
    const csv = buildProductsCsv(products);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="produtos-com-estoque.csv"',
      },
    });
  });
}
