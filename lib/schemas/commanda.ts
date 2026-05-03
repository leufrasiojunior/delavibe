import { z } from "zod";

import {
  commandaStatusSchema,
  paymentMethodSchema,
  stockMovementReasonSchema,
} from "@/lib/schemas/shared";
import {
  optionalPositiveMoneyField,
  requiredIntegerField,
} from "@/lib/schemas/parsers";
import {
  customerNameFieldSchema,
  notesFieldSchema,
  searchQueryFieldSchema,
} from "@/lib/schemas/string-fields";
import { toCents } from "@/lib/utils/money";

export const paymentSchema = z.object({
  id: z.string(),
  method: paymentMethodSchema,
  amountCents: z.number().int(),
  notes: z.string().nullable(),
  operatorName: z.string(),
  createdAt: z.string(),
});

export const commandaItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  productSku: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  subtotalCents: z.number().int(),
  stockAfter: z.number().int().nullable(),
  createdAt: z.string(),
});

export const commandaSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  status: commandaStatusSchema,
  customerName: z.string().nullable(),
  notes: z.string().nullable(),
  subtotalCents: z.number().int(),
  discountCents: z.number().int(),
  totalCents: z.number().int(),
  operatorId: z.string(),
  operatorName: z.string(),
  items: z.array(commandaItemSchema),
  payments: z.array(paymentSchema),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
});

export const commandaListSchema = z.array(commandaSchema);
export const commandaListStatusSchema = z.enum(["open", "closed", "all"]);
export const commandaListQuerySchema = z.object({
  status: commandaListStatusSchema.optional().default("open"),
  q: searchQueryFieldSchema,
});

export const createCommandaInputSchema = z.object({
  customerName: customerNameFieldSchema,
  notes: notesFieldSchema,
}).transform((data) => ({
  customerName: data.customerName ?? null,
  notes: data.notes ?? null,
}));

export const updateCommandaCustomerNameInputSchema = z.object({
  customerName: customerNameFieldSchema,
}).transform((data) => ({
  customerName: data.customerName ?? null,
}));

export const addCommandaItemInputSchema = z.object({
  productId: z.string().cuid(),
  quantity: requiredIntegerField({
    required: "Informe a quantidade do item.",
    invalid: "Informe uma quantidade válida.",
    positive: "A quantidade deve ser maior que zero.",
  }),
});

export const updateCommandaItemQuantityInputSchema = z.object({
  quantity: requiredIntegerField({
    required: "Informe a quantidade do item.",
    invalid: "Informe uma quantidade válida.",
    positive: "A quantidade deve ser maior que zero.",
  }),
});

const paymentInputSchema = z.object({
  method: paymentMethodSchema,
  amount: optionalPositiveMoneyField({
    invalid: "Informe um valor monetário válido para o pagamento.",
    positive: "O valor do pagamento deve ser maior que zero.",
  }),
  notes: notesFieldSchema,
});

export const closeCommandaInputSchema = z
  .object({
    payments: z.array(paymentInputSchema).min(1, "Informe ao menos uma forma de pagamento."),
  })
  .superRefine((data, ctx) => {
    let validPaymentCount = 0;

    data.payments.forEach((payment, index) => {
      const notes = payment.notes;
      const hasAnyContent = payment.amount != null || notes !== null;

      if (!hasAnyContent) {
        return;
      }

      validPaymentCount += 1;

      if (payment.amount == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payments", index, "amount"],
          message: "Informe o valor da forma de pagamento preenchida.",
        });
      }
    });

    if (validPaymentCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payments"],
        message: "Informe ao menos uma forma de pagamento com valor.",
      });
    }
  })
  .transform((data) => ({
    payments: data.payments
      .map((payment) => ({
        method: payment.method,
        amountCents: payment.amount == null ? null : toCents(payment.amount),
        notes: payment.notes ?? null,
      }))
      .filter((payment) => payment.amountCents != null || payment.notes !== null)
      .map((payment) => ({
        method: payment.method,
        amountCents: payment.amountCents as number,
        notes: payment.notes ?? null,
      })),
  }));

export const commandaMutationResponseSchema = z.object({
  commanda: commandaSchema,
  warning: z.string().nullable().optional(),
});

export const dailyTopProductSchema = z.object({
  productName: z.string(),
  quantity: z.number().int(),
  totalCents: z.number().int(),
});

export const dailySummarySchema = z.object({
  totalSalesCents: z.number().int(),
  closedCommandasCount: z.number().int(),
  openCommandasCount: z.number().int(),
  lowStockCount: z.number().int(),
  negativeStockCount: z.number().int(),
  topProducts: z.array(dailyTopProductSchema),
});

export const dashboardAnalyticsSummarySchema = z.object({
  totalSalesCents: z.number().int(),
  closedCommandasCount: z.number().int(),
  averageTicketCents: z.number().int(),
  itemsSoldCount: z.number().int(),
});

export const dashboardSalesSeriesPointSchema = z.object({
  date: z.string(),
  label: z.string(),
  displayDate: z.string(),
  totalSalesCents: z.number().int(),
  closedCommandasCount: z.number().int(),
});

export const dashboardTopProductPeriodItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.number().int(),
  totalCents: z.number().int(),
});

export const dashboardAnalyticsSchema = z.object({
  summary: dashboardAnalyticsSummarySchema,
  salesByDay: z.array(dashboardSalesSeriesPointSchema),
  topProducts: z.array(dashboardTopProductPeriodItemSchema),
});

export const stockWarningSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  reason: stockMovementReasonSchema.optional(),
});

export type CommandaDto = z.infer<typeof commandaSchema>;
export type CommandaListStatusFilter = z.infer<typeof commandaListStatusSchema>;
export type DailySummaryDto = z.infer<typeof dailySummarySchema>;
export type DashboardAnalyticsDto = z.infer<typeof dashboardAnalyticsSchema>;
export type DashboardAnalyticsSummaryDto = z.infer<typeof dashboardAnalyticsSummarySchema>;
export type DashboardSalesSeriesPointDto = z.infer<typeof dashboardSalesSeriesPointSchema>;
export type DashboardTopProductPeriodItemDto = z.infer<typeof dashboardTopProductPeriodItemSchema>;
