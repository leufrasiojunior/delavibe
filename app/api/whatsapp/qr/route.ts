import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import { getQrCode } from "@/lib/services/whatsapp-service";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    roles: ["admin"],
    rateLimitPolicy: "read_authenticated",
  }, async ({ requestId, session, ipAddress }) => {
    const result = await getQrCode(session!.user.id, ipAddress);
    return ok(result, requestId);
  });
}
