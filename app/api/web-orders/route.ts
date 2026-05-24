import { NextResponse, type NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { AppError, ok, parseJsonBody } from "@/lib/api/response";
import {
  applyCustomerSessionCookies,
  createCustomerSession,
} from "@/lib/auth/customer-session";
import {
  webOrderPublicCreateInputSchema,
  webOrderSchema,
} from "@/lib/schemas/web-order";
import {
  createCustomer,
  createGuestCustomer,
} from "@/lib/services/customer-service";
import { createWebOrder } from "@/lib/services/web-order-service";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  return handleProtectedRoute(
    request,
    {
      auth: "none",
      customerAuth: "optional",
      requireJsonBody: true,
      requireOrigin: true,
      rateLimitPolicy: "web_order_create",
    },
    async ({ request: currentRequest, requestId, ipAddress, customerSession }) => {
      const payload = await parseJsonBody(currentRequest, webOrderPublicCreateInputSchema, {
        maxBytes: 32 * 1024,
      });

      let customerId: string;
      let createdSessionCookies: Awaited<ReturnType<typeof createCustomerSession>> | null = null;

      if (customerSession) {
        customerId = customerSession.customer.id;
      } else if (payload.createAccount && payload.guestCustomer && payload.password) {
        const customer = await createCustomer(
          {
            name: payload.guestCustomer.name,
            email: payload.guestCustomer.email,
            phone: payload.guestCustomer.phone,
            password: payload.password,
            consentDataProcessing: true,
            consentMarketing: payload.guestCustomer.consentMarketing,
            policyVersion: payload.guestCustomer.policyVersion,
          },
          ipAddress,
        );
        customerId = customer.id;

        const record = await db.customer.findUnique({ where: { id: customer.id } });
        if (!record) {
          throw new AppError(500, "customer_missing_after_create", "Falha ao criar cliente.");
        }
        createdSessionCookies = await createCustomerSession(record);
      } else if (payload.guestCustomer) {
        const guest = await createGuestCustomer(
          {
            name: payload.guestCustomer.name,
            email: payload.guestCustomer.email,
            phone: payload.guestCustomer.phone,
            consentDataProcessing: true,
            consentMarketing: payload.guestCustomer.consentMarketing,
            policyVersion: payload.guestCustomer.policyVersion,
          },
          ipAddress,
        );
        customerId = guest.id;
      } else {
        throw new AppError(
          400,
          "missing_customer",
          "Informe seus dados de contato para finalizar o pedido.",
        );
      }

      const order = await createWebOrder(
        customerId,
        {
          items: payload.items,
          deliveryMode: payload.deliveryMode,
          address: payload.addressSnapshot,
          notes: payload.notes,
        },
        ipAddress,
      );

      const response = ok(webOrderSchema.parse(order), requestId, 201) as NextResponse;

      if (createdSessionCookies) {
        applyCustomerSessionCookies(response, createdSessionCookies);
      }

      return response;
    },
  );
}
