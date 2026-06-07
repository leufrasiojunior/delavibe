/**
 * WhatsApp service -- business orchestration layer.
 *
 * Coordinates Prisma persistence, AES-256-GCM crypto helper (T02),
 * Evolution API client (T03), and AuditLog for all WhatsApp instance
 * operations.
 *
 * Singleton pattern: at most one WhatsappInstance row exists (instanceName = "delavibe").
 */

import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { logAuditEvent } from "@/lib/services/audit-service";
import {
  assertEncryptionKeyAvailable,
  encryptApiKey,
  decryptApiKey,
} from "@/lib/utils/crypto";
import * as evolutionClient from "@/lib/services/evolution-api-client";
import type { WhatsappInstanceDto } from "@/lib/schemas/whatsapp";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INSTANCE_NAME = "delavibe";
const ENTITY_TYPE = "whatsapp_instance";
const TEST_MESSAGE_TEXT = "Teste de conexao Dela's Vibe PDV";
const WEBHOOK_EVENTS: string[] = ["MESSAGES_UPSERT"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDto(
  row: {
    id: string;
    instanceName: string;
    instanceId: string;
    webhookUrl: string | null;
    createdAt: Date;
    lastConnectedAt: Date | null;
  },
): WhatsappInstanceDto {
  return {
    id: row.id,
    instanceName: row.instanceName,
    instanceId: row.instanceId,
    webhookUrl: row.webhookUrl,
    createdAt: row.createdAt.toISOString(),
    lastConnectedAt: row.lastConnectedAt?.toISOString() ?? null,
  };
}

async function findInstanceOrThrow() {
  const instance = await db.whatsappInstance.findFirst();

  if (!instance) {
    throw new AppError(
      404,
      "instance_not_found",
      "Nenhuma instancia WhatsApp configurada.",
    );
  }

  return instance;
}

/**
 * Checks whether an Evolution API error message indicates that the instance
 * already exists on the remote side.
 */
function isAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof AppError)) return false;

  const msg = error.message.toLowerCase();
  return msg.includes("already exists") || msg.includes("ja existe");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the current WhatsApp instance (if any) as a public DTO.
 * Never exposes `apikeyCiphertext`.
 */
export async function getInstance(): Promise<WhatsappInstanceDto | null> {
  const row = await db.whatsappInstance.findFirst();

  if (!row) return null;

  return toDto(row);
}

/**
 * Creates a new WhatsApp instance on the Evolution API, persists it in the
 * database with the apikey encrypted, and configures the webhook.
 *
 * Edge case 1: if the Evolution API reports "already exists", we delete the
 * orphan instance and retry creation once.
 */
export async function createInstance(
  input: { webhookUrl?: string },
  actorUserId: string,
  ipAddress?: string,
): Promise<{ instance: WhatsappInstanceDto; qrCodeBase64: string | null }> {
  // Pre-flight: ensure encryption key is available
  assertEncryptionKeyAvailable();

  // Check DB singleton
  const existing = await db.whatsappInstance.findFirst();
  if (existing) {
    throw new AppError(
      409,
      "instance_already_exists",
      "Ja existe uma instancia WhatsApp configurada. Desconecte antes de criar uma nova.",
    );
  }

  // Normalize webhookUrl: empty string or undefined -> no webhook configured.
  const webhookUrl = input.webhookUrl && input.webhookUrl.trim() !== ""
    ? input.webhookUrl.trim()
    : null;

  // Create instance on Evolution API in a single call. If a webhookUrl was
  // provided, include the webhook config inline so the instance and the
  // webhook are configured atomically. Evolution generates the per-instance
  // apikey and returns it in `hash`; the QR code base64 also comes back in
  // the same response since `qrcode: true`.
  const createPayload: Parameters<typeof evolutionClient.createInstance>[0] = {
    instanceName: INSTANCE_NAME,
    ...(webhookUrl
      ? { webhook: { url: webhookUrl, events: WEBHOOK_EVENTS } }
      : {}),
  };

  let createResult: {
    instanceId: string;
    hash: string;
    qrCodeBase64: string | null;
  };

  try {
    createResult = await evolutionClient.createInstance(createPayload);
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      logger.warn("whatsapp_orphan_instance_detected", {
        userId: actorUserId,
      });

      // Attempt to delete the orphan and retry once
      try {
        await evolutionClient.deleteInstance(INSTANCE_NAME);
      } catch (deleteError) {
        logger.warn("whatsapp_orphan_delete_failed", {
          userId: actorUserId,
          error: deleteError instanceof Error ? deleteError.message : String(deleteError),
        });
      }

      // Retry creation
      createResult = await evolutionClient.createInstance(createPayload);
    } else {
      throw error;
    }
  }

  // Encrypt the per-instance apikey before persisting
  const apikeyCiphertext = encryptApiKey(createResult.hash);

  // Persist in DB + audit log atomically
  const row = await db.$transaction(async (tx) => {
    const created = await tx.whatsappInstance.create({
      data: {
        instanceName: INSTANCE_NAME,
        instanceId: createResult.instanceId,
        apikeyCiphertext,
        webhookUrl,
      },
    });

    await logAuditEvent({
      actorUserId,
      action: "whatsapp.instance.create",
      entityType: ENTITY_TYPE,
      entityId: created.id,
      ipAddress: ipAddress ?? null,
      metadata: {
        instanceId: createResult.instanceId,
        webhookUrl,
        webhookEvents: webhookUrl ? WEBHOOK_EVENTS : null,
      },
    });

    return created;
  });

  logger.info("whatsapp_instance_created", {
    userId: actorUserId,
    entityId: row.id,
    instanceId: createResult.instanceId,
  });

  return { instance: toDto(row), qrCodeBase64: createResult.qrCodeBase64 };
}

/**
 * Deletes the current WhatsApp instance from the Evolution API and DB.
 * If the instance does not exist on the Evolution side (404), we still
 * clean up the DB.
 */
export async function deleteInstance(
  actorUserId: string,
  ipAddress?: string,
): Promise<void> {
  const instance = await findInstanceOrThrow();

  // Delete on Evolution API -- tolerate 404 (instance already gone)
  try {
    await evolutionClient.deleteInstance(INSTANCE_NAME);
  } catch (error) {
    if (error instanceof AppError && error.status === 502) {
      // Could be a 404 from Evolution wrapped as 502 -- log and continue
      logger.warn("whatsapp_evolution_delete_failed", {
        userId: actorUserId,
        entityId: instance.id,
        error: error.message,
      });
    } else {
      throw error;
    }
  }

  // Remove from DB + audit atomically
  await db.$transaction(async (tx) => {
    await tx.whatsappInstance.delete({
      where: { id: instance.id },
    });

    await logAuditEvent({
      actorUserId,
      action: "whatsapp.instance.delete",
      entityType: ENTITY_TYPE,
      entityId: instance.id,
      ipAddress: ipAddress ?? null,
      metadata: { instanceId: instance.instanceId },
    });
  });

  logger.info("whatsapp_instance_deleted", {
    userId: actorUserId,
    entityId: instance.id,
    instanceId: instance.instanceId,
  });
}

/**
 * Gets the QR code for connecting the WhatsApp instance.
 * Decrypts the apikey only in memory for the outbound call.
 */
export async function getQrCode(
  actorUserId: string,
  ipAddress?: string,
): Promise<{ base64: string }> {
  const instance = await findInstanceOrThrow();

  const apikey = decryptApiKey(instance.apikeyCiphertext);

  const result = await evolutionClient.getQrCode(INSTANCE_NAME, apikey);

  await logAuditEvent({
    actorUserId,
    action: "whatsapp.qr.shown",
    entityType: ENTITY_TYPE,
    entityId: instance.id,
    ipAddress: ipAddress ?? null,
  });

  logger.info("whatsapp_qr_shown", {
    userId: actorUserId,
    entityId: instance.id,
  });

  return { base64: result.base64 };
}

/**
 * Marks the instance as connected (admin clicked "Ja escaneei").
 * Updates `lastConnectedAt` in the DB.
 */
export async function markConnected(
  actorUserId: string,
  ipAddress?: string,
): Promise<WhatsappInstanceDto> {
  const instance = await findInstanceOrThrow();

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.whatsappInstance.update({
      where: { id: instance.id },
      data: { lastConnectedAt: new Date() },
    });

    await logAuditEvent({
      actorUserId,
      action: "whatsapp.connected_manual",
      entityType: ENTITY_TYPE,
      entityId: instance.id,
      ipAddress: ipAddress ?? null,
    });

    return row;
  });

  logger.info("whatsapp_connected_manual", {
    userId: actorUserId,
    entityId: instance.id,
  });

  return toDto(updated);
}

/**
 * Sends a hardcoded test message via WhatsApp to validate the connection.
 * Returns the random delay so the frontend can display it in a toast.
 */
export async function sendTestMessage(
  input: { ddd: string; numero: string },
  actorUserId: string,
  ipAddress?: string,
): Promise<{ delayMs: number }> {
  const instance = await findInstanceOrThrow();

  const delayMs = Math.floor(Math.random() * 29000) + 1000;
  const number = "55" + input.ddd + input.numero;

  const apikey = decryptApiKey(instance.apikeyCiphertext);

  await evolutionClient.sendTextMessage(INSTANCE_NAME, apikey, {
    number,
    text: TEST_MESSAGE_TEXT,
    delay: delayMs,
  });

  await logAuditEvent({
    actorUserId,
    action: "whatsapp.test_message.sent",
    entityType: ENTITY_TYPE,
    entityId: instance.id,
    ipAddress: ipAddress ?? null,
    metadata: {
      ddd: input.ddd,
      numeroLength: input.numero.length,
      delayMs,
    },
  });

  logger.info("whatsapp_test_message_sent", {
    userId: actorUserId,
    entityId: instance.id,
    delayMs,
  });

  return { delayMs };
}

/**
 * Re-configures the webhook URL for the existing WhatsApp instance without
 * recreating it. Updates both the Evolution API and the local DB record.
 */
export async function setWebhook(
  webhookUrl: string,
  actorUserId: string,
  ipAddress?: string,
): Promise<WhatsappInstanceDto> {
  const instance = await findInstanceOrThrow();

  const apikey = decryptApiKey(instance.apikeyCiphertext);

  await evolutionClient.setWebhook(INSTANCE_NAME, apikey, webhookUrl);

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.whatsappInstance.update({
      where: { id: instance.id },
      data: { webhookUrl },
    });

    await logAuditEvent({
      actorUserId,
      action: "whatsapp.webhook.set",
      entityType: ENTITY_TYPE,
      entityId: instance.id,
      ipAddress: ipAddress ?? null,
      metadata: { webhookUrl },
    });

    return row;
  });

  logger.info("whatsapp_webhook_set", {
    userId: actorUserId,
    entityId: instance.id,
    webhookUrl,
  });

  return toDto(updated);
}
