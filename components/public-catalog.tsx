"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useCart } from "@/lib/hooks/use-cart";
import { type PublicProductDto } from "@/lib/schemas/product";
import { formatCurrency } from "@/lib/utils/money";

const PLACEHOLDER_IMAGE = "/catalog-placeholder.jpg";

function buildImageUrl(product: PublicProductDto) {
  if (!product.imagePath) {
    return PLACEHOLDER_IMAGE;
  }
  const version = Date.parse(product.updatedAt);
  return `${product.imagePath}?v=${Number.isFinite(version) ? version : 0}`;
}

function stockBadge(product: PublicProductDto) {
  if (product.stockQty <= 0) {
    return <span className="badge danger">Esgotado</span>;
  }
  if (product.stockQty <= product.minimumStock) {
    return <span className="badge warning">Poucas unidades</span>;
  }
  return null;
}

type PublicCatalogProps = {
  initialProducts: PublicProductDto[];
};

export function PublicCatalog({ initialProducts }: PublicCatalogProps) {
  const [search, setSearch] = useState("");
  const { addItem } = useCart();
  const [feedbackProductId, setFeedbackProductId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return initialProducts;
    return initialProducts.filter((product) =>
      product.name.toLowerCase().includes(term),
    );
  }, [initialProducts, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PublicProductDto[]>();
    for (const product of filtered) {
      const key = product.category?.trim() || "Outros";
      const list = map.get(key) ?? [];
      list.push(product);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function handleAdd(productId: string) {
    addItem(productId, 1);
    setFeedbackProductId(productId);
    window.setTimeout(() => {
      setFeedbackProductId((current) => (current === productId ? null : current));
    }, 1500);
  }

  return (
    <div className="public-stack">
      <section className="public-hero">
        <div>
          <p className="eyebrow">Cardápio</p>
          <h1>Faça seu pedido online</h1>
          <p className="muted">
            Escolha os itens, finalize o pedido e pague presencialmente ao chegar — sem complicação.
          </p>
        </div>
        <input
          type="search"
          className="public-search"
          placeholder="Buscar produto pelo nome"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </section>

      {grouped.length === 0 ? (
        <section className="public-empty">
          <p>Nenhum produto encontrado.</p>
        </section>
      ) : (
        grouped.map(([category, products]) => (
          <section key={category} className="public-category">
            <h2>{category}</h2>
            <ul className="public-product-grid">
              {products.map((product) => (
                <li key={product.id} className="public-product-card">
                  <Link href={`/produto/${product.id}`} className="public-product-card-link">
                    <img
                      src={buildImageUrl(product)}
                      alt={product.name}
                      loading="lazy"
                      className="public-product-card-img"
                    />
                  </Link>
                  <div className="public-product-card-body">
                    <h3>{product.name}</h3>
                    <div className="public-product-card-meta">
                      <strong>{formatCurrency(product.priceCents)}</strong>
                      {stockBadge(product)}
                    </div>
                    <button
                      type="button"
                      className="button button-primary compact public-product-card-add"
                      onClick={() => handleAdd(product.id)}
                    >
                      {feedbackProductId === product.id ? "Adicionado!" : "Adicionar"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
