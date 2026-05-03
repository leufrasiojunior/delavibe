import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import { clearSessionCookies, destroySessionFromRequest } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/services/audit-service";

export async function POST(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "auth_logout",
  }, async ({ request: currentRequest, requestId, session, ipAddress }) => {
    await destroySessionFromRequest(currentRequest);

    await logAuditEvent({
      actorUserId: session!.user.id,
      action: "logout",
      entityType: "session",
      ipAddress,
    });

    const response = ok({ success: true }, requestId);
    clearSessionCookies(response);
    return response;
  });
}
