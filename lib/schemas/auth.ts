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

export const initialAdminSetupInputSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    username: z.string().trim().min(3).max(80),
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
