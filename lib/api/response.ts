import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { ZodError } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import { logger } from "@/lib/logger";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly hint?: string | null,
    public readonly headers?: HeadersInit,
  ) {
    super(message);
  }
}

function applyDefaultApiHeaders(response: NextResponse, requestId: string, extraHeaders?: HeadersInit) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Request-Id", requestId);

  if (extraHeaders) {
    const headers = new Headers(extraHeaders);

    for (const [key, value] of headers.entries()) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export function ok<T>(data: T, requestId: string, status = 200, headers?: HeadersInit) {
  return applyDefaultApiHeaders(
    NextResponse.json(
    {
      data,
      error: null,
      requestId,
    },
    { status },
    ),
    requestId,
    headers,
  );
}

function errorPayload(error: AppError, requestId: string) {
  return applyDefaultApiHeaders(
    NextResponse.json(
    {
      data: null,
      error: {
        code: error.code,
        message: error.message,
        hint: error.hint ?? null,
        details: error.details ?? null,
      },
      requestId,
    },
    { status: error.status, headers: error.headers },
    ),
    requestId,
    error.headers,
  );
}

function buildFieldErrorKey(path: Array<string | number>) {
  return path.reduce((key, segment) => {
    if (typeof segment === "number") {
      return `${key}[${segment + 1}]`;
    }

    return key ? `${key}.${segment}` : segment;
  }, "");
}

function buildZodDetails(error: ZodError) {
  const details = {
    formErrors: [] as string[],
    fieldErrors: {} as Record<string, string[]>,
  };

  for (const issue of error.issues) {
    if (issue.path.length === 0) {
      details.formErrors.push(issue.message);
      continue;
    }

    const key = buildFieldErrorKey(issue.path);
    const current = details.fieldErrors[key] ?? [];
    current.push(issue.message);
    details.fieldErrors[key] = current;
  }

  return details;
}

function normalizeError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError(
      400,
      "invalid_payload",
      "Os dados enviados são inválidos.",
      buildZodDetails(error),
      "Revise os campos informados e tente novamente.",
    );
  }

  return new AppError(500, "internal_error", "Ocorreu um erro inesperado.");
}

export async function handleRoute(
  request: NextRequest,
  handler: (request: NextRequest, requestId: string) => Promise<NextResponse>,
) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const route = request.nextUrl.pathname;
  const method = request.method;
  const startedAt = Date.now();

  try {
    const response = await handler(request, requestId);
    const durationMs = Date.now() - startedAt;
    const status = response.status;

    if (method === "GET") {
      logger.debug("request_completed", { requestId, route, method, status, durationMs });
    } else {
      logger.info("request_completed", { requestId, route, method, status, durationMs });
    }

    return response;
  } catch (error) {
    const normalizedError = normalizeError(error);
    const durationMs = Date.now() - startedAt;
    const context = {
      requestId,
      route,
      method,
      status: normalizedError.status,
      code: normalizedError.code,
      durationMs,
      details: normalizedError.details,
    };

    if (normalizedError.status >= 500) {
      logger.error("request_failed", { ...context, error });
    } else {
      logger.warn("request_failed", context);
    }

    return errorPayload(normalizedError, requestId);
  }
}

export async function parseJsonBody(request: NextRequest): Promise<unknown>;
export async function parseJsonBody<T>(
  request: NextRequest,
  schema: { parseAsync(data: unknown): Promise<T> },
): Promise<T>;
export async function parseJsonBody<T>(
  request: NextRequest,
  schema?: { parseAsync(data: unknown): Promise<T> },
  options?: { maxBytes?: number },
) {
  const maxBytes = options?.maxBytes ?? 16_384;
  const contentLength = Number(request.headers.get("content-length") || "0");

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new AppError(
      400,
      "payload_too_large",
      "O corpo da requisição excede o limite permitido.",
      { maxBytes },
      `Reduza o payload para no máximo ${maxBytes} bytes.`,
    );
  }

  const rawBody = await request.text().catch(() => {
    throw new AppError(
      400,
      "invalid_json",
      "Não foi possível interpretar o corpo da requisição.",
      null,
      "Verifique se o JSON enviado está bem formado.",
    );
  });

  const byteLength = Buffer.byteLength(rawBody, "utf8");

  if (byteLength > maxBytes) {
    throw new AppError(
      400,
      "payload_too_large",
      "O corpo da requisição excede o limite permitido.",
      { maxBytes },
      `Reduza o payload para no máximo ${maxBytes} bytes.`,
    );
  }

  if (rawBody.trim().length === 0) {
    throw new AppError(
      400,
      "invalid_json",
      "Não foi possível interpretar o corpo da requisição.",
      null,
      "Envie um JSON válido no corpo da requisição.",
    );
  }

  const body = (() => {
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      throw new AppError(
        400,
        "invalid_json",
        "Não foi possível interpretar o corpo da requisição.",
        null,
        "Verifique se o JSON enviado está bem formado.",
      );
    }
  })();

  if (!schema) {
    return body;
  }

  return schema.parseAsync(body);
}
