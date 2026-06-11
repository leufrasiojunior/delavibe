import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok, parseJsonBody } from "@/lib/api/response";
import { appSettingsSchema } from "@/lib/schemas/app-settings";
import { getAppSettings, updateAppSettings } from "@/lib/services/app-settings-service";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(
    request,
    {
      auth: "required",
      roles: ["admin"],
      rateLimitPolicy: "read_authenticated",
    },
    async ({ requestId }) => {
      const settings = await getAppSettings();
      return ok(appSettingsSchema.parse(settings), requestId);
    },
  );
}

export async function PATCH(request: NextRequest) {
  return handleProtectedRoute(
    request,
    {
      auth: "required",
      roles: ["admin"],
      requireJsonBody: true,
      requireOrigin: true,
      requireCsrf: true,
      rateLimitPolicy: "write_authenticated",
    },
    async ({ request: currentRequest, requestId, session, ipAddress }) => {
      const payload = await parseJsonBody(currentRequest);
      const settings = await updateAppSettings(payload, session!.user.id, ipAddress);
      return ok(appSettingsSchema.parse(settings), requestId);
    },
  );
}
