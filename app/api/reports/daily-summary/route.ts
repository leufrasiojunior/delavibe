import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import { dailySummarySchema } from "@/lib/schemas/commanda";
import { getDailySummary } from "@/lib/services/report-service";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    rateLimitPolicy: "read_authenticated",
  }, async ({ requestId }) => {
    const summary = await getDailySummary();
    return ok(dailySummarySchema.parse(summary), requestId);
  });
}
