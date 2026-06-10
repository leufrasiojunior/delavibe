import { PublicCart } from "@/components/public-cart";
import { publicProductListSchema } from "@/lib/schemas/product";
import { listPublicProductsWithPromotions } from "@/lib/services/promotion-service";

export const dynamic = "force-dynamic";

export default async function CarrinhoPage() {
  const dtos = publicProductListSchema.parse(await listPublicProductsWithPromotions());

  const productsLookup = Object.fromEntries(dtos.map((product) => [product.id, product]));

  return <PublicCart productsLookup={productsLookup} />;
}
