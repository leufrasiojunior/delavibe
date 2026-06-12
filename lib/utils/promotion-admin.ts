import { PromotionType } from "@prisma/client";

import { type PromotionDto } from "@/lib/schemas/promotion";
import { normalizeText } from "@/lib/utils/text";

export type PromotionStatus = "active" | "scheduled" | "expired" | "inactive";
export type PromotionStatusFilter = PromotionStatus | "all";
export type PromotionTypeFilter = PromotionType | "all";

type PromotionDateLike = Pick<PromotionDto, "isActive" | "startsAt" | "endsAt">;

type PromotionConflictInput = {
  id: string | null;
  productId: string;
  type: PromotionType;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

type PromotionListFilters = {
  status: PromotionStatusFilter;
  type: PromotionTypeFilter;
  search: string;
  now?: Date;
};

const PROMOTION_STATUS_ORDER: Record<PromotionStatus, number> = {
  active: 0,
  scheduled: 1,
  expired: 2,
  inactive: 3,
};

function toTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function promotionAppliesToTarget(type: PromotionType, target: "local" | "site") {
  if (type === PromotionType.both) {
    return true;
  }

  return target === "local" ? type === PromotionType.local : type === PromotionType.site;
}

function promotionTypesOverlap(left: PromotionType, right: PromotionType) {
  return (
    promotionAppliesToTarget(left, "local") && promotionAppliesToTarget(right, "local")
  ) || (
    promotionAppliesToTarget(left, "site") && promotionAppliesToTarget(right, "site")
  );
}

function periodsOverlap(
  leftStartsAt: Date,
  leftEndsAt: Date,
  rightStartsAt: Date,
  rightEndsAt: Date,
) {
  return leftStartsAt < rightEndsAt && rightStartsAt < leftEndsAt;
}

export function getAdminPromotionStatus(promotion: PromotionDateLike, now = new Date()): PromotionStatus {
  if (!promotion.isActive) {
    return "inactive";
  }

  const startsAt = new Date(promotion.startsAt);
  const endsAt = new Date(promotion.endsAt);

  if (startsAt > now) {
    return "scheduled";
  }

  if (endsAt <= now) {
    return "expired";
  }

  return "active";
}

export function findPromotionConflict(
  promotions: PromotionDto[],
  input: PromotionConflictInput,
) {
  if (!input.isActive || !input.productId || !input.startsAt || !input.endsAt) {
    return null;
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    return null;
  }

  return promotions.find((promotion) => (
    promotion.isActive &&
    promotion.productId === input.productId &&
    promotion.id !== input.id &&
    promotionTypesOverlap(promotion.type, input.type) &&
    periodsOverlap(new Date(promotion.startsAt), new Date(promotion.endsAt), startsAt, endsAt)
  )) ?? null;
}

export function sortPromotionsForAdmin(
  promotions: PromotionDto[],
  now = new Date(),
) {
  return [...promotions].sort((left, right) => {
    const leftStatus = getAdminPromotionStatus(left, now);
    const rightStatus = getAdminPromotionStatus(right, now);
    const byStatus = PROMOTION_STATUS_ORDER[leftStatus] - PROMOTION_STATUS_ORDER[rightStatus];

    if (byStatus !== 0) {
      return byStatus;
    }

    if (leftStatus === "expired") {
      const byRecentEnd = toTime(right.endsAt) - toTime(left.endsAt);
      if (byRecentEnd !== 0) {
        return byRecentEnd;
      }
    } else if (leftStatus === "inactive") {
      const byRecentUpdate = toTime(right.updatedAt) - toTime(left.updatedAt);
      if (byRecentUpdate !== 0) {
        return byRecentUpdate;
      }
    } else {
      const bySoonestEnd = toTime(left.endsAt) - toTime(right.endsAt);
      if (bySoonestEnd !== 0) {
        return bySoonestEnd;
      }
    }

    return left.product.name.localeCompare(right.product.name, "pt-BR");
  });
}

export function filterPromotionsForAdmin(
  promotions: PromotionDto[],
  filters: PromotionListFilters,
) {
  const term = normalizeText(filters.search.trim());
  const now = filters.now ?? new Date();

  return sortPromotionsForAdmin(
    promotions.filter((promotion) => {
      if (filters.status !== "all" && getAdminPromotionStatus(promotion, now) !== filters.status) {
        return false;
      }

      if (filters.type !== "all" && promotion.type !== filters.type) {
        return false;
      }

      if (!term) {
        return true;
      }

      return normalizeText([
        promotion.product.name,
        promotion.product.sku ?? "",
      ].join(" ")).includes(term);
    }),
    now,
  );
}
