import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import { pushStatusResponseSchema } from "@/lib/schemas/push";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(
    request,
    {
      auth: "required",
      rateLimitPolicy: "read_authenticated",
    },
    async ({ requestId, session }) => {
      const count = await db.pushSubscription.count({
        where: { userId: session!.user.id },
      });

      return ok(pushStatusResponseSchema.parse({ active: count > 0 }), requestId);
    },
  );
}
