import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import { customerPublicSchema } from "@/lib/schemas/customer";
import { getCustomerById } from "@/lib/services/customer-service";
import { AppError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(
    request,
    {
      auth: "none",
      customerAuth: "required",
      rateLimitPolicy: "read_authenticated",
    },
    async ({ requestId, customerSession }) => {
      const customer = await getCustomerById(customerSession!.customer.id);

      if (!customer) {
        throw new AppError(404, "customer_not_found", "Cliente não encontrado.");
      }

      return ok(customerPublicSchema.parse(customer), requestId);
    },
  );
}
