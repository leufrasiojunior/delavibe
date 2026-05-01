import { CommandaStatus, Prisma } from "@prisma/client";

import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  addCommandaItemInputSchema,
  closeCommandaInputSchema,
  createCommandaInputSchema,
  type CommandaListStatusFilter,
  type CommandaDto,
  updateCommandaCustomerNameInputSchema,
} from "@/lib/schemas/commanda";
import { calculateCommandaTotals, sumPaymentCents } from "@/lib/utils/totals";
import { logAuditEvent } from "@/lib/services/audit-service";

const commandaInclude = {
  operator: true,
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      product: true,
    },
  },
  payments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      operator: true,
    },
  },
};

type CommandaWithRelations = Prisma.CommandaGetPayload<{
  include: typeof commandaInclude;
}>;

function toCommandaDto(commanda: CommandaWithRelations): CommandaDto {
  return {
    id: commanda.id,
    number: commanda.number,
    status: commanda.status,
    customerName: commanda.customerName,
    notes: commanda.notes,
    subtotalCents: commanda.subtotalCents,
    discountCents: commanda.discountCents,
    totalCents: commanda.totalCents,
    operatorId: commanda.operatorId,
    operatorName: commanda.operator.name,
    items: commanda.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      productSku: item.product.sku ?? item.product.barcode,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      subtotalCents: item.subtotalCents,
      stockAfter: null,
      createdAt: item.createdAt.toISOString(),
    })),
    payments: commanda.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      amountCents: payment.amountCents,
      notes: payment.notes,
      operatorName: payment.operator.name,
      createdAt: payment.createdAt.toISOString(),
    })),
    createdAt: commanda.createdAt.toISOString(),
    closedAt: commanda.closedAt?.toISOString() ?? null,
    cancelledAt: commanda.cancelledAt?.toISOString() ?? null,
  };
}

async function loadCommandaOrThrow(tx: Prisma.TransactionClient, commandaId: string) {
  const commanda = await tx.commanda.findUnique({
    where: { id: commandaId },
    include: commandaInclude,
  });

  if (!commanda) {
    throw new AppError(
      404,
      "commanda_not_found",
      "Comanda não encontrada.",
      null,
      "Atualize a tela para carregar a lista mais recente de comandas.",
    );
  }

  return commanda;
}

async function recalculateOpenCommandaTotals(tx: Prisma.TransactionClient, commandaId: string) {
  const items = await tx.comandaItem.findMany({
    where: { comandaId: commandaId },
    select: { subtotalCents: true },
  });

  const totals = calculateCommandaTotals(items);

  return tx.commanda.update({
    where: { id: commandaId },
    data: totals,
    include: commandaInclude,
  });
}

type CommandaListFilters = {
  status?: CommandaListStatusFilter;
  query?: string | null;
};

function buildCommandaWhere(status: "open" | "closed", query?: string | null) {
  const where: Prisma.CommandaWhereInput = {
    status,
  };
  const normalizedQuery = query?.trim();

  if (normalizedQuery) {
    where.customerName = {
      contains: normalizedQuery,
      mode: "insensitive",
    };
  }

  return where;
}

export async function listCommandas(filters: CommandaListFilters = {}) {
  const status = filters.status ?? "open";

  if (status === "all") {
    const [openCommandas, closedCommandas] = await Promise.all([
      db.commanda.findMany({
        where: buildCommandaWhere(CommandaStatus.open, filters.query),
        include: commandaInclude,
        orderBy: { createdAt: "asc" },
      }),
      db.commanda.findMany({
        where: buildCommandaWhere(CommandaStatus.closed, filters.query),
        include: commandaInclude,
        orderBy: { closedAt: "desc" },
      }),
    ]);

    return [...openCommandas, ...closedCommandas].map(toCommandaDto);
  }

  const commandas = await db.commanda.findMany({
    where: buildCommandaWhere(status === "closed" ? CommandaStatus.closed : CommandaStatus.open, filters.query),
    include: commandaInclude,
    orderBy: status === "closed" ? { closedAt: "desc" } : { createdAt: "asc" },
  });

  return commandas.map(toCommandaDto);
}

export async function listOpenCommandas() {
  return listCommandas({ status: "open" });
}

export async function createCommanda(rawInput: unknown, actorUserId: string, ipAddress: string) {
  const input = await createCommandaInputSchema.parseAsync(rawInput);

  const commanda = await db.commanda.create({
    data: {
      customerName: input.customerName,
      notes: input.notes,
      operatorId: actorUserId,
    },
    include: commandaInclude,
  });

  await logAuditEvent({
    actorUserId,
    action: "commanda_created",
    entityType: "commanda",
    entityId: commanda.id,
    ipAddress,
    metadata: { number: commanda.number },
  });

  logger.info("commanda_created", {
    userId: actorUserId,
    entityId: commanda.id,
    commandaNumber: commanda.number,
  });

  return toCommandaDto(commanda);
}

export async function updateCommandaCustomerName(
  commandaId: string,
  rawInput: unknown,
  actorUserId: string,
  ipAddress: string,
) {
  const input = await updateCommandaCustomerNameInputSchema.parseAsync(rawInput);

  const existingCommanda = await db.commanda.findUnique({
    where: { id: commandaId },
    select: {
      id: true,
      number: true,
      customerName: true,
    },
  });

  if (!existingCommanda) {
    throw new AppError(
      404,
      "commanda_not_found",
      "Comanda não encontrada.",
      null,
      "Atualize a tela para carregar a lista mais recente de comandas.",
    );
  }

  const updatedCommanda = await db.commanda.update({
    where: { id: commandaId },
    data: {
      customerName: input.customerName,
    },
    include: commandaInclude,
  });

  await logAuditEvent({
    actorUserId,
    action: "commanda_customer_renamed",
    entityType: "commanda",
    entityId: commandaId,
    ipAddress,
    metadata: {
      number: existingCommanda.number,
      previousCustomerName: existingCommanda.customerName,
      currentCustomerName: input.customerName,
    },
  });

  logger.info("commanda_customer_renamed", {
    userId: actorUserId,
    entityId: commandaId,
    previousCustomerName: existingCommanda.customerName,
    currentCustomerName: input.customerName,
  });

  return toCommandaDto(updatedCommanda);
}

export async function addItemToCommanda(
  commandaId: string,
  rawInput: unknown,
  actorUserId: string,
  ipAddress: string,
) {
  const input = await addCommandaItemInputSchema.parseAsync(rawInput);

  const result = await db.$transaction(async (tx) => {
    const commanda = await loadCommandaOrThrow(tx, commandaId);

    if (commanda.status !== CommandaStatus.open) {
      throw new AppError(
        409,
        "commanda_closed",
        "A comanda não está aberta para edição.",
        null,
        "Abra uma nova comanda para continuar a venda.",
      );
    }

    const product = await tx.product.findUnique({
      where: { id: input.productId },
    });

    if (!product || !product.isActive) {
      throw new AppError(
        404,
        "product_not_found",
        "Produto não encontrado ou inativo.",
        null,
        "Revise o catálogo e tente novamente com um produto ativo.",
      );
    }

    const item = await tx.comandaItem.create({
      data: {
        comandaId: commandaId,
        productId: input.productId,
        quantity: input.quantity,
        unitPriceCents: product.priceCents,
        subtotalCents: product.priceCents * input.quantity,
      },
    });

    const updatedProduct = await tx.product.update({
      where: { id: product.id },
      data: {
        stockQty: {
          increment: -input.quantity,
        },
      },
    });

    await tx.stockMovement.create({
      data: {
        productId: product.id,
        actorUserId,
        quantityDelta: -input.quantity,
        resultingStock: updatedProduct.stockQty,
        reason: "comanda_item_add",
        referenceType: "commanda_item",
        referenceId: item.id,
      },
    });

    const updatedCommanda = await recalculateOpenCommandaTotals(tx, commandaId);

    return {
      commanda: updatedCommanda,
      warning:
        updatedProduct.stockQty < 0
          ? `Estoque negativo para ${product.name}: saldo atual ${updatedProduct.stockQty}.`
          : updatedProduct.stockQty <= product.minimumStock
            ? `Estoque baixo para ${product.name}: saldo atual ${updatedProduct.stockQty}.`
            : null,
    };
  });

  await logAuditEvent({
    actorUserId,
    action: "commanda_item_added",
    entityType: "commanda",
    entityId: commandaId,
    ipAddress,
    metadata: {
      productId: input.productId,
      quantity: input.quantity,
    },
  });

  logger.info("commanda_item_added", {
    userId: actorUserId,
    entityId: commandaId,
    productId: input.productId,
    quantity: input.quantity,
  });

  if (result.warning) {
    logger.warn("commanda_stock_warning", {
      userId: actorUserId,
      entityId: commandaId,
      warning: result.warning,
    });
  }

  return {
    commanda: toCommandaDto(result.commanda),
    warning: result.warning,
  };
}

export async function removeItemFromCommanda(
  commandaId: string,
  itemId: string,
  actorUserId: string,
  ipAddress: string,
) {
  const result = await db.$transaction(async (tx) => {
    const item = await tx.comandaItem.findUnique({
      where: { id: itemId },
      include: {
        product: true,
        comanda: true,
      },
    });

    if (!item || item.comandaId !== commandaId) {
      throw new AppError(
        404,
        "item_not_found",
        "Item da comanda não encontrado.",
        null,
        "Atualize a comanda antes de tentar remover o item novamente.",
      );
    }

    if (item.comanda.status !== CommandaStatus.open) {
      throw new AppError(
        409,
        "commanda_closed",
        "A comanda não está aberta para edição.",
        null,
        "Somente comandas abertas podem ser alteradas.",
      );
    }

    const updatedProduct = await tx.product.update({
      where: { id: item.productId },
      data: {
        stockQty: {
          increment: item.quantity,
        },
      },
    });

    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        actorUserId,
        quantityDelta: item.quantity,
        resultingStock: updatedProduct.stockQty,
        reason: "comanda_item_remove",
        referenceType: "commanda_item",
        referenceId: item.id,
      },
    });

    await tx.comandaItem.delete({
      where: { id: item.id },
    });

    const commanda = await recalculateOpenCommandaTotals(tx, commandaId);
    return commanda;
  });

  await logAuditEvent({
    actorUserId,
    action: "commanda_item_removed",
    entityType: "commanda",
    entityId: commandaId,
    ipAddress,
    metadata: { itemId },
  });

  logger.info("commanda_item_removed", {
    userId: actorUserId,
    entityId: commandaId,
    itemId,
  });

  return {
    commanda: toCommandaDto(result),
    warning: null,
  };
}

export async function cancelCommanda(commandaId: string, actorUserId: string, ipAddress: string) {
  const result = await db.$transaction(async (tx) => {
    const commanda = await loadCommandaOrThrow(tx, commandaId);

    if (commanda.status !== CommandaStatus.open) {
      throw new AppError(
        409,
        "commanda_closed",
        "Só é possível cancelar comandas abertas.",
        null,
        "Escolha uma comanda ainda aberta para cancelamento.",
      );
    }

    for (const item of commanda.items) {
      const updatedProduct = await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQty: {
            increment: item.quantity,
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          actorUserId,
          quantityDelta: item.quantity,
          resultingStock: updatedProduct.stockQty,
          reason: "comanda_cancel_reversal",
          referenceType: "commanda",
          referenceId: commanda.id,
        },
      });
    }

    return tx.commanda.update({
      where: { id: commandaId },
      data: {
        status: CommandaStatus.cancelled,
        cancelledAt: new Date(),
      },
      include: commandaInclude,
    });
  });

  await logAuditEvent({
    actorUserId,
    action: "commanda_cancelled",
    entityType: "commanda",
    entityId: commandaId,
    ipAddress,
  });

  logger.info("commanda_cancelled", {
    userId: actorUserId,
    entityId: commandaId,
  });

  return {
    commanda: toCommandaDto(result),
    warning: null,
  };
}

export async function closeCommanda(
  commandaId: string,
  rawInput: unknown,
  actorUserId: string,
  ipAddress: string,
) {
  const input = await closeCommandaInputSchema.parseAsync(rawInput);

  const result = await db.$transaction(async (tx) => {
    const commanda = await loadCommandaOrThrow(tx, commandaId);

    if (commanda.status !== CommandaStatus.open) {
      throw new AppError(
        409,
        "commanda_closed",
        "A comanda já foi finalizada.",
        null,
        "Selecione outra comanda aberta para registrar uma nova venda.",
      );
    }

    if (commanda.items.length === 0) {
      throw new AppError(
        409,
        "empty_commanda",
        "A comanda precisa ter itens antes do fechamento.",
        null,
        "Adicione pelo menos um produto antes de finalizar a venda.",
      );
    }

    const paymentTotal = sumPaymentCents(input.payments);

    if (paymentTotal !== commanda.totalCents) {
      logger.warn("commanda_payment_total_mismatch", {
        userId: actorUserId,
        entityId: commandaId,
        expectedTotalCents: commanda.totalCents,
        receivedTotalCents: paymentTotal,
        paymentCount: input.payments.length,
      });

      throw new AppError(
        422,
        "invalid_payment_total",
        "O total dos pagamentos precisa ser igual ao total da comanda.",
        { expected: commanda.totalCents, received: paymentTotal },
        "Confira se a soma das formas de pagamento bate com o total da venda.",
      );
    }

    await tx.payment.createMany({
      data: input.payments.map((payment) => ({
        comandaId: commanda.id,
        operatorId: actorUserId,
        method: payment.method,
        amountCents: payment.amountCents,
        notes: payment.notes,
      })),
    });

    return tx.commanda.update({
      where: { id: commandaId },
      data: {
        status: CommandaStatus.closed,
        closedAt: new Date(),
      },
      include: commandaInclude,
    });
  });

  await logAuditEvent({
    actorUserId,
    action: "commanda_closed",
    entityType: "commanda",
    entityId: commandaId,
    ipAddress,
    metadata: { paymentCount: input.payments.length },
  });

  logger.info("commanda_closed", {
    userId: actorUserId,
    entityId: commandaId,
    paymentCount: input.payments.length,
  });

  return {
    commanda: toCommandaDto(result),
    warning: null,
  };
}

export async function reopenCommanda(commandaId: string, actorUserId: string, ipAddress: string) {
  const result = await db.$transaction(async (tx) => {
    const commanda = await loadCommandaOrThrow(tx, commandaId);

    if (commanda.status !== CommandaStatus.closed) {
      throw new AppError(
        409,
        "commanda_not_reopenable",
        "Só é possível reabrir comandas já fechadas.",
        null,
        "Selecione uma comanda fechada para voltar a editar os itens.",
      );
    }

    const deletedPayments = await tx.payment.deleteMany({
      where: { comandaId: commandaId },
    });

    const reopenedCommanda = await tx.commanda.update({
      where: { id: commandaId },
      data: {
        status: CommandaStatus.open,
        closedAt: null,
      },
      include: commandaInclude,
    });

    return {
      commanda: reopenedCommanda,
      deletedPaymentsCount: deletedPayments.count,
    };
  });

  await logAuditEvent({
    actorUserId,
    action: "commanda_reopened",
    entityType: "commanda",
    entityId: commandaId,
    ipAddress,
    metadata: { deletedPaymentsCount: result.deletedPaymentsCount },
  });

  logger.info("commanda_reopened", {
    userId: actorUserId,
    entityId: commandaId,
    deletedPaymentsCount: result.deletedPaymentsCount,
  });

  return {
    commanda: toCommandaDto(result.commanda),
    warning: null,
  };
}

type SalesFilters = {
  startDate?: Date | null;
  endDate?: Date | null;
  operatorId?: string | null;
  paymentMethod?: "cash" | "pix" | "debit" | "credit" | null;
};

export async function listClosedCommandas(filters: SalesFilters = {}) {
  const where: Prisma.CommandaWhereInput = {
    status: CommandaStatus.closed,
  };

  const closedAtFilter: Prisma.DateTimeNullableFilter = {};

  if (filters.startDate) {
    closedAtFilter.gte = filters.startDate;
  }

  if (filters.endDate) {
    closedAtFilter.lte = filters.endDate;
  }

  if (filters.startDate || filters.endDate) {
    where.closedAt = closedAtFilter;
  }

  if (filters.operatorId) {
    where.operatorId = filters.operatorId;
  }

  if (filters.paymentMethod) {
    where.payments = {
      some: {
        method: filters.paymentMethod,
      },
    };
  }

  const commandas = await db.commanda.findMany({
    where,
    include: commandaInclude,
    orderBy: { closedAt: "desc" },
    take: 100,
  });

  return commandas.map(toCommandaDto);
}
