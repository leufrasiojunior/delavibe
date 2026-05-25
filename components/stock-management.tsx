"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { PackagePlus } from "lucide-react";

import { apiFetch } from "@/lib/api/client";
import type { ProductDto } from "@/lib/schemas/product";
import { stockMovementSchema, type StockMovementDto } from "@/lib/schemas/stock";
import { formatCurrency } from "@/lib/utils/money";
import { useToast } from "@/components/toast";

type StockManagementProps = {
  products: ProductDto[];
  movements: StockMovementDto[];
  canAdjust: boolean;
};

function buildProductDetails(product: ProductDto) {
  return [product.sku ? `SKU ${product.sku}` : null, `CB ${product.barcode}`, product.category]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function StockManagement({ products, movements, canAdjust }: StockManagementProps) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [reason, setReason] = useState<"manual_entry" | "manual_adjustment">("manual_entry");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) ?? null,
    [productId, products],
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) =>
      [product.name, product.sku ?? "", product.barcode, product.category ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [products, search]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canAdjust) {
      return;
    }

    startTransition(() => {
      void apiFetch(
        "/api/stock/movements",
        {
          method: "POST",
          body: JSON.stringify({
            productId,
            reason,
            quantity,
            notes: notes || null,
          }),
        },
        stockMovementSchema,
      )
        .then(() => {
          toast.success("Movimentação registrada.");
          setQuantity("1");
          setNotes("");
          router.refresh();
        })
        .catch((caughtError: unknown) => {
          const message =
            caughtError instanceof Error && caughtError.message
              ? caughtError.message
              : "Falha ao registrar a movimentação.";
          toast.error(message);
        });
    });
  }

  return (
    <div className="page-grid two-columns">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Estoque</p>
            <h2>{canAdjust ? "Entradas e ajustes manuais" : "Consulta de estoque"}</h2>
          </div>
        </div>

        {canAdjust ? (
          <form className="stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Produto</span>
              <select value={productId} onChange={(event) => setProductId(event.target.value)} required>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.stockQty} {product.unit})
                  </option>
                ))}
              </select>
            </label>

            <div className="field-grid">
              <label className="field">
                <span>Tipo</span>
                <select value={reason} onChange={(event) => setReason(event.target.value as "manual_entry" | "manual_adjustment")}>
                  <option value="manual_entry">Entrada manual</option>
                  <option value="manual_adjustment">Ajuste manual</option>
                </select>
              </label>

              <label className="field">
                <span>Quantidade</span>
                <input
                  value={quantity}
                  type="number"
                  step="1"
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                />
              </label>
            </div>

            <label className="field">
              <span>Observação</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Ex.: reposição de câmera fria"
              />
            </label>

            {selectedProduct ? (
              <p className="muted">
                Saldo atual: <strong>{selectedProduct.stockQty}</strong> {selectedProduct.unit}.
              </p>
            ) : null}


            <button className="button button-primary" type="submit" disabled={isPending || !productId}>
              <PackagePlus size={16} aria-hidden />
              {isPending ? "Registrando..." : "Registrar movimentação"}
            </button>
          </form>
        ) : (
          <p className="muted">
            Seu perfil consulta saldos e histórico, mas ajustes são restritos ao administrador.
          </p>
        )}

        <div className="inventory-table-section">
          <div className="panel-header small">
            <div>
              <p className="eyebrow">Busca de saldo</p>
              <h3>Tabela de estoque</h3>
            </div>
            <span className="badge neutral">{filteredProducts.length} produtos</span>
          </div>

          <label className="field">
            <span>Buscar por SKU, código de barras ou nome</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ex.: CERVEJA-001, 789..., long neck"
            />
          </label>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Preço</th>
                  <th>Saldo</th>
                  <th>Mínimo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                      <span className="table-subtitle">{buildProductDetails(product)}</span>
                    </td>
                    <td>{formatCurrency(product.priceCents)}</td>
                    <td>
                      <strong>{product.stockQty}</strong> {product.unit}
                    </td>
                    <td>{product.minimumStock}</td>
                    <td>
                      <span
                        className={
                          product.stockQty < 0
                            ? "badge danger"
                            : product.stockQty <= product.minimumStock
                              ? "badge warning"
                              : "badge success"
                        }
                      >
                        {product.stockQty < 0
                          ? "Negativo"
                          : product.stockQty <= product.minimumStock
                            ? "Baixo"
                            : "OK"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Nenhum produto encontrado para esse filtro.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Histórico</p>
            <h2>Movimentações recentes</h2>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Movimento</th>
                <th>Saldo</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td>
                    <strong>{movement.productName}</strong>
                    <span className="table-subtitle">{movement.createdAt.replace("T", " ").slice(0, 16)}</span>
                  </td>
                  <td>
                    <span className={movement.quantityDelta < 0 ? "badge danger" : "badge success"}>
                      {movement.quantityDelta > 0 ? `+${movement.quantityDelta}` : movement.quantityDelta}
                    </span>
                    <span className="table-subtitle">{movement.reason}</span>
                  </td>
                  <td>{movement.resultingStock}</td>
                  <td>{movement.actorName ?? "Sistema"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
