import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  createProductInputSchema,
  updateProductInputSchema,
  type ProductDto,
} from "@/lib/schemas/product";
import { logAuditEvent } from "@/lib/services/audit-service";

function toProductDto(product: {
  id: string;
  name: string;
  sku: string | null;
  barcode: string;
  category: string | null;
  imagePath: string | null;
  unit: string;
  priceCents: number;
  costCents: number | null;
  stockQty: number;
  minimumStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProductDto {
  return {
    ...product,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function logProductStockWarning(product: {
  id: string;
  stockQty: number;
  minimumStock: number;
}, actorUserId: string) {
  if (product.stockQty < 0) {
    logger.warn("product_stock_negative", {
      userId: actorUserId,
      entityId: product.id,
      stockQty: product.stockQty,
      minimumStock: product.minimumStock,
    });
    return;
  }

  if (product.stockQty <= product.minimumStock) {
    logger.warn("product_stock_low", {
      userId: actorUserId,
      entityId: product.id,
      stockQty: product.stockQty,
      minimumStock: product.minimumStock,
    });
  }
}

function handleProductWriteError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new AppError(
      409,
      "product_conflict",
      "SKU ou código de barras já cadastrado.",
      null,
      "Use um SKU diferente ou revise o código de barras informado.",
    );
  }

  throw error;
}

export async function listProducts() {
  const products = await db.product.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return products.map(toProductDto);
}

export async function createProduct(rawInput: unknown, actorUserId: string, ipAddress: string) {
  const input = await createProductInputSchema.parseAsync(rawInput);

  try {
    const product = await db.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: input,
      });

      if (createdProduct.stockQty !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: createdProduct.id,
            actorUserId,
            quantityDelta: createdProduct.stockQty,
            resultingStock: createdProduct.stockQty,
            reason: "manual_entry",
            notes: "Estoque inicial no cadastro do produto",
            referenceType: "product",
            referenceId: createdProduct.id,
          },
        });
      }

      return createdProduct;
    });

    await logAuditEvent({
      actorUserId,
      action: "product_created",
      entityType: "product",
      entityId: product.id,
      ipAddress,
      metadata: { hasSku: product.sku != null },
    });

    logger.info("product_created", {
      userId: actorUserId,
      entityId: product.id,
      stockQty: product.stockQty,
      minimumStock: product.minimumStock,
    });
    logProductStockWarning(product, actorUserId);

    return toProductDto(product);
  } catch (error) {
    handleProductWriteError(error);
    throw error;
  }
}

export async function updateProduct(rawInput: unknown, actorUserId: string, ipAddress: string) {
  const input = await updateProductInputSchema.parseAsync(rawInput);

  try {
    const product = await db.$transaction(async (tx) => {
      const currentProduct = await tx.product.findUnique({
        where: { id: input.id },
      });

      if (!currentProduct) {
        throw new AppError(
          404,
          "product_not_found",
          "Produto não encontrado.",
          null,
          "Atualize a listagem e tente editar novamente.",
        );
      }

      const stockDelta = input.stockQty - currentProduct.stockQty;

      const updatedProduct = await tx.product.update({
        where: { id: input.id },
        data: {
          name: input.name,
          sku: input.sku,
          barcode: input.barcode,
          category: input.category,
          imagePath: input.imagePath,
          unit: input.unit,
          priceCents: input.priceCents,
          costCents: input.costCents,
          stockQty: input.stockQty,
          minimumStock: input.minimumStock,
          isActive: input.isActive,
        },
      });

      if (stockDelta !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: updatedProduct.id,
            actorUserId,
            quantityDelta: stockDelta,
            resultingStock: updatedProduct.stockQty,
            reason: "manual_adjustment",
            notes: "Ajuste pelo cadastro do produto",
            referenceType: "product",
            referenceId: updatedProduct.id,
          },
        });
      }

      return updatedProduct;
    });

    await logAuditEvent({
      actorUserId,
      action: "product_updated",
      entityType: "product",
      entityId: product.id,
      ipAddress,
      metadata: { hasSku: product.sku != null },
    });

    logger.info("product_updated", {
      userId: actorUserId,
      entityId: product.id,
      stockQty: product.stockQty,
      minimumStock: product.minimumStock,
    });
    logProductStockWarning(product, actorUserId);

    return toProductDto(product);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new AppError(
        404,
        "product_not_found",
        "Produto não encontrado.",
        null,
        "Atualize a listagem e tente editar novamente.",
      );
    }

    handleProductWriteError(error);
    throw error;
  }
}
