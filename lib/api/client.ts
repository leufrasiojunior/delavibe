"use client";

import { z } from "zod";

import { errorEnvelopeSchema, successEnvelopeSchema } from "@/lib/schemas/api";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

function getCsrfToken() {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
  const cookieNames = [
    process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME,
    "__Host-pdv_csrf",
    "pdv_csrf",
  ].filter((value): value is string => Boolean(value));

  for (const cookieName of cookieNames) {
    for (const cookie of cookies) {
      if (cookie.startsWith(`${cookieName}=`)) {
        return decodeURIComponent(cookie.split("=")[1] || "");
      }
    }
  }

  return null;
}

function extractFirstErrorDetail(details: unknown) {
  if (!details || typeof details !== "object") {
    return null;
  }

  const detailsRecord = details as {
    formErrors?: unknown;
    fieldErrors?: unknown;
  };

  if (Array.isArray(detailsRecord.formErrors) && typeof detailsRecord.formErrors[0] === "string") {
    return detailsRecord.formErrors[0];
  }

  if (detailsRecord.fieldErrors && typeof detailsRecord.fieldErrors === "object") {
    for (const value of Object.values(detailsRecord.fieldErrors as Record<string, unknown>)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }
    }
  }

  return null;
}

function buildErrorMessage(error: z.infer<typeof errorEnvelopeSchema>["error"]) {
  const detailMessage = extractFirstErrorDetail(error.details);

  return [error.message, detailMessage, error.hint ? `Dica: ${error.hint}` : null]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

export async function apiFetch<TSchema extends z.ZodTypeAny>(
  input: RequestInfo | URL,
  init: RequestInit,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const headers = new Headers(init.headers || {});
  const method = (init.method || "GET").toUpperCase();

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (["POST", "PATCH", "DELETE", "PUT"].includes(method)) {
    const csrfToken = getCsrfToken();

    if (csrfToken) {
      headers.set("x-csrf-token", csrfToken);
    }
  }

  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });

  const parsedJson = await response
    .json()
    .catch(() => ({ data: null, error: { code: "invalid_json", message: "Resposta inválida do servidor." } }));

  if (!response.ok) {
    const parsedError = errorEnvelopeSchema.safeParse(parsedJson);

    if (parsedError.success) {
      throw new ApiClientError(
        buildErrorMessage(parsedError.data.error),
        parsedError.data.error.code,
        parsedError.data.error.details,
      );
    }

    throw new ApiClientError("Recebemos uma resposta inválida do servidor.");
  }

  const parsed = successEnvelopeSchema(schema).safeParse(parsedJson);

  if (!parsed.success) {
    throw new ApiClientError("O servidor respondeu fora do contrato esperado.");
  }

  return parsed.data.data;
}
