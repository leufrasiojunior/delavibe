import {
  ChefHat,
  CheckCheck,
  CircleDollarSign,
  PackageCheck,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import { PaymentMethod, WebOrderStatus } from "@prisma/client";

export const STATUS_LABELS: Record<WebOrderStatus, string> = {
  PENDING_PAYMENT: "Recebido",
  PAID: "Pago",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

export const STATUS_BADGE_CLASS: Record<WebOrderStatus, string> = {
  PENDING_PAYMENT: "badge warning",
  PAID: "badge neutral",
  PREPARING: "badge neutral",
  READY: "badge neutral",
  OUT_FOR_DELIVERY: "badge warning",
  DELIVERED: "badge success",
  CANCELLED: "badge danger",
};

export const TRANSITION_LABELS: Record<WebOrderStatus, string> = {
  PENDING_PAYMENT: "Reabrir",
  PAID: "Marcar como pago",
  PREPARING: "Iniciar preparo",
  READY: "Marcar como pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Marcar como entregue",
  CANCELLED: "Cancelar pedido",
};

export const TRANSITION_ICONS: Record<WebOrderStatus, typeof RotateCcw> = {
  PENDING_PAYMENT: RotateCcw,
  PAID: CircleDollarSign,
  PREPARING: ChefHat,
  READY: PackageCheck,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: CheckCheck,
  CANCELLED: XCircle,
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
};

export const PAYMENT_METHOD_ORDER: PaymentMethod[] = ["cash", "pix", "debit", "credit"];
