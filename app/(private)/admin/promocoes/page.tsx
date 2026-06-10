import { PromotionManagement } from "@/components/promotion-management";
import { requireServerSession } from "@/lib/auth/session";
import { listProducts } from "@/lib/services/product-service";
import { listPromotions } from "@/lib/services/promotion-service";

export default async function PromotionsPage() {
  const session = await requireServerSession();
  const [products, promotions] = await Promise.all([listProducts(), listPromotions()]);

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <p className="eyebrow">Promoções</p>
          <h1>Cadastro de promoções</h1>
          <p className="muted">
            Defina preços promocionais por produto, período e tipo de venda.
          </p>
        </div>
      </section>

      <PromotionManagement
        products={products.filter((product) => product.isActive)}
        promotions={promotions}
        canManage={session.user.role === "admin"}
      />
    </div>
  );
}
