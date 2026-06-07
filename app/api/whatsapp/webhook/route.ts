import { z } from "zod";
import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { webhookUrlSchema } from "@/lib/schemas/whatsapp";
import { setWebhook } from "@/lib/services/whatsapp-service";

const setWebhookInputSchema = z.object({
  webhookUrl: webhookUrlSchema,
});

export async function POST(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    roles: ["admin"],
    requireJsonBody: true,
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ request: currentRequest, requestId, session, ipAddress }) => {
    const { webhookUrl } = await parseJsonBody(currentRequest, setWebhookInputSchema);
    const instance = await setWebhook(webhookUrl, session!.user.id, ipAddress);
    return ok({ instance }, requestId);
  });
}
