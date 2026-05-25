import { z } from "zod";

export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url().min(8).max(2048),
  keys: z.object({
    p256dh: z.string().min(8).max(256),
    auth: z.string().min(8).max(256),
  }),
  userAgent: z.string().max(512).optional().nullable(),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;

export const pushUnsubscribeInputSchema = z.object({
  endpoint: z.string().url().min(8).max(2048),
});

export const pushPublicKeyResponseSchema = z.object({
  publicKey: z.string().min(1),
});

export const pushStatusResponseSchema = z.object({
  active: z.boolean(),
});

export const pushSubscribeResponseSchema = z.object({
  ok: z.literal(true),
});
