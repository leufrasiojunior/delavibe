import {
  DeliveryMode,
  Prisma,
  WebOrderStatus,
  WebOrderStatusActorType,
} from "@prisma/client";

import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  type WebOrderDto,
  type WebOrderItemDto,
  type WebOrderListFilters,
  type WebOrderStatusLogDto,
  webOrderCreateInputSchema,
} from "@/lib/schemas/web-order";
import { logAuditEvent } from "@/lib/services/audit-service";
import { sendNewOrderPushToAdmins } from "@/lib/services/push-notification-service";
import {
  cancelingRevertsStock,
  isValidTransition,
} from "@/lib/utils/web-order-status";

const PENDING_TTL_MINUTES = Number(process.env.WEB_ORDER_PENDING_TTL_MINUTES || "60");
const EXPIRATION_DEBOUNCE_MS = 30_000;

let lastExpirationRunAt = 0;

const webOrderInclude = {
  customer: true,
  items: {
    orderBy: { createdAt: "asc" as const },
  },
  statusLogs: {
    orderBy: { createdAt: "asc" as const },
    include: { actor: true },
  },
};

type WebOrderWithRelations = Prisma.WebOrderGetPayload<{
  include: typeof webOrderInclude;
}>;

function toItemDto(
  item: WebOrderWithRelations["items"][number],
): WebOrderItemDto {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: item.lineTotalCents,
    createdAt: item.createdAt.toISOString(),
  };
}

function toStatusLogDto(
  log: WebOrderWithRelations["statusLogs"][number],
): WebOrderStatusLogDto {
  return {
    id: log.id,
    fromStatus: log.fromStatus,
    toStatus: log.toStatus,
    actorUserId: log.actorUserId,
    actorName: log.actor?.name ?? null,
    actorType: log.actorType,
    notes: log.notes,
    createdAt: log.createdAt.toISOString(),
  };
}

function toWebOrderDto(order: WebOrderWithRelations): WebOrderDto {
  return {
    id: order.id,
    customerId: order.customerId,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    customerPhone: order.customer.phone,
    status: order.status,
    totalCents: order.totalCents,
    notes: order.notes,
    addressId: order.addressId,
    addressStreet: order.addressStreet,
    addressNumber: order.addressNumber,
    addressComplement: order.addressComplement,
    addressNeighborhood: order.addressNeighborhood,
    addressCity: order.addressCity,
    addressState: order.addressState,
    addressZip: order.addressZip,
    addressReference: order.addressReference,
    items: order.items.map(toItemDto),
    statusLogs: order.statusLogs.map(toStatusLogDto),
    statusUpdatedAt: order.statusUpdatedAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

type AddressSnapshot = {
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  addressReference: string | null;
};

const EMPTY_ADDRESS: AddressSnapshot = {
  addressStreet: null,
  addressNumber: null,
  addressComplement: null,
  addressNeighborhood: null,
  addressCity: null,
  addressState: null,
  addressZip: null,
  addressReference: null,
};

export async function createWebOrder(
  customerId: string,
  rawInput: unknown,
  ipAddress: string,
): Promise<WebOrderDto> {
  const input = webOrderCreateInputSchema.parse(rawInput);

  const result = await db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });

    if (!customer) {
      throw new AppError(404, "customer_not_found", "Cliente não encontrado.");
    }

    let snapshot: AddressSnapshot = { ...EMPTY_ADDRESS };
    let resolvedAddressId: string | null = null;

    if (input.addressId) {
      const address = await tx.customerAddress.findFirst({
        where: { id: input.addressId, customerId },
      });

      if (!address) {
        throw new AppError(404, "address_not_found", "Endereço não encontrado.");
      }

      snapshot = {
        addressStreet: address.street,
        addressNumber: address.number,
        addressComplement: address.complement,
        addressNeighborhood: address.neighborhood,
        addressCity: address.city,
        addressState: address.state,
        addressZip: address.zip,
        addressReference: address.reference,
      };
      resolvedAddressId = address.id;
    } else if (input.address) {
      const inline = input.address;
      snapshot = {
        addressStreet: inline.street ?? null,
        addressNumber: inline.number ?? null,
        addressComplement: inline.complement ?? null,
        addressNeighborhood: inline.neighborhood ?? null,
        addressCity: inline.city ?? null,
        addressState: inline.state ?? null,
        addressZip: inline.zip ?? null,
        addressReference: inline.reference ?? null,
      };
    }

    const productIds = input.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((product) => product.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      throw new AppError(
        400,
        "product_unavailable",
        "Algum produto do pedido não está mais disponível.",
        { missingProductIds: missing },
        "Atualize seu carrinho e tente novamente.",
      );
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    let totalCents = 0;
    const itemRows: Prisma.WebOrderItemCreateManyWebOrderInput[] = [];

    for (const item of input.items) {
      const product = productById.get(item.productId)!;
      const lineTotal = product.priceCents * item.quantity;
      totalCents += lineTotal;
      itemRows.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPriceCents: product.priceCents,
        lineTotalCents: lineTotal,
      });
    }

    for (const item of input.items) {
      const product = productById.get(item.productId)!;
      const updated = await tx.product.update({
        where: { id: product.id },
        data: { stockQty: { decrement: item.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          actorUserId: null,
          quantityDelta: -item.quantity,
          resultingStock: updated.stockQty,
          reason: "web_order_create",
          referenceType: "web_order",
          notes: `Pedido web do cliente ${customer.id}`,
        },
      });

      if (updated.stockQty < 0) {
        logger.warn("web_order_stock_negative", {
          productId: product.id,
          stockQty: updated.stockQty,
        });
      }
    }

    const created = await tx.webOrder.create({
      data: {
        customerId,
        status: WebOrderStatus.PENDING_PAYMENT,
        deliveryMode: input.deliveryMode,
        totalCents,
        notes: input.notes ?? null,
        addressId: resolvedAddressId,
        addressStreet: snapshot.addressStreet,
        addressNumber: snapshot.addressNumber,
        addressComplement: snapshot.addressComplement,
        addressNeighborhood: snapshot.addressNeighborhood,
        addressCity: snapshot.addressCity,
        addressState: snapshot.addressState,
        addressZip: snapshot.addressZip,
        addressReference: snapshot.addressReference,
        items: { createMany: { data: itemRows } },
        statusLogs: {
          create: {
            fromStatus: null,
            toStatus: WebOrderStatus.PENDING_PAYMENT,
            actorType: WebOrderStatusActorType.system,
            notes: "Pedido criado",
          },
        },
      },
      include: webOrderInclude,
    });

    return created;
  });

  await logAuditEvent({
    action: "web_order.create",
    entityType: "web_order",
    entityId: result.id,
    ipAddress,
    metadata: { customerId, totalCents: result.totalCents, itemCount: result.items.length },
  });

  logger.info("web_order_created", { orderId: result.id, totalCents: result.totalCents });

  void sendNewOrderPushToAdmins({
    orderId: result.id,
    customerName: result.customer.name,
    totalCents: result.totalCents,
  }).catch((err) => {
    logger.error("push admin falhou ao notificar novo pedido", {
      err: err instanceof Error ? err.message : String(err),
      orderId: result.id,
    });
  });

  return toWebOrderDto(result);
}

export async function listWebOrders(filters: WebOrderListFilters): Promise<{
  items: WebOrderDto[];
  total: number;
  take: number;
  skip: number;
}> {
  await maybeExpirePendingOrders();

  const where: Prisma.WebOrderWhereInput = {};

  if (filters.status?.length) {
    where.status = { in: filters.status };
  }

  if (filters.customerId) {
    where.customerId = filters.customerId;
  }

  if (filters.query) {
    where.customer = {
      OR: [
        { name: { contains: filters.query, mode: "insensitive" } },
        { phone: { contains: filters.query.replace(/\D+/g, "") } },
      ],
    };
  }

  const [items, total] = await Promise.all([
    db.webOrder.findMany({
      where,
      include: webOrderInclude,
      orderBy: { createdAt: "desc" },
      take: filters.take,
      skip: filters.skip,
    }),
    db.webOrder.count({ where }),
  ]);

  return {
    items: items.map(toWebOrderDto),
    total,
    take: filters.take,
    skip: filters.skip,
  };
}

export async function getWebOrder(orderId: string): Promise<WebOrderDto | null> {
  const order = await db.webOrder.findUnique({
    where: { id: orderId },
    include: webOrderInclude,
  });

  return order ? toWebOrderDto(order) : null;
}

export async function updateWebOrderStatus(
  orderId: string,
  toStatus: WebOrderStatus,
  actorUserId: string,
  ipAddress: string,
  notes?: string | null,
): Promise<WebOrderDto> {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.webOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new AppError(404, "web_order_not_found", "Pedido web não encontrado.");
    }

    if (!isValidTransition(order.status, toStatus)) {
      throw new AppError(
        409,
        "invalid_web_order_transition",
        `Transição inválida: ${order.status} → ${toStatus}.`,
        { from: order.status, to: toStatus },
        "Atualize a tela para ver o status atual do pedido.",
      );
    }

    if (toStatus === WebOrderStatus.CANCELLED && cancelingRevertsStock(order.status)) {
      for (const item of order.items) {
        const updated = await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            actorUserId,
            quantityDelta: item.quantity,
            resultingStock: updated.stockQty,
            reason: "web_order_cancel_reversal",
            referenceType: "web_order",
            referenceId: order.id,
          },
        });
      }
    }

    return tx.webOrder.update({
      where: { id: orderId },
      data: {
        status: toStatus,
        statusUpdatedAt: new Date(),
        statusLogs: {
          create: {
            fromStatus: order.status,
            toStatus,
            actorUserId,
            actorType: WebOrderStatusActorType.admin,
            notes: notes ?? null,
          },
        },
      },
      include: webOrderInclude,
    });
  });

  await logAuditEvent({
    actorUserId,
    action: "web_order.status.change",
    entityType: "web_order",
    entityId: orderId,
    ipAddress,
    metadata: { toStatus, notes: notes ?? null },
  });

  logger.info("web_order_status_changed", { orderId, toStatus });
  return toWebOrderDto(result);
}

export async function getWebOrderWithAccessLog(
  orderId: string,
  actorUserId: string,
  ipAddress: string,
): Promise<WebOrderDto> {
  const order = await getWebOrder(orderId);

  if (!order) {
    throw new AppError(404, "web_order_not_found", "Pedido web não encontrado.");
  }

  await logAuditEvent({
    actorUserId,
    action: "web_order.detail.access",
    entityType: "web_order",
    entityId: orderId,
    ipAddress,
    metadata: { customerId: order.customerId },
  });

  return order;
}

export async function expirePendingWebOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_TTL_MINUTES * 60 * 1000);
  const expired = await db.webOrder.findMany({
    where: { status: WebOrderStatus.PENDING_PAYMENT, createdAt: { lt: cutoff } },
    include: { items: true },
  });

  let count = 0;

  for (const order of expired) {
    await db.$transaction(async (tx) => {
      const current = await tx.webOrder.findUnique({ where: { id: order.id } });

      if (!current || current.status !== WebOrderStatus.PENDING_PAYMENT) {
        return;
      }

      for (const item of order.items) {
        const updated = await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            actorUserId: null,
            quantityDelta: item.quantity,
            resultingStock: updated.stockQty,
            reason: "web_order_cancel_reversal",
            referenceType: "web_order",
            referenceId: order.id,
          },
        });
      }

      await tx.webOrder.update({
        where: { id: order.id },
        data: {
          status: WebOrderStatus.CANCELLED,
          statusUpdatedAt: new Date(),
          statusLogs: {
            create: {
              fromStatus: WebOrderStatus.PENDING_PAYMENT,
              toStatus: WebOrderStatus.CANCELLED,
              actorType: WebOrderStatusActorType.system,
              notes: "TTL expired",
            },
          },
        },
      });

      count += 1;

      await logAuditEvent({
        action: "web_order.cancel.timeout",
        entityType: "web_order",
        entityId: order.id,
        metadata: { ttlMinutes: PENDING_TTL_MINUTES },
      });
    });
  }

  if (count > 0) {
    logger.info("web_order_expired_pending", { count });
  }

  return count;
}

export async function maybeExpirePendingOrders() {
  const now = Date.now();

  if (now - lastExpirationRunAt < EXPIRATION_DEBOUNCE_MS) {
    return;
  }

  lastExpirationRunAt = now;
  await expirePendingWebOrders().catch((error) => {
    logger.error("web_order_expire_failed", { error: (error as Error).message });
  });
}
