import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { ok } from "@/lib/api/response";
import {
  WEB_ORDER_ACTIVE_STATUS_LIST,
  WEB_ORDER_HISTORY_STATUS_LIST,
  webOrderListQuerySchema,
  webOrderListResponseSchema,
} from "@/lib/schemas/web-order";
import { listWebOrders } from "@/lib/services/web-order-service";

export async function GET(request: NextRequest) {
  return handleProtectedRoute(
    request,
    {
      auth: "required",
      rateLimitPolicy: "read_authenticated",
    },
    async ({ request: currentRequest, requestId }) => {
      const url = new URL(currentRequest.url);
      const rawQuery = {
        tab: url.searchParams.get("tab") ?? undefined,
        status: url.searchParams.getAll("status"),
        query: url.searchParams.get("query") ?? undefined,
        take: url.searchParams.get("take") ?? undefined,
        skip: url.searchParams.get("skip") ?? undefined,
      };

      const parsed = webOrderListQuerySchema.parse(rawQuery);
      const statusFilter =
        parsed.status?.length
          ? parsed.status
          : parsed.tab === "active"
            ? WEB_ORDER_ACTIVE_STATUS_LIST
            : WEB_ORDER_HISTORY_STATUS_LIST;

      const result = await listWebOrders({
        status: statusFilter,
        query: parsed.query ?? null,
        take: parsed.take,
        skip: parsed.skip,
      });

      return ok(webOrderListResponseSchema.parse(result), requestId);
    },
  );
}
