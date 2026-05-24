import { NextResponse, type NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import {
  clearCustomerSessionCookies,
  destroyCustomerSessionFromRequest,
} from "@/lib/auth/customer-session";

export async function POST(request: NextRequest) {
  return handleProtectedRoute(
    request,
    {
      auth: "none",
      customerAuth: "optional",
      requireOrigin: true,
      requireCustomerCsrf: true,
      rateLimitPolicy: "auth_logout",
    },
    async ({ request: currentRequest, requestId }) => {
      await destroyCustomerSessionFromRequest(currentRequest);

      const response = ok({ ok: true }, requestId) as NextResponse;
      clearCustomerSessionCookies(response);
      return response;
    },
  );
}
