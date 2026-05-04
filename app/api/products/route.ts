import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { productListSchema, productSchema } from "@/lib/schemas/product";
import { createProduct, listProducts, updateProduct } from "@/lib/services/product-service";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    rateLimitPolicy: "read_authenticated",
  }, async ({ requestId }) => {
    const products = await listProducts();
    return ok(productListSchema.parse(products), requestId);
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
    const product = await createProduct(payload, session!.user.id, ipAddress);
    return ok(productSchema.parse(product), requestId, 201);
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
    const product = await updateProduct(payload, session!.user.id, ipAddress);
    return ok(productSchema.parse(product), requestId);
  });
}
