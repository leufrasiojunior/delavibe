import Link from "next/link";

import { WebOrderStatus } from "@prisma/client";

import { type WebOrderDto } from "@/lib/schemas/web-order";
import { formatCurrency } from "@/lib/utils/money";

const STATUS_LABELS: Record<WebOrderStatus, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  PREPARING: "Em preparo",
  READY: "Pronto",
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

  return (
    <section className="public-confirmation">
      <div className="public-confirmation-header">
        <p className="eyebrow">Pedido recebido</p>
        <h1>Obrigado pelo pedido!</h1>
        <p>Número do pedido: <strong>#{shortNumber}</strong></p>
        <p>
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
          {order.items.map((item) => (
            <li key={item.id}>
              <span>{item.productName} × {item.quantity}</span>
              <strong>{formatCurrency(item.lineTotalCents)}</strong>
            </li>
          ))}
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

      <Link href="/" className="button button-secondary compact">Voltar ao cardápio</Link>
    </section>
  );
}
