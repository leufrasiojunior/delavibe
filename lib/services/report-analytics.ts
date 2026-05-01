import {
  dashboardAnalyticsSchema,
  type DashboardAnalyticsDto,
} from "@/lib/schemas/commanda";
import {
  eachDayOfInterval,
  formatDateInput,
  formatDisplayDate,
  formatShortDate,
  getLastDaysBounds,
  parseOptionalDate,
} from "@/lib/utils/date";

const DEFAULT_ANALYTICS_DAYS = 7;
const TOP_PRODUCTS_LIMIT = 5;

export type DashboardAnalyticsRange = {
  startDate: Date;
  endDate: Date;
  startInput: string;
  endInput: string;
  isDefault: boolean;
};

export type DashboardAnalyticsRecord = {
  closedAt: Date;
  totalCents: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    totalCents: number;
  }>;
};

function normalizeRange(bounds: { start: Date; end: Date }, isDefault: boolean): DashboardAnalyticsRange {
  return {
    startDate: bounds.start,
    endDate: bounds.end,
    startInput: formatDateInput(bounds.start),
    endInput: formatDateInput(bounds.end),
    isDefault,
  };
}

export function resolveDashboardAnalyticsRange(
  startParam?: string | string[] | null,
  endParam?: string | string[] | null,
  now = new Date(),
) {
  const defaultBounds = getLastDaysBounds(DEFAULT_ANALYTICS_DAYS, now);
  const startValue = typeof startParam === "string" ? startParam : null;
  const endValue = typeof endParam === "string" ? endParam : null;
  const parsedStart = parseOptionalDate(startValue, "start");
  const parsedEnd = parseOptionalDate(endValue, "end");

  if (!parsedStart || !parsedEnd || parsedStart.getTime() > parsedEnd.getTime()) {
    return normalizeRange(defaultBounds, true);
  }

  return normalizeRange({ start: parsedStart, end: parsedEnd }, false);
}

export function buildDashboardAnalytics(
  records: DashboardAnalyticsRecord[],
  range: Pick<DashboardAnalyticsRange, "startDate" | "endDate">,
): DashboardAnalyticsDto {
  const salesByDay = eachDayOfInterval(range.startDate, range.endDate).map((day) => ({
    date: formatDateInput(day),
    label: formatShortDate(day),
    displayDate: formatDisplayDate(day),
    totalSalesCents: 0,
    closedCommandasCount: 0,
  }));
  const salesByDayMap = new Map(salesByDay.map((point) => [point.date, point]));
  const topProductsMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      quantity: number;
      totalCents: number;
    }
  >();

  let totalSalesCents = 0;
  let itemsSoldCount = 0;

  for (const record of records) {
    const dateKey = formatDateInput(record.closedAt);
    const dayPoint = salesByDayMap.get(dateKey);

    totalSalesCents += record.totalCents;

    if (dayPoint) {
      dayPoint.totalSalesCents += record.totalCents;
      dayPoint.closedCommandasCount += 1;
    }

    for (const item of record.items) {
      itemsSoldCount += item.quantity;

      const existing = topProductsMap.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        totalCents: 0,
      };

      existing.quantity += item.quantity;
      existing.totalCents += item.totalCents;
      topProductsMap.set(item.productId, existing);
    }
  }

  return dashboardAnalyticsSchema.parse({
    summary: {
      totalSalesCents,
      closedCommandasCount: records.length,
      averageTicketCents: records.length === 0 ? 0 : Math.round(totalSalesCents / records.length),
      itemsSoldCount,
    },
    salesByDay,
    topProducts: Array.from(topProductsMap.values())
      .sort(
        (left, right) =>
          right.quantity - left.quantity ||
          right.totalCents - left.totalCents ||
          left.productName.localeCompare(right.productName, "pt-BR"),
      )
      .slice(0, TOP_PRODUCTS_LIMIT),
  });
}
