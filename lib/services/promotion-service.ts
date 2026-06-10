import { Prisma, PromotionType } from "@prisma/client";

import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";
import {
  createPromotionInputSchema,
  type PromotionDto,
  type PromotionSnapshotDto,
  updatePromotionInputSchema,
} from "@/lib/schemas/promotion";
import type { PublicProductDto } from "@/lib/schemas/product";
import { logAuditEvent } from "@/lib/services/audit-service";

export type PromotionTarget = "local" | "site";
export type PromotionStatus = "active" | "scheduled" | "expired" | "inactive";

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  [PromotionType.local]: "Somente consumo local",
  [PromotionType.site]: "Somente site",
  [PromotionType.both]: "Ambos",
};

type PromotionCandidate = {
  id: string;
  type: PromotionType;
  promotionalPriceCents: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
};

type PromotionWithProduct = Prisma.PromotionGetPayload<{
  include: { product: true };
}>;

type PublicProductSource = Prisma.ProductGetPayload<{
  include: { promotions: true };
}>;

export function promotionAppliesToTarget(type: PromotionType, target: PromotionTarget) {
  if (type === PromotionType.both) {
    return true;
  }

  return target === "local" ? type === PromotionType.local : type === PromotionType.site;
}

export function promotionTypesOverlap(left: PromotionType, right: PromotionType) {
  return (
    promotionAppliesToTarget(left, "local") && promotionAppliesToTarget(right, "local")
  ) || (
    promotionAppliesToTarget(left, "site") && promotionAppliesToTarget(right, "site")
  );
}

export function periodsOverlap(
  leftStartsAt: Date,
  leftEndsAt: Date,
  rightStartsAt: Date,
  rightEndsAt: Date,
) {
  return leftStartsAt < rightEndsAt && rightStartsAt < leftEndsAt;
}

export function getPromotionStatus(
  promotion: Pick<PromotionCandidate, "isActive" | "startsAt" | "endsAt">,
  now = new Date(),
): PromotionStatus {
  if (!promotion.isActive) {
    return "inactive";
  }

  if (promotion.startsAt > now) {
    return "scheduled";
  }

  if (promotion.endsAt <= now) {
    return "expired";
  }

  return "active";
}

export function selectActivePromotionForTarget<TPromotion extends PromotionCandidate>(
  promotions: TPromotion[],
  target: PromotionTarget,
  basePriceCents: number,
  now = new Date(),
) {
  const applicable = promotions
    .filter((promotion) => (
      getPromotionStatus(promotion, now) === "active" &&
      promotionAppliesToTarget(promotion.type, target) &&
      promotion.promotionalPriceCents < basePriceCents
    ))
    .sort((left, right) => {
      const byPrice = left.promotionalPriceCents - right.promotionalPriceCents;
      if (byPrice !== 0) {
        return byPrice;
      }

      return right.startsAt.getTime() - left.startsAt.getTime();
    });

  return applicable[0] ?? null;
}

export function toPromotionSnapshot(
  promotion: Pick<PromotionCandidate, "id" | "type" | "promotionalPriceCents" | "startsAt" | "endsAt">,
): PromotionSnapshotDto {
  return {
    id: promotion.id,
    type: promotion.type,
    promotionalPriceCents: promotion.promotionalPriceCents,
    startsAt: promotion.startsAt.toISOString(),
    endsAt: promotion.endsAt.toISOString(),
  };
}

export function toPublicProductDto(product: PublicProductSource, now = new Date()): PublicProductDto {
  const promotion = selectActivePromotionForTarget(
    product.promotions,
    "site",
    product.priceCents,
    now,
  );

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    imagePath: product.imagePath,
    unit: product.unit,
    priceCents: product.priceCents,
    effectivePriceCents: promotion?.promotionalPriceCents ?? product.priceCents,
    promotion: promotion ? toPromotionSnapshot(promotion) : null,
    stockQty: product.stockQty,
    minimumStock: product.minimumStock,
    isActive: product.isActive,
    updatedAt: product.updatedAt.toISOString(),
  };
}

export async function listPublicProductsWithPromotions(where: Prisma.ProductWhereInput = {}) {
  const now = new Date();
  const products = await db.product.findMany({
    where: { isActive: true, ...where },
    include: {
      promotions: {
        where: {
          isActive: true,
          startsAt: { lte: now },
          endsAt: { gt: now },
          type: { in: [PromotionType.site, PromotionType.both] },
        },
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return products.map((product) => toPublicProductDto(product, now));
}

function toPromotionDto(promotion: PromotionWithProduct): PromotionDto {
  return {
    id: promotion.id,
    productId: promotion.productId,
    product: {
      id: promotion.product.id,
      name: promotion.product.name,
      sku: promotion.product.sku,
      barcode: promotion.product.barcode,
      category: promotion.product.category,
      priceCents: promotion.product.priceCents,
      imagePath: promotion.product.imagePath,
      updatedAt: promotion.product.updatedAt.toISOString(),
    },
    type: promotion.type,
    promotionalPriceCents: promotion.promotionalPriceCents,
    startsAt: promotion.startsAt.toISOString(),
    endsAt: promotion.endsAt.toISOString(),
    isActive: promotion.isActive,
    createdAt: promotion.createdAt.toISOString(),
    updatedAt: promotion.updatedAt.toISOString(),
  };
}

function promotionTypesConflictingWith(type: PromotionType) {
  if (type === PromotionType.both) {
    return [PromotionType.local, PromotionType.site, PromotionType.both];
  }

  return [type, PromotionType.both];
}

async function validatePromotionInput(
  tx: Prisma.TransactionClient,
  input: {
    id?: string;
    productId: string;
    type: PromotionType;
    promotionalPriceCents: number;
    startsAt: Date;
    endsAt: Date;
    isActive: boolean;
  },
) {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true, priceCents: true },
  });

  if (!product) {
    throw new AppError(
      404,
      "product_not_found",
      "Produto não encontrado.",
      null,
      "Atualize a listagem e tente novamente.",
    );
  }

  if (input.promotionalPriceCents >= product.priceCents) {
    throw new AppError(
      400,
      "promotion_price_not_lower",
      "O preço promocional precisa ser menor que o preço atual do produto.",
      { productId: product.id, productPriceCents: product.priceCents },
      "Informe um valor com desconto real.",
    );
  }

  if (!input.isActive) {
    return;
  }

  const conflict = await tx.promotion.findFirst({
    where: {
      productId: input.productId,
      isActive: true,
      ...(input.id ? { id: { not: input.id } } : {}),
      type: { in: promotionTypesConflictingWith(input.type) },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
    },
    include: { product: true },
  });

  if (conflict) {
    throw new AppError(
      409,
      "promotion_conflict",
      "Já existe uma promoção ativa para esse produto no mesmo canal e período.",
      {
        conflictingPromotionId: conflict.id,
        productId: input.productId,
        type: conflict.type,
      },
      "Ajuste o período, o tipo ou desative a promoção existente.",
    );
  }
}

export async function listPromotions(query?: string | null) {
  const normalizedQuery = query?.trim();
  const where: Prisma.PromotionWhereInput = {};

  if (normalizedQuery) {
    where.product = {
      OR: [
        { name: { contains: normalizedQuery, mode: "insensitive" } },
        { sku: { contains: normalizedQuery, mode: "insensitive" } },
      ],
    };
  }

  const promotions = await db.promotion.findMany({
    where,
    include: { product: true },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
  });

  return promotions.map(toPromotionDto);
}

export async function createPromotion(rawInput: unknown, actorUserId: string, ipAddress: string) {
  const input = await createPromotionInputSchema.parseAsync(rawInput);

  const promotion = await db.$transaction(async (tx) => {
    await validatePromotionInput(tx, input);

    return tx.promotion.create({
      data: input,
      include: { product: true },
    });
  });

  await logAuditEvent({
    actorUserId,
    action: "promotion_created",
    entityType: "promotion",
    entityId: promotion.id,
    ipAddress,
    metadata: {
      productId: promotion.productId,
      type: promotion.type,
      promotionalPriceCents: promotion.promotionalPriceCents,
    },
  });

  return toPromotionDto(promotion);
}

export async function updatePromotion(rawInput: unknown, actorUserId: string, ipAddress: string) {
  const input = await updatePromotionInputSchema.parseAsync(rawInput);

  const promotion = await db.$transaction(async (tx) => {
    const existing = await tx.promotion.findUnique({
      where: { id: input.id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(
        404,
        "promotion_not_found",
        "Promoção não encontrada.",
        null,
        "Atualize a listagem e tente novamente.",
      );
    }

    await validatePromotionInput(tx, input);

    return tx.promotion.update({
      where: { id: input.id },
      data: {
        productId: input.productId,
        type: input.type,
        promotionalPriceCents: input.promotionalPriceCents,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        isActive: input.isActive,
      },
      include: { product: true },
    });
  });

  await logAuditEvent({
    actorUserId,
    action: "promotion_updated",
    entityType: "promotion",
    entityId: promotion.id,
    ipAddress,
    metadata: {
      productId: promotion.productId,
      type: promotion.type,
      promotionalPriceCents: promotion.promotionalPriceCents,
      isActive: promotion.isActive,
    },
  });

  return toPromotionDto(promotion);
}
