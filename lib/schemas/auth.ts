import { z } from "zod";

import { roleSchema } from "@/lib/schemas/shared";
import { personNameFieldSchema, usernameFieldSchema } from "@/lib/schemas/string-fields";

export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  role: roleSchema,
});

export const loginInputSchema = z.object({
  username: usernameFieldSchema,
  password: z.string().min(8).max(72),
});

export const initialAdminSetupInputSchema = z
  .object({
    name: personNameFieldSchema("O nome", 80),
    username: usernameFieldSchema,
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "A confirmação de senha não confere.",
      });
    }
  });

export const loginResponseSchema = z.object({
  user: sessionUserSchema,
});

export type SessionUserDto = z.infer<typeof sessionUserSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type InitialAdminSetupInput = z.infer<typeof initialAdminSetupInputSchema>;
