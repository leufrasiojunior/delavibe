import { z } from "zod";

export const roleSchema = z.enum(["admin", "operator"]);
export const commandaStatusSchema = z.enum(["open", "closed", "cancelled"]);
export const paymentMethodSchema = z.enum(["cash", "pix", "debit", "credit"]);
export const stockMovementReasonSchema = z.enum([
  "manual_entry",
  "manual_adjustment",
  "comanda_item_add",
  "comanda_item_remove",
  "comanda_cancel_reversal",
  "web_order_create",
  "web_order_cancel_reversal",
]);

export type Role = z.infer<typeof roleSchema>;
export type CommandaStatus = z.infer<typeof commandaStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type StockMovementReason = z.infer<typeof stockMovementReasonSchema>;
