import { WebOrderStatus, WebOrderStatusActorType } from "@prisma/client";
import { z } from "zod";

import { customerAddressInputSchema } from "@/lib/schemas/customer-address";
import { notesFieldSchema, searchQueryFieldSchema } from "@/lib/schemas/string-fields";

const webOrderStatusSchema = z.nativeEnum(WebOrderStatus);
const webOrderStatusActorTypeSchema = z.nativeEnum(WebOrderStatusActorType);

const webOrderItemInputSchema = z.object({
  productId: z.string().cuid("Produto inválido."),
  quantity: z
    .number()
    .int("A quantidade deve ser inteira.")
    .min(1, "A quantidade mínima é 1."),
});

export const webOrderCreateInputSchema = z.object({
  items: z
    .array(webOrderItemInputSchema)
    .min(1, "Adicione pelo menos um item ao pedido."),
  addressId: z.string().cuid().optional(),
  address: customerAddressInputSchema.partial().optional(),
  notes: notesFieldSchema,
});

export const webOrderStatusTransitionSchema = z
  .object({
    toStatus: webOrderStatusSchema,
    notes: z.string().max(280, "A nota deve ter no máximo 280 caracteres.").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.toStatus === WebOrderStatus.CANCELLED) {
      const trimmed = data.notes?.trim() ?? "";
      if (trimmed.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["notes"],
          message: "Informe o motivo do cancelamento (mínimo 3 caracteres).",
        });
      }
    }
  });

export const webOrderListFiltersSchema = z.object({
  status: z.array(webOrderStatusSchema).optional(),
  query: searchQueryFieldSchema,
  customerId: z.string().cuid().optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export const webOrderItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  lineTotalCents: z.number().int(),
  createdAt: z.string(),
});

export const webOrderStatusLogSchema = z.object({
  id: z.string(),
  fromStatus: webOrderStatusSchema.nullable(),
  toStatus: webOrderStatusSchema,
  actorUserId: z.string().nullable(),
  actorName: z.string().nullable(),
  actorType: webOrderStatusActorTypeSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export const webOrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  customerPhone: z.string(),
  status: webOrderStatusSchema,
  totalCents: z.number().int(),
  notes: z.string().nullable(),
  addressId: z.string().nullable(),
  addressStreet: z.string().nullable(),
  addressNumber: z.string().nullable(),
  addressComplement: z.string().nullable(),
  addressNeighborhood: z.string().nullable(),
  addressCity: z.string().nullable(),
  addressState: z.string().nullable(),
  addressZip: z.string().nullable(),
  addressReference: z.string().nullable(),
  items: z.array(webOrderItemSchema),
  statusLogs: z.array(webOrderStatusLogSchema),
  statusUpdatedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WebOrderCreateInput = z.infer<typeof webOrderCreateInputSchema>;
export type WebOrderStatusTransition = z.infer<typeof webOrderStatusTransitionSchema>;
export type WebOrderListFilters = z.infer<typeof webOrderListFiltersSchema>;
export type WebOrderDto = z.infer<typeof webOrderSchema>;
export type WebOrderItemDto = z.infer<typeof webOrderItemSchema>;
export type WebOrderStatusLogDto = z.infer<typeof webOrderStatusLogSchema>;
