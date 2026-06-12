import { PromotionType } from "@prisma/client";
import { z } from "zod";

import { requiredMoneyField } from "@/lib/schemas/parsers";
import { searchQueryFieldSchema } from "@/lib/schemas/string-fields";
import { toCents } from "@/lib/utils/money";

export const promotionTypeSchema = z.nativeEnum(PromotionType);

export const promotionSnapshotSchema = z.object({
  id: z.string(),
  type: promotionTypeSchema,
  promotionalPriceCents: z.number().int(),
  startsAt: z.string(),
  endsAt: z.string(),
});

export const promotionProductSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  barcode: z.string(),
  category: z.string().nullable(),
  priceCents: z.number().int(),
  imagePath: z.string().nullable(),
  updatedAt: z.string(),
});

export const promotionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  product: promotionProductSummarySchema,
  type: promotionTypeSchema,
  promotionalPriceCents: z.number().int(),
  startsAt: z.string(),
  endsAt: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const promotionListSchema = z.array(promotionSchema);

function requiredDateTimeField(fieldLabel: string) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string" || value.trim() === "") {
        return undefined;
      }

      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    },
    z.date({
      required_error: `Informe ${fieldLabel}.`,
      invalid_type_error: `${fieldLabel} inválido.`,
    }),
  );
}

const promotionFormFields = {
  productId: z.string().cuid("Produto inválido."),
  type: promotionTypeSchema,
  promotionalPrice: requiredMoneyField({
    required: "Informe o preço promocional.",
    invalid: "Informe um valor monetário válido no preço promocional.",
    min: "O preço promocional não pode ser negativo.",
  }),
  startsAt: requiredDateTimeField("o início da promoção"),
  endsAt: requiredDateTimeField("o fim da promoção"),
  isActive: z.boolean().optional().default(true),
};

function refinePromotionPeriod<TData extends { startsAt: Date; endsAt: Date }>(
  data: TData,
  ctx: z.RefinementCtx,
) {
    if (data.endsAt <= data.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "O fim da promoção deve ser depois do início.",
      });
    }
}

const promotionFormSchema = z.object(promotionFormFields).superRefine(refinePromotionPeriod);

export const createPromotionInputSchema = promotionFormSchema.transform((data) => ({
  productId: data.productId,
  type: data.type,
  promotionalPriceCents: toCents(data.promotionalPrice),
  startsAt: data.startsAt,
  endsAt: data.endsAt,
  isActive: data.isActive ?? true,
}));

export const updatePromotionInputSchema = z
  .object(promotionFormFields)
  .extend({
    id: z.string().cuid("Promoção inválida."),
  })
  .superRefine(refinePromotionPeriod)
  .transform((data) => ({
    id: data.id,
    productId: data.productId,
    type: data.type,
    promotionalPriceCents: toCents(data.promotionalPrice),
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    isActive: data.isActive ?? true,
  }));

export const promotionListQuerySchema = z.object({
  q: searchQueryFieldSchema,
});

export type PromotionDto = z.infer<typeof promotionSchema>;
export type PromotionSnapshotDto = z.infer<typeof promotionSnapshotSchema>;
