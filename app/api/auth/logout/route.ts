import type { NextRequest } from "next/server";

import { handleRoute, ok } from "@/lib/api/response";
import { assertCsrfProtection, clearSessionCookies, destroySessionFromRequest, getSessionFromRequest } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/services/audit-service";
import { getRequestIp } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  return handleRoute(request, async (currentRequest, requestId) => {
    const session = await getSessionFromRequest(currentRequest);
    assertCsrfProtection(currentRequest, session);

    await destroySessionFromRequest(currentRequest);

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "logout",
      entityType: "session",
      ipAddress: getRequestIp(currentRequest),
    });

    const response = ok({ success: true }, requestId);
    clearSessionCookies(response);
    return response;
  });
}
