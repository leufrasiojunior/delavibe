import { WebOrderStatus } from "@prisma/client";

export const WEB_ORDER_TRANSITIONS: Record<WebOrderStatus, WebOrderStatus[]> = {
  PENDING_PAYMENT: [WebOrderStatus.PAID, WebOrderStatus.CANCELLED],
  PAID: [WebOrderStatus.PREPARING, WebOrderStatus.CANCELLED],
  PREPARING: [WebOrderStatus.READY, WebOrderStatus.CANCELLED],
  READY: [WebOrderStatus.DELIVERED, WebOrderStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

export const WEB_ORDER_TERMINAL_STATES: WebOrderStatus[] = [
  WebOrderStatus.DELIVERED,
  WebOrderStatus.CANCELLED,
];

export const WEB_ORDER_STOCK_REVERTING_FROM_STATES: WebOrderStatus[] = [
  WebOrderStatus.PENDING_PAYMENT,
  WebOrderStatus.PAID,
  WebOrderStatus.PREPARING,
  WebOrderStatus.READY,
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
