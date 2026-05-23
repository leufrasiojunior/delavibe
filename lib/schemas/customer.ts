import { z } from "zod";

import {
  emailFieldSchema,
  passwordFieldSchema,
  personNameFieldSchema,
  phoneFieldSchema,
} from "@/lib/schemas/string-fields";

export const POLICY_VERSION_PATTERN = /^v?\d+\.\d+(?:-\d{4}-\d{2})?$/;

const policyVersionSchema = z
  .string()
  .trim()
  .min(3, "Informe a versão da política aceita.")
  .max(40, "A versão da política deve ter no máximo 40 caracteres.")
  .regex(POLICY_VERSION_PATTERN, "Versão da política inválida.");

const consentDataProcessingSchema = z.literal(true, {
  errorMap: () => ({
    message: "É necessário aceitar o processamento de dados para criar conta.",
  }),
});

const consentMarketingSchema = z.boolean().optional().default(false);

export const customerRegisterInputSchema = z
  .object({
    name: personNameFieldSchema("O nome do cliente", 80),
    email: emailFieldSchema,
    phone: phoneFieldSchema,
    password: passwordFieldSchema,
    consentDataProcessing: consentDataProcessingSchema,
    consentMarketing: consentMarketingSchema,
    policyVersion: policyVersionSchema,
  })
  .transform((data) => ({
    name: data.name,
    email: data.email,
    phone: data.phone,
    password: data.password,
    consentDataProcessing: data.consentDataProcessing,
    consentMarketing: data.consentMarketing,
    policyVersion: data.policyVersion,
  }));

export const customerLoginInputSchema = z.object({
  email: emailFieldSchema,
  password: z.string().min(1, "Informe a senha.").max(72, "Senha inválida."),
});

export const customerPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  consentDataProcessingAt: z.string(),
  consentMarketingAt: z.string().nullable(),
  consentPolicyVersion: z.string(),
  createdAt: z.string(),
});

export const customerSchema = customerPublicSchema.extend({
  deletedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export type CustomerRegisterInput = z.infer<typeof customerRegisterInputSchema>;
export type CustomerLoginInput = z.infer<typeof customerLoginInputSchema>;
export type CustomerPublicDto = z.infer<typeof customerPublicSchema>;
export type CustomerDto = z.infer<typeof customerSchema>;
