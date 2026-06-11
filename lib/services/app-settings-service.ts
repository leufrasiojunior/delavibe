import { db } from "@/lib/db";
import {
  type AppSettingsDto,
  updateAppSettingsInputSchema,
} from "@/lib/schemas/app-settings";
import { logAuditEvent } from "@/lib/services/audit-service";

const APP_SETTINGS_ID = "app";

type AppSettingsRecord = {
  whatsappContactPhone: string | null;
  webOrderWhatsappMessage: string | null;
  updatedAt: Date;
};

function toAppSettingsDto(settings: AppSettingsRecord | null): AppSettingsDto {
  return {
    whatsappContactPhone: settings?.whatsappContactPhone ?? null,
    webOrderWhatsappMessage: settings?.webOrderWhatsappMessage ?? null,
    updatedAt: settings?.updatedAt.toISOString() ?? null,
  };
}

export async function getAppSettings() {
  const settings = await db.appSettings.findUnique({
    where: { id: APP_SETTINGS_ID },
    select: {
      whatsappContactPhone: true,
      webOrderWhatsappMessage: true,
      updatedAt: true,
    },
  });

  return toAppSettingsDto(settings);
}

export async function updateAppSettings(
  rawInput: unknown,
  actorUserId: string,
  ipAddress: string,
) {
  const input = updateAppSettingsInputSchema.parse(rawInput);

  const settings = await db.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    create: {
      id: APP_SETTINGS_ID,
      whatsappContactPhone: input.whatsappContactPhone ?? null,
      webOrderWhatsappMessage: input.webOrderWhatsappMessage ?? null,
    },
    update: {
      whatsappContactPhone: input.whatsappContactPhone ?? null,
      webOrderWhatsappMessage: input.webOrderWhatsappMessage ?? null,
    },
    select: {
      whatsappContactPhone: true,
      webOrderWhatsappMessage: true,
      updatedAt: true,
    },
  });

  await logAuditEvent({
    actorUserId,
    action: "app_settings_updated",
    entityType: "app_settings",
    entityId: APP_SETTINGS_ID,
    ipAddress,
    metadata: {
      whatsappContactPhone: settings.whatsappContactPhone,
      hasWebOrderWhatsappMessage: Boolean(settings.webOrderWhatsappMessage),
    },
  });

  return toAppSettingsDto(settings);
}
