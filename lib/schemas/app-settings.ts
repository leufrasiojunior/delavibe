import { z } from "zod";

import { normalizeOptionalText } from "@/lib/utils/strings";
import { normalizeWhatsappPhone } from "@/lib/utils/whatsapp";

function normalizeOptionalWhatsappPhone(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalizeWhatsappPhone(normalized) : null;
}

const optionalWhatsappPhoneSchema = z
  .string()
  .max(40, "O telefone do WhatsApp deve ter no máximo 40 caracteres.")
  .nullable()
  .optional()
  .transform((value) => normalizeOptionalText(value))
  .superRefine((value, ctx) => {
    if (value && !normalizeWhatsappPhone(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe um WhatsApp válido com DDD.",
      });
    }
  })
  .transform((value) => normalizeOptionalWhatsappPhone(value));

const optionalWhatsappMessageSchema = z
  .string()
  .max(500, "A mensagem deve ter no máximo 500 caracteres.")
  .nullable()
  .optional()
  .transform((value) => normalizeOptionalText(value));

export const appSettingsSchema = z.object({
  whatsappContactPhone: z.string().nullable(),
  webOrderWhatsappMessage: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const updateAppSettingsInputSchema = z.object({
  whatsappContactPhone: optionalWhatsappPhoneSchema,
  webOrderWhatsappMessage: optionalWhatsappMessageSchema,
});

export type AppSettingsDto = z.infer<typeof appSettingsSchema>;
export type UpdateAppSettingsInput = z.infer<typeof updateAppSettingsInputSchema>;
