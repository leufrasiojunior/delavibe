import { ProductManagement } from "@/components/product-management";
import { requireServerSession } from "@/lib/auth/session";
import { listProducts } from "@/lib/services/product-service";

export default async function ProductsPage() {
  const session = await requireServerSession();
  const products = await listProducts();

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1>Produtos e precificação</h1>
          <p className="muted">
            Cadastre itens, ajuste o estoque inicial e mantenha o cardápio pronto para o balcão.
          </p>
        </div>
      </section>

      <ProductManagement products={products} canManage={session.user.role === "admin"} />
    </div>
  );
}
