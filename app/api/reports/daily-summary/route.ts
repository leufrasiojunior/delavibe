import type { NextRequest } from "next/server";

import { handleRoute, ok } from "@/lib/api/response";
import { getSessionFromRequest } from "@/lib/auth/session";
import { dailySummarySchema } from "@/lib/schemas/commanda";
import { getDailySummary } from "@/lib/services/report-service";

export async function GET(request: NextRequest) {
  return handleRoute(request, async (currentRequest, requestId) => {
    await getSessionFromRequest(currentRequest);
    const summary = await getDailySummary();
    return ok(dailySummarySchema.parse(summary), requestId);
  });
}
