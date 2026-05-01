import { z } from "zod";

import { requiredIntegerField } from "@/lib/schemas/parsers";
import { stockMovementReasonSchema } from "@/lib/schemas/shared";
import { normalizeOptionalText } from "@/lib/utils/strings";

export const stockMovementSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  actorName: z.string().nullable(),
  quantityDelta: z.number().int(),
  resultingStock: z.number().int(),
  reason: stockMovementReasonSchema,
  notes: z.string().nullable(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  createdAt: z.string(),
});

export const stockMovementListSchema = z.array(stockMovementSchema);

export const createStockMovementInputSchema = z
  .object({
    productId: z.string().cuid(),
    reason: stockMovementReasonSchema,
    quantity: requiredIntegerField({
      required: "Informe a quantidade da movimentação.",
      invalid: "Informe uma quantidade válida para a movimentação.",
    }),
    notes: z.string().optional().nullable(),
  })
  .transform((data) => ({
    productId: data.productId,
    reason: data.reason,
    quantity: data.quantity,
    notes: normalizeOptionalText(data.notes),
  }))
  .superRefine((data, ctx) => {
    if (data.reason === "manual_entry" && data.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity"],
        message: "Entradas manuais precisam ser positivas.",
      });
    }

    if (!["manual_entry", "manual_adjustment"].includes(data.reason)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Use apenas razões manuais neste endpoint.",
      });
    }

    if (data.quantity === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity"],
        message: "A quantidade não pode ser zero.",
      });
    }
  });

export type StockMovementDto = z.infer<typeof stockMovementSchema>;
