import { WebOrderStatus } from "@prisma/client";

export const WEB_ORDER_TRANSITIONS: Record<WebOrderStatus, WebOrderStatus[]> = {
  PENDING_PAYMENT: [WebOrderStatus.PREPARING, WebOrderStatus.CANCELLED],
  PREPARING: [WebOrderStatus.READY, WebOrderStatus.CANCELLED],
  READY: [WebOrderStatus.OUT_FOR_DELIVERY, WebOrderStatus.CANCELLED],
  OUT_FOR_DELIVERY: [WebOrderStatus.PAID, WebOrderStatus.CANCELLED],
  PAID: [WebOrderStatus.DELIVERED, WebOrderStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

export const WEB_ORDER_TERMINAL_STATES: WebOrderStatus[] = [
  WebOrderStatus.DELIVERED,
  WebOrderStatus.CANCELLED,
];

export const WEB_ORDER_STOCK_REVERTING_FROM_STATES: WebOrderStatus[] = [
  WebOrderStatus.PENDING_PAYMENT,
  WebOrderStatus.PREPARING,
  WebOrderStatus.READY,
  WebOrderStatus.OUT_FOR_DELIVERY,
  WebOrderStatus.PAID,
];

export function isValidTransition(from: WebOrderStatus, to: WebOrderStatus): boolean {
  return WEB_ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalStatus(status: WebOrderStatus): boolean {
  return WEB_ORDER_TERMINAL_STATES.includes(status);
}

export function cancelingRevertsStock(fromStatus: WebOrderStatus): boolean {
  return WEB_ORDER_STOCK_REVERTING_FROM_STATES.includes(fromStatus);
}
