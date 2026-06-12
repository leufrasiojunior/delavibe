import { notFound } from "next/navigation";

import { PublicProductDetail } from "@/components/public-product-detail";
import { publicProductSchema } from "@/lib/schemas/product";
import { listPublicProductsWithPromotions } from "@/lib/services/promotion-service";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PublicProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const [product] = await listPublicProductsWithPromotions({ id });

  if (!product) {
    notFound();
  }

  const dto = publicProductSchema.parse(product);

  return <PublicProductDetail product={dto} />;
}
