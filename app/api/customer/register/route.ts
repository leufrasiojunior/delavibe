import { NextResponse, type NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import {
  applyCustomerSessionCookies,
  createCustomerSession,
} from "@/lib/auth/customer-session";
import {
  customerPublicSchema,
  customerRegisterInputSchema,
} from "@/lib/schemas/customer";
import { createCustomer, toCustomerPublicDto } from "@/lib/services/customer-service";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  return handleProtectedRoute(
    request,
    {
      auth: "none",
      requireJsonBody: true,
      requireOrigin: true,
      rateLimitPolicy: "customer_register",
    },
    async ({ request: currentRequest, requestId, ipAddress }) => {
      const payload = await parseJsonBody(currentRequest, customerRegisterInputSchema);

      const customerDto = await createCustomer(payload, ipAddress);
      const customerRecord = await db.customer.findUnique({ where: { id: customerDto.id } });

      if (!customerRecord) {
        throw new Error("customer_missing_after_create");
      }

      const session = await createCustomerSession(customerRecord);

      const response = ok(
        customerPublicSchema.parse(toCustomerPublicDto(customerRecord)),
        requestId,
        201,
      ) as NextResponse;

      applyCustomerSessionCookies(response, session);
      return response;
    },
  );
}
