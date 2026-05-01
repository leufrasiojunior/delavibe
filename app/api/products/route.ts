import type { NextRequest } from "next/server";

import { handleRoute, ok, parseJsonBody } from "@/lib/api/response";
import { assertRateLimit } from "@/lib/auth/rate-limit";
import { assertCsrfProtection, getSessionFromRequest } from "@/lib/auth/session";
import { productListSchema, productSchema } from "@/lib/schemas/product";
import { createProduct, listProducts, updateProduct } from "@/lib/services/product-service";
import { getRequestIp } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  return handleRoute(request, async (currentRequest, requestId) => {
    await getSessionFromRequest(currentRequest);
    const products = await listProducts();
    return ok(productListSchema.parse(products), requestId);
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(request, async (currentRequest, requestId) => {
    const session = await getSessionFromRequest(currentRequest, ["admin"]);
    assertCsrfProtection(currentRequest, session);
    assertRateLimit(`mutate:products:${session.user.id}`, 40, 60_000);
    const payload = await parseJsonBody(currentRequest);
    const product = await createProduct(payload, session.user.id, getRequestIp(currentRequest));
    return ok(productSchema.parse(product), requestId, 201);
  });
}

export async function PATCH(request: NextRequest) {
  return handleRoute(request, async (currentRequest, requestId) => {
    const session = await getSessionFromRequest(currentRequest, ["admin"]);
    assertCsrfProtection(currentRequest, session);
    assertRateLimit(`mutate:products:${session.user.id}`, 40, 60_000);
    const payload = await parseJsonBody(currentRequest);
    const product = await updateProduct(payload, session.user.id, getRequestIp(currentRequest));
    return ok(productSchema.parse(product), requestId);
  });
}
