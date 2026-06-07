import { z } from "zod";

export const webhookUrlSchema = z
  .string()
  .min(1, "URL do Webhook e obrigatoria")
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL invalida (deve ser http ou https)" }
  );

/**
 * Webhook URL opcional: aceita string vazia (= sem webhook) ou ausente.
 * Quando preenchido, deve passar pela mesma validacao do webhookUrlSchema.
 */
export const webhookUrlOptionalSchema = z
  .string()
  .optional()
  .refine(
    (value) => {
      if (value === undefined || value === "") return true;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL invalida (deve ser http ou https)" }
  );

export const createInstanceInputSchema = z.object({
  webhookUrl: webhookUrlOptionalSchema,
});

export const testMessageInputSchema = z.object({
  ddd: z.string().regex(/^\d{2}$/, "DDD deve ter 2 digitos"),
  numero: z.string().regex(/^\d{8,9}$/, "Numero deve ter 8 ou 9 digitos"),
});

export const whatsappInstanceDtoSchema = z.object({
  id: z.string(),
  instanceName: z.string(),
  instanceId: z.string(),
  webhookUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastConnectedAt: z.string().datetime().nullable(),
});

export type WebhookUrl = z.infer<typeof webhookUrlSchema>;
export type CreateInstanceInput = z.infer<typeof createInstanceInputSchema>;
export type TestMessageInput = z.infer<typeof testMessageInputSchema>;
export type WhatsappInstanceDto = z.infer<typeof whatsappInstanceDtoSchema>;
