import { z } from "zod";

import {
  hasControlCharacters,
  normalizeBarcode,
  normalizeCode,
  normalizeOptionalCode,
  normalizeOptionalText,
  normalizePath,
  normalizeText,
} from "@/lib/utils/strings";

const markupPattern = /[<>`]/;
const usernamePattern = /^[A-Za-z0-9._@-]+$/;
const skuPattern = /^[A-Za-z0-9._/-]+$/;
const barcodePattern = /^[A-Za-z0-9._/-]+$/;
const unitPattern = /^[A-Za-z]{1,12}$/;
const relativeImagePathPattern = /^\/[A-Za-z0-9/_-]+(?:\.[A-Za-z0-9._-]+)?$/;

function assertSafeText(value: string, fieldLabel: string) {
  if (hasControlCharacters(value)) {
    return `${fieldLabel} contém caracteres de controle inválidos.`;
  }

  if (markupPattern.test(value)) {
    return `${fieldLabel} contém caracteres não permitidos.`;
  }

  return null;
}

function safeTextSchema(fieldLabel: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min, `${fieldLabel} deve ter pelo menos ${min} caracteres.`)
    .max(max, `${fieldLabel} deve ter no máximo ${max} caracteres.`)
    .superRefine((value, ctx) => {
      const errorMessage = assertSafeText(value, fieldLabel);

      if (errorMessage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: errorMessage,
        });
      }
    })
    .transform((value) => normalizeText(value));
}

function optionalSafeTextSchema(fieldLabel: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${fieldLabel} deve ter no máximo ${max} caracteres.`)
    .superRefine((value, ctx) => {
      const errorMessage = assertSafeText(value, fieldLabel);

      if (errorMessage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: errorMessage,
        });
      }
    })
    .transform((value) => normalizeOptionalText(value))
    .optional()
    .nullable();
}

function optionalPatternSchema(fieldLabel: string, max: number, pattern: RegExp, patternMessage: string) {
  return z
    .string()
    .trim()
    .max(max, `${fieldLabel} deve ter no máximo ${max} caracteres.`)
    .superRefine((value, ctx) => {
      const errorMessage = assertSafeText(value, fieldLabel);

      if (errorMessage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: errorMessage,
        });
        return;
      }

      const normalized = normalizeText(value);

      if (normalized.length > 0 && !pattern.test(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: patternMessage,
        });
      }
    })
    .transform((value) => normalizeOptionalCode(value))
    .optional()
    .nullable();
}

export const usernameFieldSchema = z
  .string()
  .trim()
  .min(3, "O usuário deve ter pelo menos 3 caracteres.")
  .max(40, "O usuário deve ter no máximo 40 caracteres.")
  .superRefine((value, ctx) => {
    if (hasControlCharacters(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O usuário contém caracteres de controle inválidos.",
      });
      return;
    }

    const normalized = normalizeText(value);

    if (!usernamePattern.test(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use apenas letras, números e os símbolos . _ @ - no usuário.",
      });
    }
  })
  .transform((value) => normalizeText(value).toLowerCase());

export const personNameFieldSchema = (fieldLabel: string, max = 80) =>
  safeTextSchema(fieldLabel, 3, max);

export const productNameFieldSchema = safeTextSchema("O nome do produto", 1, 120);
export const customerNameFieldSchema = optionalSafeTextSchema("O nome do cliente", 80);
export const notesFieldSchema = optionalSafeTextSchema("As observações", 240);
export const categoryFieldSchema = optionalSafeTextSchema("A categoria", 40);

export const skuFieldSchema = optionalPatternSchema(
  "O SKU",
  40,
  skuPattern,
  "Use apenas letras, números e os símbolos . _ / - no SKU.",
);

export const unitFieldSchema = z
  .string()
  .trim()
  .min(1, "Informe a unidade de venda.")
  .max(12, "A unidade deve ter no máximo 12 caracteres.")
  .superRefine((value, ctx) => {
    if (hasControlCharacters(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A unidade contém caracteres de controle inválidos.",
      });
      return;
    }

    const normalized = normalizeText(value);

    if (!unitPattern.test(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use apenas letras na unidade de venda.",
      });
    }
  })
  .transform((value) => normalizeText(value).toLowerCase());

export const barcodeFieldSchema = z
  .string()
  .trim()
  .min(1, "Informe o código de barras.")
  .max(80, "O código de barras deve ter no máximo 80 caracteres.")
  .superRefine((value, ctx) => {
    if (hasControlCharacters(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O código de barras contém caracteres de controle inválidos.",
      });
      return;
    }

    const normalized = normalizeBarcode(value);

    if (!barcodePattern.test(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use apenas letras, números e os símbolos . _ / - no código de barras.",
      });
    }
  })
  .transform((value) => normalizeBarcode(value));

export const imagePathFieldSchema = z
  .string()
  .trim()
  .max(180, "O caminho da imagem deve ter no máximo 180 caracteres.")
  .superRefine((value, ctx) => {
    const normalized = normalizePath(value);

    if (normalized.length === 0) {
      return;
    }

    if (hasControlCharacters(normalized) || markupPattern.test(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O caminho da imagem contém caracteres inválidos.",
      });
      return;
    }

    if (
      normalized.includes("://") ||
      normalized.includes("..") ||
      normalized.includes("//") ||
      normalized.startsWith("data:") ||
      normalized.startsWith("javascript:")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use apenas caminhos locais relativos da aplicação para a imagem.",
      });
      return;
    }

    if (!relativeImagePathPattern.test(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use apenas caminhos locais iniciando com / para a imagem.",
      });
    }
  })
  .transform((value) => {
    const normalized = normalizePath(value);
    return normalized.length > 0 ? normalized : null;
  })
  .optional()
  .nullable();

export const searchQueryFieldSchema = z
  .string()
  .trim()
  .max(80, "A busca deve ter no máximo 80 caracteres.")
  .superRefine((value, ctx) => {
    const errorMessage = assertSafeText(value, "A busca");

    if (errorMessage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: errorMessage,
      });
    }
  })
  .transform((value) => normalizeOptionalText(value))
  .optional()
  .nullable();

export function normalizeSafeCode(value?: string | null) {
  return normalizeOptionalCode(value);
}

export function normalizeSafeName(value: string) {
  return normalizeText(value);
}
