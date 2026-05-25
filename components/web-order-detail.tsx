"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { WebOrderStatus } from "@prisma/client";

import { apiFetch } from "@/lib/api/client";
import {
  webOrderSchema,
  type WebOrderDto,
} from "@/lib/schemas/web-order";
import { formatCurrency } from "@/lib/utils/money";
import { formatDisplayDate, formatTimeAgo } from "@/lib/utils/date";
import { formatPhoneBr } from "@/lib/utils/strings";
import { WEB_ORDER_TRANSITIONS } from "@/lib/utils/web-order-status";
import { useToast } from "@/components/toast";

const STATUS_LABELS: Record<WebOrderStatus, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  PREPARING: "Em preparo",
  READY: "Pronto",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const STATUS_BADGE_CLASS: Record<WebOrderStatus, string> = {
  PENDING_PAYMENT: "badge warning",
  PAID: "badge neutral",
  PREPARING: "badge neutral",
  READY: "badge success",
  DELIVERED: "badge success",
  CANCELLED: "badge danger",
};

const TRANSITION_LABELS: Record<WebOrderStatus, string> = {
  PENDING_PAYMENT: "Reabrir",
  PAID: "Marcar como pago",
  PREPARING: "Iniciar preparo",
  READY: "Marcar como pronto",
  DELIVERED: "Marcar como entregue",
  CANCELLED: "Cancelar pedido",
};

function isAnonymized(order: WebOrderDto) {
  return order.customerEmail.startsWith("deleted-");
}

type WebOrderDetailProps = {
  initialOrder: WebOrderDto;
};

export function WebOrderDetail({ initialOrder }: WebOrderDetailProps) {
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState<WebOrderDto>(initialOrder);
  const [isPending, startTransition] = useTransition();
  const [mountedClientTime, setMountedClientTime] = useState<Date | null>(null);
  const cancelDialogRef = useRef<HTMLDialogElement | null>(null);
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    setMountedClientTime(new Date());
  }, []);

  const allowedTransitions = useMemo(
    () => WEB_ORDER_TRANSITIONS[order.status] ?? [],
    [order.status],
  );

  const nonCancelTransitions = allowedTransitions.filter(
    (status) => status !== WebOrderStatus.CANCELLED,
  );
  const canCancel = allowedTransitions.includes(WebOrderStatus.CANCELLED);

  function performTransition(toStatus: WebOrderStatus, notes?: string) {
    startTransition(() => {
      void apiFetch(
        `/api/admin/web-orders/${order.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ toStatus, notes: notes ?? null }),
        },
        webOrderSchema,
      )
        .then((updated) => {
          setOrder(updated);
          toast.success(`Status atualizado para ${STATUS_LABELS[toStatus]}.`);
          router.refresh();
        })
        .catch((caught: unknown) => {
          const message =
            caught instanceof Error && caught.message
              ? caught.message
              : "Falha ao atualizar status.";
          toast.error(message);
        });
    });
  }

  function openCancelDialog() {
    setCancelError(null);
    setCancelNotes("");
    cancelDialogRef.current?.showModal();
  }

  function closeCancelDialog() {
    cancelDialogRef.current?.close();
  }

  function submitCancel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = cancelNotes.trim();
    if (trimmed.length < 3) {
      setCancelError("Informe o motivo do cancelamento (mínimo 3 caracteres).");
      return;
    }

    closeCancelDialog();
    performTransition(WebOrderStatus.CANCELLED, trimmed);
  }

  const customerLabel = isAnonymized(order) ? "Cliente removido" : order.customerName;
  const phoneLabel = isAnonymized(order) || !order.customerPhone
    ? "—"
    : formatPhoneBr(order.customerPhone);

  return (
    <div className="stack web-order-detail">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Pedido web</p>
            <h2>#{order.id.slice(0, 8).toUpperCase()}</h2>
            <p className="muted">
              <span className={STATUS_BADGE_CLASS[order.status]}>{STATUS_LABELS[order.status]}</span>
              {" "}
              {mountedClientTime ? `· criado ${formatTimeAgo(order.createdAt, mountedClientTime)}` : null}
            </p>
          </div>

          <div className="button-row">
            {nonCancelTransitions.map((status) => (
              <button
                key={status}
                type="button"
                className="button button-primary compact"
                onClick={() => performTransition(status)}
                disabled={isPending}
              >
                {TRANSITION_LABELS[status]}
              </button>
            ))}
            {canCancel ? (
              <button
                type="button"
                className="button button-secondary compact"
                onClick={openCancelDialog}
                disabled={isPending}
              >
                Cancelar pedido
              </button>
            ) : null}
          </div>
        </div>

      </section>

      <section className="panel">
        <div className="panel-header small">
          <h3>Cliente</h3>
        </div>
        <dl className="web-order-info">
          <div>
            <dt>Nome</dt>
            <dd>
              {customerLabel}
              {isAnonymized(order) ? <span className="badge danger">Cliente removido</span> : null}
            </dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd>{phoneLabel}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{isAnonymized(order) ? "—" : order.customerEmail}</dd>
          </div>
        </dl>
      </section>

      {order.addressStreet ? (
        <section className="panel">
          <div className="panel-header small">
            <h3>Endereço de entrega</h3>
          </div>
          <p>
            {order.addressStreet}, {order.addressNumber}
            {order.addressComplement ? ` · ${order.addressComplement}` : ""}
          </p>
          <p className="muted">
            {order.addressNeighborhood} · {order.addressCity}/{order.addressState} · CEP {order.addressZip}
          </p>
          {order.addressReference ? <p className="muted">Referência: {order.addressReference}</p> : null}

          {(() => {
            const queryParts = [
              `${order.addressStreet}, ${order.addressNumber}`,
              order.addressNeighborhood,
              order.addressCity && order.addressState
                ? `${order.addressCity} - ${order.addressState}`
                : order.addressCity ?? order.addressState ?? "",
              order.addressZip ? `CEP ${order.addressZip}` : "",
            ].filter((part) => part && part.trim().length > 0);
            const query = encodeURIComponent(queryParts.join(", "));

            return (
              <div className="web-order-navigation">
                <a
                  className="button button-google-maps compact"
                  href={`https://www.google.com/maps/search/?api=1&query=${query}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
                  </svg>
                  Abrir no Google Maps
                </a>
                <a
                  className="button button-waze compact"
                  href={`https://www.waze.com/ul?q=${query}&navigate=yes`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M21 11c0 3.87-2.79 7.15-6.5 7.84V20a2 2 0 1 1-4 0v-.16a8.05 8.05 0 0 1-2.27-.8 2 2 0 1 1-1.69-3.6c.59.28 1.23.48 1.91.6a5 5 0 0 0 9.55-2.04 1 1 0 1 1 2-.1V11ZM12 3a8 8 0 0 1 8 7.6 1 1 0 1 1-2 .1A6 6 0 0 0 6 11v1a1 1 0 0 1-2 0v-1a8 8 0 0 1 8-8Zm-2 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
                  </svg>
                  Abrir no Waze
                </a>
              </div>
            );
          })()}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header small">
          <h3>Itens</h3>
        </div>
        <ul className="web-order-items">
          {order.items.map((item) => (
            <li key={item.id} className="web-order-item">
              <div>
                <strong>{item.productName}</strong>
                <span className="muted">
                  {item.quantity} × {formatCurrency(item.unitPriceCents)}
                </span>
              </div>
              <strong>{formatCurrency(item.lineTotalCents)}</strong>
            </li>
          ))}
        </ul>
        <div className="web-order-total">
          <span>Total</span>
          <strong>{formatCurrency(order.totalCents)}</strong>
        </div>
        {order.notes ? <p className="muted">Notas do cliente: {order.notes}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header small">
          <h3>Histórico de status</h3>
        </div>
        <ul className="web-order-timeline">
          {order.statusLogs.map((log) => (
            <li key={log.id}>
              <strong>
                {log.fromStatus ? `${STATUS_LABELS[log.fromStatus]} → ` : ""}
                {STATUS_LABELS[log.toStatus]}
              </strong>
              <span className="muted">
                {log.actorType === "system" ? "Sistema" : log.actorName ?? "Admin"} ·{" "}
                {formatDisplayDate(new Date(log.createdAt))} {new Date(log.createdAt).toLocaleTimeString("pt-BR")}
              </span>
              {log.notes ? <p>{log.notes}</p> : null}
              {log.actorType === "system" && log.toStatus === WebOrderStatus.CANCELLED ? (
                <p className="muted">Cancelado automaticamente por expiração do tempo de pagamento.</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <dialog ref={cancelDialogRef} className="web-order-cancel-dialog">
        <form method="dialog" onSubmit={submitCancel}>
          <h3>Cancelar pedido</h3>
          <p className="muted">Informe o motivo do cancelamento (mínimo 3 caracteres).</p>
          <textarea
            value={cancelNotes}
            onChange={(event) => setCancelNotes(event.target.value)}
            rows={4}
            placeholder="Ex.: Cliente desistiu, problema operacional, etc."
          />
          {cancelError ? <p className="form-error compact">{cancelError}</p> : null}
          <div className="button-row">
            <button type="button" className="button button-secondary compact" onClick={closeCancelDialog}>
              Voltar
            </button>
            <button type="submit" className="button button-primary compact">
              Confirmar cancelamento
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
