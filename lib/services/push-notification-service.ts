import webpush from "web-push";
import { WebOrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils/money";

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@example.com";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

type NewOrderPushPayload = {
  orderId: string;
  customerName: string;
  totalCents: number;
};

type NotificationPayload = {
  title: string;
  body: string;
  tag: string;
  data: {
    orderId: string;
    url: string;
    status?: WebOrderStatus;
  };
};

type CustomerStatusPushPayload = {
  orderId: string;
  customerId: string;
  status: WebOrderStatus;
};

const CUSTOMER_PUSH_STATUS_COPY: Partial<Record<WebOrderStatus, Pick<NotificationPayload, "title" | "body">>> = {
  OUT_FOR_DELIVERY: {
    title: "Pedido saiu para entrega",
    body: "Seu pedido saiu para entrega.",
  },
  DELIVERED: {
    title: "Pedido finalizado",
    body: "Seu pedido foi entregue.",
  },
};

export function shouldNotifyCustomerForWebOrderStatus(status: WebOrderStatus): boolean {
  return status === WebOrderStatus.OUT_FOR_DELIVERY || status === WebOrderStatus.DELIVERED;
}

export function buildCustomerOrderStatusPushPayload(payload: {
  orderId: string;
  status: WebOrderStatus;
}): NotificationPayload {
  const copy = CUSTOMER_PUSH_STATUS_COPY[payload.status];
  if (!copy) {
    throw new Error(`Status ${payload.status} nao possui payload de push para cliente.`);
  }

  return {
    ...copy,
    tag: `order:${payload.orderId}:customer:${payload.status}`,
    data: {
      orderId: payload.orderId,
      status: payload.status,
      url: `/pedido/${payload.orderId}/confirmacao`,
    },
  };
}

export async function sendNewOrderPushToAdmins(payload: NewOrderPushPayload): Promise<void> {
  if (!ensureVapidConfigured()) {
    logger.warn("push: VAPID nao configurado, pulando envio", { orderId: payload.orderId });
    return;
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: {
      user: {
        isActive: true,
        role: { in: ["admin", "operator"] },
      },
    },
  });

  if (subscriptions.length === 0) {
    return;
  }

  const notificationPayload = JSON.stringify({
    title: "Novo pedido",
    body: `${formatCurrency(payload.totalCents)} · ${payload.customerName}`,
    tag: `order:${payload.orderId}:created`,
    data: {
      orderId: payload.orderId,
      url: "/admin/pedidos-web",
    },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload,
        );
        await db.pushSubscription.update({
          where: { id: sub.id },
          data: { lastUsedAt: new Date() },
        });
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number } | null)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          return;
        }
        throw err;
      }
    }),
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    logger.error("push: algumas notificacoes falharam", {
      orderId: payload.orderId,
      failed,
      total: subscriptions.length,
    });
  }
}

export async function sendWebOrderStatusPushToCustomer(
  payload: CustomerStatusPushPayload,
): Promise<void> {
  if (!shouldNotifyCustomerForWebOrderStatus(payload.status)) {
    return;
  }

  if (!ensureVapidConfigured()) {
    logger.warn("push: VAPID nao configurado, pulando envio ao cliente", {
      orderId: payload.orderId,
      status: payload.status,
    });
    return;
  }

  const subscriptions = await db.customerPushSubscription.findMany({
    where: { customerId: payload.customerId },
  });

  if (subscriptions.length === 0) {
    return;
  }

  const notificationPayload = JSON.stringify(
    buildCustomerOrderStatusPushPayload({
      orderId: payload.orderId,
      status: payload.status,
    }),
  );

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload,
        );
        await db.customerPushSubscription.update({
          where: { id: sub.id },
          data: { lastUsedAt: new Date() },
        });
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number } | null)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.customerPushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          return;
        }
        throw err;
      }
    }),
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    logger.error("push: algumas notificacoes do cliente falharam", {
      orderId: payload.orderId,
      status: payload.status,
      failed,
      total: subscriptions.length,
    });
  }
}
