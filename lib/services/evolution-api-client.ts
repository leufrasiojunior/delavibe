/**
 * Evolution API HTTP client.
 *
 * Pure functions that call the Evolution API v2.3.x endpoints for WhatsApp
 * instance management. Each function reads env vars lazily and throws
 * {@link AppError} on failures.
 *
 * Tests for this module are indirect -- exercised via the whatsapp-service
 * integration tests (T05) and route tests (T06) with fetch mocked at the
 * network layer.
 */

import { AppError } from "@/lib/api/response";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfig(): { baseUrl: string; globalApikey: string } {
  const baseUrl = process.env.EVOLUTION_API_BASE_URL;
  const globalApikey = process.env.EVOLUTION_API_GLOBAL_APIKEY;

  if (!baseUrl || !globalApikey) {
    throw new AppError(
      500,
      "evolution_api_not_configured",
      "Configuracao da Evolution API ausente (EVOLUTION_API_BASE_URL ou EVOLUTION_API_GLOBAL_APIKEY).",
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), globalApikey };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let message: string;

  try {
    const body = (await response.json()) as Record<string, unknown>;
    message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : JSON.stringify(body);
  } catch {
    try {
      message = await response.text();
    } catch {
      message = `Evolution API retornou status ${response.status}`;
    }
  }

  throw new AppError(502, "evolution_api_error", message);
}

function wrapFetchErrors(error: unknown): never {
  if (error instanceof AppError) {
    throw error;
  }

  if (
    error instanceof DOMException ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    throw new AppError(
      504,
      "evolution_api_timeout",
      "A Evolution API nao respondeu a tempo.",
    );
  }

  if (
    error instanceof Error &&
    error.name === "TimeoutError"
  ) {
    throw new AppError(
      504,
      "evolution_api_timeout",
      "A Evolution API nao respondeu a tempo.",
    );
  }

  throw new AppError(
    502,
    "evolution_api_unreachable",
    "Nao foi possivel conectar a Evolution API.",
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateInstanceOptions {
  instanceName: string;
  token?: string;
  /**
   * Optional webhook configuration sent inline in the create body.
   * When present, the Evolution API configures the webhook atomically with
   * the instance creation — no need for a separate POST /webhook/set call.
   */
  webhook?: {
    url: string;
    events: string[];
  };
}

export interface CreateInstanceResult {
  instanceId: string;
  hash: string;
  /**
   * QR code base64 returned by the create endpoint (Evolution starts the
   * session immediately when `qrcode: true`). Null if the response did not
   * include one — caller should fall back to GET /instance/connect.
   */
  qrCodeBase64: string | null;
}

export interface SendTextMessageOptions {
  number: string;
  text: string;
  delay: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new WhatsApp instance on the Evolution API.
 *
 * Uses the global apikey for authentication.
 *
 * @returns instanceId and hash (the per-instance apikey).
 */
export async function createInstance(
  opts: CreateInstanceOptions,
): Promise<CreateInstanceResult> {
  const { baseUrl, globalApikey } = getConfig();

  const body: Record<string, unknown> = {
    instanceName: opts.instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    // Defaults da instancia (Postman /instance/create -- settings opcionais)
    rejectCall: true,
    groupsIgnore: true,
    readMessages: true,
  };

  if (opts.token) {
    body.token = opts.token;
  }

  if (opts.webhook) {
    body.webhook = {
      enabled: true,
      url: opts.webhook.url,
      byEvents: false,
      base64: false,
      events: opts.webhook.events,
    };
  }

  try {
    const response = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: globalApikey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    const data = await handleResponse<Record<string, unknown>>(response);

    const instance = data.instance as Record<string, unknown> | undefined;
    const instanceId =
      (instance?.instanceId as string | undefined) ??
      (data.instanceId as string | undefined) ??
      "";
    const hash = (data.hash as string | undefined) ?? "";

    const qrcode = data.qrcode as Record<string, unknown> | undefined;
    const qrCodeBase64 =
      (qrcode?.base64 as string | undefined) ??
      (data.base64 as string | undefined) ??
      null;

    return { instanceId, hash, qrCodeBase64 };
  } catch (error) {
    return wrapFetchErrors(error);
  }
}

/**
 * Delete an existing WhatsApp instance from the Evolution API.
 *
 * Uses the global apikey for authentication.
 */
export async function deleteInstance(instanceName: string): Promise<void> {
  const { baseUrl, globalApikey } = getConfig();

  try {
    const response = await fetch(
      `${baseUrl}/instance/delete/${encodeURIComponent(instanceName)}`,
      {
        method: "DELETE",
        headers: {
          apikey: globalApikey,
        },
        signal: AbortSignal.timeout(20_000),
      },
    );

    await handleResponse<unknown>(response);
  } catch (error) {
    wrapFetchErrors(error);
  }
}

/**
 * Configure the webhook for an instance.
 *
 * Uses the per-instance apikey for authentication.
 */
export async function setWebhook(
  instanceName: string,
  instanceApikey: string,
  webhookUrl: string,
): Promise<void> {
  const { baseUrl } = getConfig();

  try {
    const response = await fetch(
      `${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: instanceApikey,
        },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: ["MESSAGES_UPSERT"],
          },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );

    await handleResponse<unknown>(response);
  } catch (error) {
    wrapFetchErrors(error);
  }
}

/**
 * Get the QR code for connecting the WhatsApp instance.
 *
 * Uses the per-instance apikey for authentication.
 *
 * @returns An object with the `base64` field containing the QR image.
 */
export async function getQrCode(
  instanceName: string,
  instanceApikey: string,
): Promise<{ base64: string }> {
  const { baseUrl } = getConfig();

  try {
    const response = await fetch(
      `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`,
      {
        method: "GET",
        headers: {
          apikey: instanceApikey,
        },
        signal: AbortSignal.timeout(20_000),
      },
    );

    const data = await handleResponse<Record<string, unknown>>(response);
    const base64 = (data.base64 as string | undefined) ?? "";

    return { base64 };
  } catch (error) {
    return wrapFetchErrors(error);
  }
}

/**
 * Send a text message via the WhatsApp instance.
 *
 * Uses the per-instance apikey for authentication.
 */
export async function sendTextMessage(
  instanceName: string,
  instanceApikey: string,
  opts: SendTextMessageOptions,
): Promise<void> {
  const { baseUrl } = getConfig();

  try {
    const response = await fetch(
      `${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: instanceApikey,
        },
        body: JSON.stringify({
          number: opts.number,
          text: opts.text,
          delay: opts.delay,
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );

    await handleResponse<unknown>(response);
  } catch (error) {
    wrapFetchErrors(error);
  }
}
