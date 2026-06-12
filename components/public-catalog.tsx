"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Ban, Check, Percent, Plus, Search, UtensilsCrossed } from "lucide-react";

import { ProductMedia } from "@/components/product-media";
import { QuantityStepper } from "@/components/quantity-stepper";
import { useCart } from "@/lib/hooks/use-cart";
import { type PublicProductDto } from "@/lib/schemas/product";
import { formatCurrency } from "@/lib/utils/money";
import { calculatePromotionSavings } from "@/lib/utils/promotion-display";
import {
  filterPublicCatalogProducts,
  getDefaultPublicCatalogTab,
  getPublicCatalogCategoryKey,
  groupPublicCatalogProducts,
  PUBLIC_CATALOG_ALL_TAB,
  PUBLIC_CATALOG_PROMOTIONS_TAB,
} from "@/lib/utils/public-catalog";

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
    return (
      <span className="badge danger">
        <Ban size={12} aria-hidden />
        Esgotado
      </span>
    );
  }
  if (product.stockQty <= product.minimumStock) {
    return (
      <span className="badge warning">
        <AlertTriangle size={12} aria-hidden />
        Poucas unidades
      </span>
    );
  }
  return null;
}

function ProductPrice({ product }: { product: PublicProductDto }) {
  if (!product.promotion) {
    return <strong>{formatCurrency(product.priceCents)}</strong>;
  }

  const savings = calculatePromotionSavings(product.priceCents, product.effectivePriceCents);

  return (
    <span className="public-promo-price">
      <span>De: {formatCurrency(product.priceCents)}</span>
      <strong>
        Por: {formatCurrency(product.effectivePriceCents)}
      </strong>
      {savings ? <span className="discount-badge">{savings.discountLabel}</span> : null}
    </span>
  );
}

type PublicCatalogProps = {
  initialProducts: PublicProductDto[];
};

export function PublicCatalog({ initialProducts }: PublicCatalogProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>(() => getDefaultPublicCatalogTab(initialProducts));
  const { addItem } = useCart();
  const [feedbackProductId, setFeedbackProductId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const promotionalProductsCount = initialProducts.filter((product) => product.promotion).length;

  const setProductQuantity = useCallback((productId: string, next: number) => {
    setQuantities((current) => ({ ...current, [productId]: next }));
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const product of initialProducts) {
      set.add(getPublicCatalogCategoryKey(product));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [initialProducts]);

  const filtered = useMemo(() => {
    return filterPublicCatalogProducts(initialProducts, { activeTab, search });
  }, [activeTab, initialProducts, search]);

  const grouped = useMemo(() => {
    return groupPublicCatalogProducts(filtered);
  }, [filtered]);

  function handleAdd(productId: string) {
    const qty = quantities[productId] ?? 1;
    addItem(productId, qty);
    setProductQuantity(productId, 1);
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
        <div className="public-search-wrapper">
          <Search size={16} aria-hidden className="public-search-icon" />
          <input
            type="search"
            className="public-search"
            placeholder="Buscar produto pelo nome"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </section>

      {categories.length > 0 ? (
        <nav className="public-category-chips" aria-label="Filtrar produtos">
          <button
            type="button"
            className={activeTab === PUBLIC_CATALOG_ALL_TAB ? "chip active" : "chip"}
            onClick={() => setActiveTab(PUBLIC_CATALOG_ALL_TAB)}
          >
            {activeTab === PUBLIC_CATALOG_ALL_TAB ? (
              <Check size={12} aria-hidden />
            ) : (
              <UtensilsCrossed size={12} aria-hidden />
            )}
            Todas
          </button>
          <button
            type="button"
            className={activeTab === PUBLIC_CATALOG_PROMOTIONS_TAB ? "chip active" : "chip"}
            onClick={() => setActiveTab(PUBLIC_CATALOG_PROMOTIONS_TAB)}
          >
            {activeTab === PUBLIC_CATALOG_PROMOTIONS_TAB ? (
              <Check size={12} aria-hidden />
            ) : (
              <Percent size={12} aria-hidden />
            )}
            Promoções
            {promotionalProductsCount > 0 ? (
              <span className="chip-count">{promotionalProductsCount}</span>
            ) : null}
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={activeTab === category ? "chip active" : "chip"}
              onClick={() => setActiveTab(category)}
            >
              {activeTab === category ? <Check size={12} aria-hidden /> : null}
              {category}
            </button>
          ))}
        </nav>
      ) : null}

      {grouped.length === 0 ? (
        <section className="public-empty">
          <p>Nenhum produto encontrado.</p>
        </section>
      ) : (
        grouped.map(([category, products]) => (
          <section key={category} className="public-category">
            <h2>{category}</h2>
            <ul className="public-product-grid">
              {products.map((product) => {
                const wasJustAdded = feedbackProductId === product.id;

                return (
                  <li
                    key={product.id}
                    className={[
                      "public-product-card",
                      product.promotion ? "promoted" : "",
                      wasJustAdded ? "is-cart-added" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <Link href={`/produto/${product.id}`} className="public-product-card-link">
                      <img
                        src={buildImageUrl(product)}
                        alt={product.name}
                        loading="lazy"
                        className="public-product-card-img"
                      />
                    </Link>
                    <div className="public-product-card-body">
                      {product.promotion ? <span className="badge success">Promoção</span> : null}
                      <h3>{product.name}</h3>
                      <div className="public-product-card-meta">
                        <ProductPrice product={product} />
                        {stockBadge(product)}
                      </div>
                      <div className="public-product-card-add-row">
                        <QuantityStepper
                          size="sm"
                          value={quantities[product.id] ?? 1}
                          onChange={(next) => setProductQuantity(product.id, next)}
                        />
                        <button
                          type="button"
                          className={[
                            "button button-primary compact public-product-card-add",
                            wasJustAdded ? "is-cart-added" : "",
                          ].filter(Boolean).join(" ")}
                          onClick={() => handleAdd(product.id)}
                        >
                          {wasJustAdded ? (
                            <Check size={14} aria-hidden />
                          ) : (
                            <Plus size={14} aria-hidden />
                          )}
                          {wasJustAdded ? "Adicionado!" : "Adicionar"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
