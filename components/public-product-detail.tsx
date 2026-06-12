"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Ban, ShoppingCart } from "lucide-react";

import { useCart } from "@/lib/hooks/use-cart";
import { type PublicProductDto } from "@/lib/schemas/product";
import { formatCurrency } from "@/lib/utils/money";
import { calculatePromotionSavings } from "@/lib/utils/promotion-display";

const PLACEHOLDER_IMAGE = "/catalog-placeholder.jpg";

function buildImageUrl(product: PublicProductDto) {
  if (!product.imagePath) return PLACEHOLDER_IMAGE;
  const version = Date.parse(product.updatedAt);
  return `${product.imagePath}?v=${Number.isFinite(version) ? version : 0}`;
}

type PublicProductDetailProps = {
  product: PublicProductDto;
};

export function PublicProductDetail({ product }: PublicProductDetailProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const savings = product.promotion
    ? calculatePromotionSavings(product.priceCents, product.effectivePriceCents)
    : null;

  function handleAdd() {
    if (quantity < 1) return;
    addItem(product.id, quantity);
    setFeedback("Adicionado ao carrinho.");
    window.setTimeout(() => setFeedback(null), 2000);
  }

  return (
    <article className="public-stack">
      <Link href="/" className="muted public-back-link">
        <ArrowLeft size={14} aria-hidden />
        Voltar ao cardápio
      </Link>

      <div className="public-product-detail">
        <img
          src={buildImageUrl(product)}
          alt={product.name}
          className="public-product-detail-img"
        />
        <div className="public-product-detail-body">
          <p className="eyebrow">{product.category ?? "Produto"}</p>
          <h1>{product.name}</h1>
          {product.promotion ? (
            <div className="public-product-detail-price public-promo-price">
              <span>De: {formatCurrency(product.priceCents)}</span>
              <strong>
                Por: {formatCurrency(product.effectivePriceCents)}
              </strong>
              {savings ? <span className="discount-badge">{savings.discountLabel}</span> : null}
            </div>
          ) : (
            <p className="public-product-detail-price">{formatCurrency(product.priceCents)}</p>
          )}
          {product.stockQty <= 0 ? (
            <p>
              <span className="badge danger">
                <Ban size={12} aria-hidden />
                Esgotado
              </span>
            </p>
          ) : product.stockQty <= product.minimumStock ? (
            <p>
              <span className="badge warning">
                <AlertTriangle size={12} aria-hidden />
                Poucas unidades
              </span>
            </p>
          ) : null}

          <div className="public-product-detail-controls">
            <label className="field">
              <span>Quantidade</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))}
              />
            </label>

            <button type="button" className="button button-primary" onClick={handleAdd}>
              <ShoppingCart size={16} aria-hidden />
              Adicionar ao carrinho
            </button>
          </div>

          {feedback ? <p className="form-success compact">{feedback}</p> : null}
        </div>
      </div>
    </article>
  );
}
