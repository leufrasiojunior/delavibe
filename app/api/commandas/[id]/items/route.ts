import type { NextRequest } from "next/server";

import { handleRoute, ok, parseJsonBody } from "@/lib/api/response";
import { assertRateLimit } from "@/lib/auth/rate-limit";
import { assertCsrfProtection, getSessionFromRequest } from "@/lib/auth/session";
import { commandaMutationResponseSchema } from "@/lib/schemas/commanda";
import { addItemToCommanda } from "@/lib/services/commanda-service";
import { getRequestIp } from "@/lib/utils/http";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  return handleRoute(request, async (currentRequest, requestId) => {
    const session = await getSessionFromRequest(currentRequest);
    assertCsrfProtection(currentRequest, session);
    assertRateLimit(`mutate:commandas:${session.user.id}`, 120, 60_000);
    const payload = await parseJsonBody(currentRequest);
    const { id } = await context.params;
    const result = await addItemToCommanda(id, payload, session.user.id, getRequestIp(currentRequest));
    return ok(commandaMutationResponseSchema.parse(result), requestId);
  });
}
