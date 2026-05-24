import { redirect } from "next/navigation";

import { PublicCatalog } from "@/components/public-catalog";
import { getOptionalServerSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hasAdminAccount } from "@/lib/services/bootstrap-service";
import { publicProductListSchema } from "@/lib/schemas/product";

export const dynamic = "force-dynamic";

export default async function PublicHomePage() {
  const adminExists = await hasAdminAccount();

  if (!adminExists) {
    redirect("/setup");
  }

  const adminSession = await getOptionalServerSession();
  if (adminSession) {
    redirect("/commandas");
  }

  const products = await db.product.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const initialProducts = publicProductListSchema.parse(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      imagePath: product.imagePath,
      unit: product.unit,
      priceCents: product.priceCents,
      stockQty: product.stockQty,
      minimumStock: product.minimumStock,
      isActive: product.isActive,
      updatedAt: product.updatedAt.toISOString(),
    })),
  );

  return <PublicCatalog initialProducts={initialProducts} />;
}
