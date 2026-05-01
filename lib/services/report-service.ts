import { db } from "@/lib/db";
import { dashboardAnalyticsSchema, dailySummarySchema } from "@/lib/schemas/commanda";
import { buildDashboardAnalytics, type DashboardAnalyticsRange } from "@/lib/services/report-analytics";
import { getTodayBounds } from "@/lib/utils/date";

export async function getDashboardData() {
  const { start, end } = getTodayBounds();

  const [openCommandasCount, closedToday, products] = await Promise.all([
    db.commanda.count({
      where: { status: "open" },
    }),
    db.commanda.findMany({
      where: {
        status: "closed",
        closedAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    }),
    db.product.findMany({
      select: {
        id: true,
        name: true,
        stockQty: true,
        minimumStock: true,
      },
    }),
  ]);

  const totalSalesCents = closedToday.reduce((sum, commanda) => sum + commanda.totalCents, 0);
  const lowStockCount = products.filter((product) => product.stockQty <= product.minimumStock).length;
  const negativeStockCount = products.filter((product) => product.stockQty < 0).length;

  const topProductsMap = new Map<string, { productName: string; quantity: number; totalCents: number }>();

  for (const commanda of closedToday) {
    for (const item of commanda.items) {
      const existing = topProductsMap.get(item.productId) ?? {
        productName: item.product.name,
        quantity: 0,
        totalCents: 0,
      };

      existing.quantity += item.quantity;
      existing.totalCents += item.subtotalCents;
      topProductsMap.set(item.productId, existing);
    }
  }

  const summary = dailySummarySchema.parse({
    totalSalesCents,
    closedCommandasCount: closedToday.length,
    openCommandasCount,
    lowStockCount,
    negativeStockCount,
    topProducts: Array.from(topProductsMap.values())
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5),
  });

  return {
    summary,
    lowStockProducts: products
      .filter((product) => product.stockQty <= product.minimumStock)
      .sort((left, right) => left.stockQty - right.stockQty)
      .slice(0, 5),
  };
}

export async function getDailySummary() {
  const dashboard = await getDashboardData();
  return dashboard.summary;
}

export async function getDashboardAnalytics(range: Pick<DashboardAnalyticsRange, "startDate" | "endDate">) {
  const closedCommandas = await db.commanda.findMany({
    where: {
      status: "closed",
      closedAt: {
        gte: range.startDate,
        lte: range.endDate,
      },
    },
    orderBy: { closedAt: "asc" },
    select: {
      totalCents: true,
      closedAt: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          subtotalCents: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return dashboardAnalyticsSchema.parse(
    buildDashboardAnalytics(
      closedCommandas
        .filter((commanda) => commanda.closedAt != null)
        .map((commanda) => ({
          closedAt: commanda.closedAt as Date,
          totalCents: commanda.totalCents,
          items: commanda.items.map((item) => ({
            productId: item.productId,
            productName: item.product.name,
            quantity: item.quantity,
            totalCents: item.subtotalCents,
          })),
        })),
      range,
    ),
  );
}

export async function listOperators() {
  return db.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });
}
