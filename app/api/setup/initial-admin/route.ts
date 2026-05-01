import type { NextRequest } from "next/server";

import { handleRoute, ok, parseJsonBody } from "@/lib/api/response";
import { applySessionCookies, createUserSession } from "@/lib/auth/session";
import { loginResponseSchema } from "@/lib/schemas/auth";
import { createInitialAdmin } from "@/lib/services/bootstrap-service";
import { getRequestIp } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  return handleRoute(request, async (currentRequest, requestId) => {
    const payload = await parseJsonBody(currentRequest);
    const user = await createInitialAdmin(payload, getRequestIp(currentRequest));
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
