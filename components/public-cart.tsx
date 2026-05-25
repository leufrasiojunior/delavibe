"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ShoppingCart, Trash2 } from "lucide-react";

import { ProductMedia } from "@/components/product-media";
import { QuantityStepper } from "@/components/quantity-stepper";
import { useCart } from "@/lib/hooks/use-cart";
import { type PublicProductDto } from "@/lib/schemas/product";
import { formatCurrency } from "@/lib/utils/money";

type PublicCartProps = {
  productsLookup: Record<string, PublicProductDto>;
};

export function PublicCart({ productsLookup }: PublicCartProps) {
  const { items, isHydrated, updateQuantity, removeItem, clear } = useCart();

  if (!isHydrated) {
    return (
      <section className="public-empty">
        <p className="muted">Carregando carrinho...</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="public-empty">
        <h1>Seu carrinho está vazio</h1>
        <p className="muted">Adicione produtos no cardápio para continuar.</p>
        <Link href="/" className="button button-primary compact">
          <ArrowLeft size={14} aria-hidden />
          Voltar ao cardápio
        </Link>
      </section>
    );
  }

  const total = items.reduce((sum, item) => {
    const product = productsLookup[item.productId];
    return sum + (product?.priceCents ?? 0) * item.quantity;
  }, 0);

  function handleClear() {
    if (window.confirm("Deseja realmente esvaziar o carrinho?")) {
      clear();
    }
  }

  return (
    <section className="public-cart">
      <header>
        <p className="eyebrow">Carrinho</p>
        <h1>{items.length} {items.length === 1 ? "item" : "itens"}</h1>
      </header>

      <ul className="public-cart-list">
        {items.map((item) => {
          const product = productsLookup[item.productId];
          if (!product) {
            return (
              <li key={item.productId} className="public-cart-line">
                <div className="public-cart-line-info">
                  <strong className="form-error compact">Produto indisponível</strong>
                  <span className="muted">Este item foi removido do catálogo.</span>
                </div>
                <button
                  className="button button-secondary compact"
                  type="button"
                  onClick={() => removeItem(item.productId)}
                >
                  <Trash2 size={14} aria-hidden />
                  Remover
                </button>
              </li>
            );
          }

          const lineTotal = product.priceCents * item.quantity;
          return (
            <li key={item.productId} className="public-cart-line">
              <ProductMedia product={product} size="lg" />
              <div className="public-cart-line-info">
                <strong>{product.name}</strong>
                <span className="muted">{formatCurrency(product.priceCents)} cada</span>
                <div className="public-cart-line-quantity">
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(next) => updateQuantity(item.productId, next)}
                  />
                  <button
                    className="button button-secondary compact"
                    type="button"
                    onClick={() => removeItem(item.productId)}
                  >
                    <Trash2 size={14} aria-hidden />
                    Remover
                  </button>
                </div>
              </div>
              <strong>{formatCurrency(lineTotal)}</strong>
            </li>
          );
        })}
      </ul>

      <div className="public-cart-summary">
        <span>Total</span>
        <strong>{formatCurrency(total)}</strong>
      </div>

      <div className="button-row">
        <Link href="/" className="button button-secondary compact">
          <ArrowLeft size={14} aria-hidden />
          Continuar comprando
        </Link>
        <button type="button" className="button button-secondary compact" onClick={handleClear}>
          <Trash2 size={14} aria-hidden />
          Esvaziar carrinho
        </button>
        <Link href="/checkout" className="button button-primary">
          <ShoppingCart size={16} aria-hidden />
          Finalizar pedido
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
