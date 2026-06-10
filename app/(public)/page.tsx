import { redirect } from "next/navigation";

import { PublicCatalog } from "@/components/public-catalog";
import { hasAdminAccount } from "@/lib/services/bootstrap-service";
import { publicProductListSchema } from "@/lib/schemas/product";
import { listPublicProductsWithPromotions } from "@/lib/services/promotion-service";

export const dynamic = "force-dynamic";

export default async function PublicHomePage() {
  const adminExists = await hasAdminAccount();

  if (!adminExists) {
    redirect("/admin/setup");
  }

  // Admin logado pode ver o cardápio normalmente — a área administrativa
  // fica em /admin/* e é acessada via item de menu específico.

  const initialProducts = publicProductListSchema.parse(await listPublicProductsWithPromotions());

  return <PublicCatalog initialProducts={initialProducts} />;
}
