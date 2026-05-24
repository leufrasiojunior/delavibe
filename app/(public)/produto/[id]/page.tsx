import { notFound } from "next/navigation";

import { PublicProductDetail } from "@/components/public-product-detail";
import { db } from "@/lib/db";
import { publicProductSchema } from "@/lib/schemas/product";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PublicProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await db.product.findFirst({ where: { id, isActive: true } });

  if (!product) {
    notFound();
  }

  const dto = publicProductSchema.parse({
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
  });

  return <PublicProductDetail product={dto} />;
}
