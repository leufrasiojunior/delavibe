import { PublicCart } from "@/components/public-cart";
import { db } from "@/lib/db";
import { publicProductListSchema } from "@/lib/schemas/product";

export const dynamic = "force-dynamic";

export default async function CarrinhoPage() {
  const products = await db.product.findMany({ where: { isActive: true } });
  const dtos = publicProductListSchema.parse(
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

  const productsLookup = Object.fromEntries(dtos.map((product) => [product.id, product]));

  return <PublicCart productsLookup={productsLookup} />;
}
