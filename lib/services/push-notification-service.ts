import webpush from "web-push";

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
