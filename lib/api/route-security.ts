import type { NextRequest, NextResponse } from "next/server";

import { AppError, handleRoute } from "@/lib/api/response";
import {
  assertRateLimit,
  type RateLimitPolicyName,
} from "@/lib/auth/rate-limit";
import {
  assertCsrfProtection,
  getOptionalSessionFromRequest,
  getSessionFromRequest,
  type AuthSession,
} from "@/lib/auth/session";
import type { Role } from "@/lib/schemas/shared";
import { getExpectedOrigin, getRequestIp, normalizeOrigin } from "@/lib/utils/http";

type RouteAuthMode = "none" | "optional" | "required";

type ProtectedRouteOptions = {
  auth?: RouteAuthMode;
  roles?: Role[];
  rateLimitPolicy?: RateLimitPolicyName;
  requireJsonBody?: boolean;
  requireMultipart?: boolean;
  requireOrigin?: boolean;
  requireCsrf?: boolean;
  rateLimitIdentifier?: string | null;
};

type ProtectedRouteContext = {
  request: NextRequest;
  requestId: string;
  ipAddress: string;
  session: AuthSession | null;
  rateLimit: Awaited<ReturnType<typeof assertRateLimit>> | null;
};

function assertJsonContentType(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";

  if (!contentType.startsWith("application/json")) {
    throw new AppError(
      400,
      "invalid_content_type",
      "O conteúdo enviado não está no formato JSON esperado.",
      null,
      "Envie a requisição com Content-Type application/json.",
    );
  }
}

function assertMultipartContentType(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";

  if (!contentType.startsWith("multipart/form-data")) {
    throw new AppError(
      400,
      "invalid_content_type",
      "O conteúdo enviado não está no formato multipart esperado.",
      null,
      "Envie a requisição com Content-Type multipart/form-data.",
    );
  }
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    throw new AppError(
      403,
      "invalid_origin",
      "A origem da requisição não pôde ser validada.",
      null,
      "Recarregue a aplicação e tente novamente.",
    );
  }

  const expectedOrigin = getExpectedOrigin(request);

  if (normalizeOrigin(origin) !== normalizeOrigin(expectedOrigin)) {
    throw new AppError(
      403,
      "invalid_origin",
      "A origem da requisição não é permitida.",
      {
        expectedOrigin,
      },
      "Abra a aplicação pelo domínio configurado e tente novamente.",
    );
  }
}

async function resolveSession(request: NextRequest, auth: RouteAuthMode, roles?: Role[]) {
  if (auth === "none") {
    return null;
  }

  if (auth === "optional") {
    return getOptionalSessionFromRequest(request, roles);
  }

  return getSessionFromRequest(request, roles);
}

export function applyRateLimitHeaders(
  response: NextResponse,
  rateLimitState: NonNullable<ProtectedRouteContext["rateLimit"]>,
) {
  response.headers.set("X-RateLimit-Limit", String(rateLimitState.limit));
  response.headers.set(
    "X-RateLimit-Remaining",
    String(Math.max(0, rateLimitState.limit - rateLimitState.count)),
  );
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(rateLimitState.resetAt.getTime() / 1000)),
  );
}

async function guardRoute(
  request: NextRequest,
  options: ProtectedRouteOptions,
): Promise<Omit<ProtectedRouteContext, "requestId">> {
  const auth = options.auth ?? "required";

  if (options.requireJsonBody && options.requireMultipart) {
    throw new AppError(
      500,
      "route_misconfigured",
      "A rota foi configurada com tipos de corpo incompatíveis.",
      null,
      "Selecione apenas um entre requireJsonBody e requireMultipart.",
    );
  }

  if (options.requireJsonBody) {
    assertJsonContentType(request);
  }

  if (options.requireMultipart) {
    assertMultipartContentType(request);
  }

  if (options.requireOrigin) {
    assertSameOrigin(request);
  }

  const session = await resolveSession(request, auth, options.roles);

  if (options.requireCsrf) {
    if (!session) {
      throw new AppError(
        401,
        "unauthorized",
        "Sua sessão expirou. Faça login novamente.",
        null,
        "Entre novamente no sistema para restaurar a sessão.",
      );
    }

    assertCsrfProtection(request, session);
  }

  const rateLimit = options.rateLimitPolicy
    ? await assertRateLimit(options.rateLimitPolicy, request, session, {
        identifier: options.rateLimitIdentifier,
      })
    : null;

  return {
    request,
    ipAddress: getRequestIp(request),
    session,
    rateLimit,
  };
}

export function handleProtectedRoute(
  request: NextRequest,
  options: ProtectedRouteOptions,
  handler: (context: ProtectedRouteContext) => Promise<NextResponse>,
) {
  return handleRoute(request, async (currentRequest, requestId) => {
    const guardedContext = await guardRoute(currentRequest, options);
    const response = await handler({
      ...guardedContext,
      requestId,
    });

    if (guardedContext.rateLimit) {
      applyRateLimitHeaders(response, guardedContext.rateLimit);
    }

    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Pragma", "no-cache");
    return response;
  });
}
