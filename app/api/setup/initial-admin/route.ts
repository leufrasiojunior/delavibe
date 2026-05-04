import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { applySessionCookies, createUserSession } from "@/lib/auth/session";
import { initialAdminSetupInputSchema, loginResponseSchema } from "@/lib/schemas/auth";
import { createInitialAdmin } from "@/lib/services/bootstrap-service";

export async function POST(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "none",
    requireJsonBody: true,
    requireOrigin: true,
    rateLimitPolicy: "bootstrap_setup",
  }, async ({ request: currentRequest, requestId, ipAddress }) => {
    const payload = await parseJsonBody(currentRequest, initialAdminSetupInputSchema);
    const user = await createInitialAdmin(payload, ipAddress);
    const session = await createUserSession(user);
    const response = ok(
      loginResponseSchema.parse({
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        },
      }),
      requestId,
      201,
    );

    applySessionCookies(response, session);
    return response;
  });
}
