import { z } from "zod";

import { roleSchema } from "@/lib/schemas/shared";

export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  role: roleSchema,
});

export const loginInputSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(72),
});

export const loginResponseSchema = z.object({
  user: sessionUserSchema,
});

export type SessionUserDto = z.infer<typeof sessionUserSchema>;
