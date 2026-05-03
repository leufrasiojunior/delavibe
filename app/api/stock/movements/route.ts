import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { stockMovementListSchema, stockMovementSchema } from "@/lib/schemas/stock";
import { createManualStockMovement, listStockMovements } from "@/lib/services/stock-service";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    rateLimitPolicy: "read_authenticated",
  }, async ({ requestId }) => {
    const movements = await listStockMovements();
    return ok(stockMovementListSchema.parse(movements), requestId);
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
    const movement = await createManualStockMovement(payload, session!.user.id, ipAddress);
    return ok(stockMovementSchema.parse(movement), requestId, 201);
  });
}
