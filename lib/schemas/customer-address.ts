import { z } from "zod";

import {
  addressLineFieldSchema,
  cepFieldSchema,
  optionalAddressLineFieldSchema,
  ufFieldSchema,
} from "@/lib/schemas/string-fields";

export const customerAddressInputSchema = z.object({
  street: addressLineFieldSchema("A rua", 120),
  number: addressLineFieldSchema("O número", 20),
  complement: optionalAddressLineFieldSchema("O complemento", 80),
  neighborhood: addressLineFieldSchema("O bairro", 80),
  city: addressLineFieldSchema("A cidade", 80),
  state: ufFieldSchema,
  zip: cepFieldSchema,
  reference: optionalAddressLineFieldSchema("A referência", 120),
  isDefault: z.boolean().optional().default(false),
});

export const customerAddressSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  street: z.string(),
  number: z.string(),
  complement: z.string().nullable(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  reference: z.string().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CustomerAddressInput = z.infer<typeof customerAddressInputSchema>;
export type CustomerAddressDto = z.infer<typeof customerAddressSchema>;
