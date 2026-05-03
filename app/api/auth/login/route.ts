import type { NextRequest } from "next/server";

import { handleProtectedRoute, applyRateLimitHeaders } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { assertRateLimit, buildRateLimitKey, resetRateLimit } from "@/lib/auth/rate-limit";
import { applySessionCookies } from "@/lib/auth/session";
import { loginInputSchema, loginResponseSchema } from "@/lib/schemas/auth";
import { loginUser } from "@/lib/services/auth-service";

export async function POST(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "none",
    requireJsonBody: true,
    requireOrigin: true,
  }, async ({ request: currentRequest, requestId, ipAddress }) => {
    const payload = await parseJsonBody(currentRequest, loginInputSchema);
    const rateLimit = await assertRateLimit("auth_login", currentRequest, null, {
      identifier: payload.username,
    });
    const result = await loginUser(payload, ipAddress);
    const response = ok(loginResponseSchema.parse({ user: result.user }), requestId);

    await resetRateLimit(
      buildRateLimitKey("auth_login", currentRequest, null, {
        identifier: payload.username,
      }),
    );
    applySessionCookies(response, result.session);
    applyRateLimitHeaders(response, rateLimit);
    return response;
  });
}
