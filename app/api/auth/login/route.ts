import type { NextRequest } from "next/server";

import { handleRoute, ok, parseJsonBody } from "@/lib/api/response";
import { applySessionCookies } from "@/lib/auth/session";
import { loginResponseSchema } from "@/lib/schemas/auth";
import { loginUser } from "@/lib/services/auth-service";
import { getRequestIp } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  return handleRoute(request, async (currentRequest, requestId) => {
    const payload = await parseJsonBody(currentRequest);
    const result = await loginUser(payload, getRequestIp(currentRequest));
    const response = ok(loginResponseSchema.parse({ user: result.user }), requestId);

    applySessionCookies(response, result.session);
    return response;
  });
}
