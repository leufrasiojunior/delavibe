import { CommandaBoard } from "@/components/commanda-board";
import { requireServerSession } from "@/lib/auth/session";
import { listCommandas } from "@/lib/services/commanda-service";
import { listProducts } from "@/lib/services/product-service";

export default async function CommandasPage() {
  await requireServerSession();
  const [commandas, products] = await Promise.all([listCommandas({ status: "all" }), listProducts()]);

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <p className="eyebrow">PDV</p>
          <h1>Atendimento por comanda</h1>
          <p className="muted">
            Abra a comanda, identifique o cliente, mantenha o atendimento em aberto e feche só quando a conferência terminar.
          </p>
        </div>
      </section>

      <CommandaBoard commandas={commandas} products={products.filter((product) => product.isActive)} />
    </div>
  );
}
