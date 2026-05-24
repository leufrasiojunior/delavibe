import { NextResponse, type NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import {
  applyCustomerSessionCookies,
  createCustomerSession,
} from "@/lib/auth/customer-session";
import {
  customerLoginInputSchema,
  customerPublicSchema,
} from "@/lib/schemas/customer";
import { authenticateCustomer, toCustomerPublicDto } from "@/lib/services/customer-service";

export async function POST(request: NextRequest) {
  const earlyBody = await request.clone().json().catch(() => ({}));
  const rawEmail = typeof earlyBody?.email === "string" ? earlyBody.email : null;

  return handleProtectedRoute(
    request,
    {
      auth: "none",
      requireJsonBody: true,
      requireOrigin: true,
      rateLimitPolicy: "customer_login",
      rateLimitIdentifier: rawEmail ? rawEmail.trim().toLowerCase() : null,
    },
    async ({ request: currentRequest, requestId, ipAddress }) => {
      const payload = await parseJsonBody(currentRequest, customerLoginInputSchema);
      const customer = await authenticateCustomer(payload.email, payload.password, ipAddress);
      const session = await createCustomerSession(customer);

      const response = ok(
        customerPublicSchema.parse(toCustomerPublicDto(customer)),
        requestId,
      ) as NextResponse;

      applyCustomerSessionCookies(response, session);
      return response;
    },
  );
}
