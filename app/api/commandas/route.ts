import type { NextRequest } from "next/server";

import { handleRoute, ok, parseJsonBody } from "@/lib/api/response";
import { assertRateLimit } from "@/lib/auth/rate-limit";
import { assertCsrfProtection, getSessionFromRequest } from "@/lib/auth/session";
import { commandaListSchema, commandaListStatusSchema, commandaSchema } from "@/lib/schemas/commanda";
import { createCommanda, listCommandas } from "@/lib/services/commanda-service";
import { getRequestIp } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  return handleRoute(request, async (currentRequest, requestId) => {
    await getSessionFromRequest(currentRequest);
    const statusParam = currentRequest.nextUrl.searchParams.get("status");
    const query = currentRequest.nextUrl.searchParams.get("q");
    const parsedStatus = commandaListStatusSchema.safeParse(statusParam);
    const commandas = await listCommandas({
      status: parsedStatus.success ? parsedStatus.data : "open",
      query,
    });
    return ok(commandaListSchema.parse(commandas), requestId);
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(request, async (currentRequest, requestId) => {
    const session = await getSessionFromRequest(currentRequest);
    assertCsrfProtection(currentRequest, session);
    assertRateLimit(`mutate:commandas:${session.user.id}`, 120, 60_000);
    const payload = await parseJsonBody(currentRequest);
    const commanda = await createCommanda(payload, session.user.id, getRequestIp(currentRequest));
    return ok(commandaSchema.parse(commanda), requestId, 201);
  });
}
