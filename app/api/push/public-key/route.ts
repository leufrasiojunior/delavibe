import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { AppError, ok } from "@/lib/api/response";
import { pushPublicKeyResponseSchema } from "@/lib/schemas/push";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(
    request,
    {
      auth: "none",
      rateLimitPolicy: "public_push",
    },
    async ({ requestId }) => {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new AppError(
          503,
          "vapid_not_configured",
          "Notificacoes push nao estao configuradas neste ambiente.",
        );
      }

      return ok(pushPublicKeyResponseSchema.parse({ publicKey }), requestId);
    },
  );
}
