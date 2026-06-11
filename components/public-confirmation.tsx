import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2 } from "lucide-react";

import { WebOrderStatus } from "@prisma/client";

import { type WebOrderDto } from "@/lib/schemas/web-order";
import { formatCurrency } from "@/lib/utils/money";
import { calculatePromotionSavings } from "@/lib/utils/promotion-display";

const STATUS_LABELS: Record<WebOrderStatus, string> = {
  PENDING_PAYMENT: "Recebido",
  PAID: "Pago",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const PAYMENT_METHODS = ["Dinheiro", "PIX", "Débito", "Crédito"] as const;

type StoreInfo = {
  name: string;
  address: string;
  phone: string;
};

type PublicConfirmationProps = {
  order: WebOrderDto;
  storeInfo: StoreInfo;
};

export function PublicConfirmation({ order, storeInfo }: PublicConfirmationProps) {
  const isPickup = !order.addressStreet;
  const shortNumber = order.id.slice(0, 8).toUpperCase();

  const firstName = order.customerName?.split(" ")[0] ?? null;

  return (
    <section className="public-confirmation">
      <div className="public-confirmation-hero">
        <div className="public-confirmation-check" aria-hidden>
          <Check size={40} strokeWidth={3} />
        </div>
        <h1>Obrigado pelo seu pedido!</h1>
        {firstName ? (
          <p className="public-confirmation-greeting">{firstName}, recebemos seu pedido com sucesso.</p>
        ) : (
          <p className="public-confirmation-greeting">Recebemos seu pedido com sucesso.</p>
        )}
        <p className="public-confirmation-number">
          Número do pedido: <strong>#{shortNumber}</strong>
        </p>
        <p className="muted">
          Status atual: <strong>{STATUS_LABELS[order.status]}</strong>
        </p>
      </div>

      <div className="public-checkout-block">
        <h2>{isPickup ? "Retirada no local" : "Entrega no endereço"}</h2>
        {isPickup ? (
          <>
            <p>{storeInfo.name}</p>
            <p className="muted">{storeInfo.address}</p>
            <p className="muted">Telefone para contato: {storeInfo.phone}</p>
          </>
        ) : (
          <>
            <p>
              {order.addressStreet}, {order.addressNumber}
              {order.addressComplement ? ` · ${order.addressComplement}` : ""}
            </p>
            <p className="muted">
              {order.addressNeighborhood} · {order.addressCity}/{order.addressState} · CEP {order.addressZip}
            </p>
            {order.addressReference ? <p className="muted">Referência: {order.addressReference}</p> : null}
          </>
        )}
      </div>

      <div className="public-checkout-block">
        <h2>Resumo do pedido</h2>
        <ul className="public-checkout-summary">
          {order.items.map((item) => {
            const savings = item.promotionId && item.originalUnitPriceCents
              ? calculatePromotionSavings(item.originalUnitPriceCents, item.unitPriceCents)
              : null;

            return (
              <li key={item.id}>
                <span>
                  {item.productName} × {item.quantity}
                  {item.promotionId && item.originalUnitPriceCents ? (
                    <small className="public-order-promo-note">
                      De: {formatCurrency(item.originalUnitPriceCents)} Por:{" "}
                      {formatCurrency(item.unitPriceCents)} cada
                      {savings ? <span className="discount-badge">{savings.discountLabel}</span> : null}
                    </small>
                  ) : null}
                </span>
                <strong>{formatCurrency(item.lineTotalCents)}</strong>
              </li>
            );
          })}
          {order.deliveryFeeCents > 0 ? (
            <li>
              <span>Frete</span>
              <strong>{formatCurrency(order.deliveryFeeCents)}</strong>
            </li>
          ) : null}
          <li className="public-cart-summary">
            <span>Total</span>
            <strong>{formatCurrency(order.totalCents)}</strong>
          </li>
        </ul>
        {order.notes ? <p className="muted">Observações: {order.notes}</p> : null}
      </div>

      <div className="public-checkout-block">
        <h2>Formas de pagamento aceitas no local</h2>
        <div className="public-payment-methods">
          {PAYMENT_METHODS.map((method) => (
            <span key={method} className="public-payment-method">{method}</span>
          ))}
        </div>
        {order.status === WebOrderStatus.PENDING_PAYMENT ? (
          <p className="muted">
            ⚠️ Seu pedido pode ser cancelado automaticamente após 60 minutos sem pagamento.
          </p>
        ) : null}
      </div>

      <div className="button-row">
        <Link href="/" className="button button-primary">
          <ArrowLeft size={16} aria-hidden />
          Voltar ao cardápio
        </Link>
      </div>
    </section>
  );
}
