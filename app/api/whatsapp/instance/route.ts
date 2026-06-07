import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { createInstanceInputSchema } from "@/lib/schemas/whatsapp";
import {
  createInstance,
  deleteInstance,
  getInstance,
} from "@/lib/services/whatsapp-service";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    roles: ["admin"],
    rateLimitPolicy: "read_authenticated",
  }, async ({ requestId }) => {
    const instance = await getInstance();
    return ok({ instance }, requestId);
  });
}

export async function POST(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    roles: ["admin"],
    requireJsonBody: true,
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ request: currentRequest, requestId, session, ipAddress }) => {
    const payload = await parseJsonBody(currentRequest, createInstanceInputSchema);
    const result = await createInstance(
      { webhookUrl: payload.webhookUrl },
      session!.user.id,
      ipAddress,
    );
    return ok(
      { instance: result.instance, qrCodeBase64: result.qrCodeBase64 },
      requestId,
      201,
    );
  });
}

export async function DELETE(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    roles: ["admin"],
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ requestId, session, ipAddress }) => {
    await deleteInstance(session!.user.id, ipAddress);
    return ok({ success: true }, requestId);
  });
}
