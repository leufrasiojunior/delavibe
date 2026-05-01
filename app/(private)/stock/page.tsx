import { StockManagement } from "@/components/stock-management";
import { requireServerSession } from "@/lib/auth/session";
import { listProducts } from "@/lib/services/product-service";
import { listStockMovements } from "@/lib/services/stock-service";

export default async function StockPage() {
  const session = await requireServerSession();
  const [products, movements] = await Promise.all([listProducts(), listStockMovements()]);

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <p className="eyebrow">Estoque</p>
          <h1>Saldo atualizado sem confiar no cliente</h1>
          <p className="muted">
            Toda entrada, ajuste ou baixa por venda passa pelo servidor e fica registrada para auditoria.
          </p>
        </div>
      </section>

      <StockManagement products={products} movements={movements} canAdjust={session.user.role === "admin"} />
    </div>
  );
}
