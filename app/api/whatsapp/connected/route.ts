import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import { markConnected } from "@/lib/services/whatsapp-service";

export async function POST(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    roles: ["admin"],
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ requestId, session, ipAddress }) => {
    const instance = await markConnected(session!.user.id, ipAddress);
    return ok({ instance }, requestId);
  });
}
