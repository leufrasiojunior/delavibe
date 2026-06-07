import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { testMessageInputSchema } from "@/lib/schemas/whatsapp";
import { sendTestMessage } from "@/lib/services/whatsapp-service";

export async function POST(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    roles: ["admin"],
    requireJsonBody: true,
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ request: currentRequest, requestId, session, ipAddress }) => {
    const payload = await parseJsonBody(currentRequest, testMessageInputSchema);
    const result = await sendTestMessage(payload, session!.user.id, ipAddress);
    return ok(result, requestId);
  });
}
