import type { NextRequest } from "next/server";

import { handleRoute, ok, parseJsonBody } from "@/lib/api/response";
import { assertRateLimit } from "@/lib/auth/rate-limit";
import { assertCsrfProtection, getSessionFromRequest } from "@/lib/auth/session";
import { stockMovementListSchema, stockMovementSchema } from "@/lib/schemas/stock";
import { createManualStockMovement, listStockMovements } from "@/lib/services/stock-service";
import { getRequestIp } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  return handleRoute(request, async (currentRequest, requestId) => {
    await getSessionFromRequest(currentRequest);
    const movements = await listStockMovements();
    return ok(stockMovementListSchema.parse(movements), requestId);
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(request, async (currentRequest, requestId) => {
    const session = await getSessionFromRequest(currentRequest, ["admin"]);
    assertCsrfProtection(currentRequest, session);
    assertRateLimit(`mutate:stock:${session.user.id}`, 60, 60_000);
    const payload = await parseJsonBody(currentRequest);
    const movement = await createManualStockMovement(payload, session.user.id, getRequestIp(currentRequest));
    return ok(stockMovementSchema.parse(movement), requestId, 201);
  });
}
