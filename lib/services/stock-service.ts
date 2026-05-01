import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  createStockMovementInputSchema,
  type StockMovementDto,
} from "@/lib/schemas/stock";
import { logAuditEvent } from "@/lib/services/audit-service";

function toStockMovementDto(movement: {
  id: string;
  productId: string;
  quantityDelta: number;
  resultingStock: number;
  reason: StockMovementDto["reason"];
  notes: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date;
  product: { name: string };
  actor: { name: string } | null;
}): StockMovementDto {
  return {
    id: movement.id,
    productId: movement.productId,
    productName: movement.product.name,
    actorName: movement.actor?.name ?? null,
    quantityDelta: movement.quantityDelta,
    resultingStock: movement.resultingStock,
    reason: movement.reason,
    notes: movement.notes,
    referenceType: movement.referenceType,
    referenceId: movement.referenceId,
    createdAt: movement.createdAt.toISOString(),
  };
}

export async function listStockMovements(limit = 80) {
  const movements = await db.stockMovement.findMany({
    include: {
      product: true,
      actor: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return movements.map(toStockMovementDto);
}

export async function createManualStockMovement(
  rawInput: unknown,
  actorUserId: string,
  ipAddress: string,
) {
  const input = await createStockMovementInputSchema.parseAsync(rawInput);

  const movement = await db.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id: input.productId },
      data: {
        stockQty: {
          increment: input.quantity,
        },
      },
    });

    const createdMovement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        actorUserId,
        quantityDelta: input.quantity,
        resultingStock: updatedProduct.stockQty,
        reason: input.reason,
        notes: input.notes,
        referenceType: "manual",
      },
      include: {
        product: true,
        actor: true,
      },
    });

    return createdMovement;
  });

  await logAuditEvent({
    actorUserId,
    action: "stock_movement_created",
    entityType: "stock_movement",
    entityId: movement.id,
    ipAddress,
    metadata: {
      productId: movement.productId,
      reason: movement.reason,
      quantityDelta: movement.quantityDelta,
      resultingStock: movement.resultingStock,
    },
  });

  logger.info("stock_movement_created", {
    userId: actorUserId,
    entityId: movement.id,
    productId: movement.productId,
    reason: movement.reason,
    quantityDelta: movement.quantityDelta,
    resultingStock: movement.resultingStock,
  });

  if (movement.resultingStock < 0) {
    logger.warn("stock_negative_after_manual_movement", {
      userId: actorUserId,
      entityId: movement.id,
      productId: movement.productId,
      reason: movement.reason,
      resultingStock: movement.resultingStock,
    });
  }

  return toStockMovementDto(movement);
}

export async function getStockAlertCounts() {
  const products = await db.product.findMany({
    select: {
      stockQty: true,
      minimumStock: true,
    },
  });

  const lowStockCount = products.filter((product) => product.stockQty <= product.minimumStock).length;
  const negativeStockCount = products.filter((product) => product.stockQty < 0).length;

  return {
    lowStockCount,
    negativeStockCount,
  };
}
