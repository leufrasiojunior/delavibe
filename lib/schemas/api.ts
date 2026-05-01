import { z } from "zod";

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  hint: z.string().nullable().optional(),
  details: z.unknown().nullable().optional(),
});

export const errorEnvelopeSchema = z.object({
  data: z.null(),
  error: apiErrorSchema,
  requestId: z.string(),
});

export function successEnvelopeSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    error: z.null(),
    requestId: z.string(),
  });
}
