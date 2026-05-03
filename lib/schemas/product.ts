import { z } from "zod";

import {
  requiredIntegerField,
  requiredMoneyField,
} from "@/lib/schemas/parsers";
import {
  barcodeFieldSchema,
  categoryFieldSchema,
  imagePathFieldSchema,
  normalizeSafeCode,
  normalizeSafeName,
  productNameFieldSchema,
  skuFieldSchema,
  unitFieldSchema,
} from "@/lib/schemas/string-fields";
import { toCents } from "@/lib/utils/money";

const productFormSchema = z.object({
  name: productNameFieldSchema,
  sku: skuFieldSchema,
  barcode: barcodeFieldSchema,
  category: categoryFieldSchema,
  imagePath: imagePathFieldSchema,
  unit: unitFieldSchema.default("un"),
  price: requiredMoneyField({
    required: "Informe o preço de venda.",
    invalid: "Informe um valor monetário válido no preço de venda.",
    min: "O preço de venda não pode ser negativo.",
  }),
  cost: z.preprocess(
    (value) => {
      if (value == null) {
        return null;
      }

      if (typeof value === "string" && value.trim() === "") {
        return null;
      }

      return value;
    },
    z.union([
      requiredMoneyField({
        required: "Informe um custo válido.",
        invalid: "Informe um valor monetário válido no custo.",
        min: "O custo não pode ser negativo.",
      }),
      z.null(),
    ]),
  ),
  stockQty: requiredIntegerField({
    required: "Informe o estoque atual.",
    invalid: "Informe um estoque atual válido.",
  }),
  minimumStock: requiredIntegerField({
    required: "Informe o estoque mínimo.",
    invalid: "Informe um estoque mínimo válido.",
    min: { value: 0, message: "O estoque mínimo não pode ser negativo." },
  }),
  isActive: z.boolean().optional().default(true),
});

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  barcode: z.string(),
  category: z.string().nullable(),
  imagePath: z.string().nullable(),
  unit: z.string(),
  priceCents: z.number().int(),
  costCents: z.number().int().nullable(),
  stockQty: z.number().int(),
  minimumStock: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const productListSchema = z.array(productSchema);

export const createProductInputSchema = productFormSchema.transform((data) => ({
  name: normalizeSafeName(data.name),
  sku: normalizeSafeCode(data.sku) ?? null,
  barcode: data.barcode,
  category: data.category ?? null,
  imagePath: data.imagePath ?? null,
  unit: data.unit,
  priceCents: toCents(data.price),
  costCents: data.cost == null ? null : toCents(data.cost),
  stockQty: data.stockQty,
  minimumStock: data.minimumStock,
  isActive: data.isActive ?? true,
}));

export const updateProductInputSchema = productFormSchema
  .extend({
    id: z.string().cuid(),
  })
  .transform((data) => ({
    id: data.id,
    name: normalizeSafeName(data.name),
    sku: normalizeSafeCode(data.sku) ?? null,
    barcode: data.barcode,
    category: data.category ?? null,
    imagePath: data.imagePath ?? null,
    unit: data.unit,
    priceCents: toCents(data.price),
    costCents: data.cost == null ? null : toCents(data.cost),
    stockQty: data.stockQty,
    minimumStock: data.minimumStock,
    isActive: data.isActive ?? true,
  }));

export type ProductDto = z.infer<typeof productSchema>;
