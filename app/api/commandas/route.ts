import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { commandaListQuerySchema, commandaListSchema, commandaSchema } from "@/lib/schemas/commanda";
import { createCommanda, listCommandas } from "@/lib/services/commanda-service";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    rateLimitPolicy: "read_authenticated",
  }, async ({ request: currentRequest, requestId }) => {
    const query = commandaListQuerySchema.parse({
      status: currentRequest.nextUrl.searchParams.get("status") ?? undefined,
      q: currentRequest.nextUrl.searchParams.get("q") ?? undefined,
    });
    const commandas = await listCommandas({
      status: query.status,
      query: query.q,
    });
    return ok(commandaListSchema.parse(commandas), requestId);
  });
}

export async function POST(request: NextRequest) {
  return handleProtectedRoute(request, {
    auth: "required",
    requireJsonBody: true,
    requireOrigin: true,
    requireCsrf: true,
    rateLimitPolicy: "write_authenticated",
  }, async ({ request: currentRequest, requestId, session, ipAddress }) => {
    const payload = await parseJsonBody(currentRequest);
    const commanda = await createCommanda(payload, session!.user.id, ipAddress);
    return ok(commandaSchema.parse(commanda), requestId, 201);
  });
}
