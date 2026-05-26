"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { CircleDollarSign, Eye, History, ListChecks, RefreshCw } from "lucide-react";

import { PaymentMethod, WebOrderStatus } from "@prisma/client";

import { Modal } from "@/components/modal";
import { apiFetch } from "@/lib/api/client";
import {
  webOrderListResponseSchema,
  webOrderSchema,
  WEB_ORDER_ACTIVE_STATUS_LIST,
  WEB_ORDER_HISTORY_STATUS_LIST,
  type WebOrderDto,
} from "@/lib/schemas/web-order";
import {
  centsToCurrencyInput,
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInputToCents,
} from "@/lib/utils/money";
import { formatTimeAgo } from "@/lib/utils/date";
import { WEB_ORDER_TRANSITIONS } from "@/lib/utils/web-order-status";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ORDER,
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  TRANSITION_ICONS,
  TRANSITION_LABELS,
} from "@/lib/web-order-ui-config";
import { useToast } from "@/components/toast";

const POLL_INTERVAL_MS = 30_000;
const NEW_HIGHLIGHT_MS = 10_000;

type Tab = "active" | "history";

type Filters = {
  tab: Tab;
  status: WebOrderStatus[];
  query: string;
  take: number;
  skip: number;
};

type WebOrdersBoardProps = {
  initialItems: WebOrderDto[];
  initialTotal: number;
  initialFilters: Filters;
};

function statusOptionsForTab(tab: Tab): WebOrderStatus[] {
  return tab === "active" ? WEB_ORDER_ACTIVE_STATUS_LIST : WEB_ORDER_HISTORY_STATUS_LIST;
}

function buildSearchParamsFromFilters(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("tab", filters.tab);

  for (const status of filters.status) {
    params.append("status", status);
  }

  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }

  if (filters.take !== 50) {
    params.set("take", String(filters.take));
  }

  if (filters.skip > 0) {
    params.set("skip", String(filters.skip));
  }

  return params;
}

export function WebOrdersBoard({
  initialItems,
  initialTotal,
  initialFilters,
}: WebOrdersBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [items, setItems] = useState<WebOrderDto[]>(initialItems);
  const [total, setTotal] = useState<number>(initialTotal);
  const [isFetching, setIsFetching] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [mountedClientTime, setMountedClientTime] = useState<Date | null>(null);
  const [isTransitioning, startTransition] = useTransition();
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [selectedMethods, setSelectedMethods] = useState<Set<PaymentMethod>>(new Set());
  const [paymentInputs, setPaymentInputs] = useState<Record<PaymentMethod, string>>({
    cash: "",
    pix: "",
    debit: "",
    credit: "",
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const previousIdsRef = useRef<Set<string>>(new Set(initialItems.map((item) => item.id)));
  const inFlightRef = useRef(false);

  const paymentOrder = useMemo(
    () => (paymentOrderId ? items.find((o) => o.id === paymentOrderId) ?? null : null),
    [paymentOrderId, items],
  );

  useEffect(() => {
    setMountedClientTime(new Date());
  }, []);

  const availableStatuses = useMemo(() => statusOptionsForTab(filters.tab), [filters.tab]);

  const fetchOrders = useCallback(
    async (next: Filters) => {
      if (inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      setIsFetching(true);

      try {
        const params = buildSearchParamsFromFilters(next);
        const response = await apiFetch(
          `/api/admin/web-orders?${params.toString()}`,
          { method: "GET" },
          webOrderListResponseSchema,
        );

        const previous = previousIdsRef.current;
        const detected = new Set<string>();
        for (const item of response.items) {
          if (!previous.has(item.id)) {
            detected.add(item.id);
          }
        }

        previousIdsRef.current = new Set(response.items.map((item) => item.id));
        setItems(response.items);
        setTotal(response.total);

        if (detected.size > 0) {
          setNewIds((current) => {
            const merged = new Set(current);
            for (const id of detected) {
              merged.add(id);
            }
            return merged;
          });

          window.setTimeout(() => {
            setNewIds((current) => {
              const next = new Set(current);
              for (const id of detected) {
                next.delete(id);
              }
              return next;
            });
          }, NEW_HIGHLIGHT_MS);
        }
      } catch (caught) {
        const message =
          caught instanceof Error && caught.message
            ? caught.message
            : "Falha ao atualizar pedidos.";
        toast.error(message);
      } finally {
        inFlightRef.current = false;
        setIsFetching(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    const params = buildSearchParamsFromFilters(filters);
    const current = searchParams.toString();
    if (params.toString() !== current) {
      router.replace(`/admin/pedidos-web?${params.toString()}`, { scroll: false });
    }
  }, [filters, router, searchParams]);

  useEffect(() => {
    let pollTimer: number | undefined;
    let mounted = true;

    function schedule() {
      if (!mounted) return;
      pollTimer = window.setTimeout(async () => {
        if (document.visibilityState === "visible") {
          await fetchOrders(filters);
        }
        schedule();
      }, POLL_INTERVAL_MS);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void fetchOrders(filters);
      }
    }

    schedule();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      if (pollTimer) window.clearTimeout(pollTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [filters, fetchOrders]);

  function handleTabChange(tab: Tab) {
    setFilters((current) => ({ ...current, tab, status: [], skip: 0 }));
    setItems([]);
    setTotal(0);
    setIsFetching(true);
    void fetchOrders({ ...filters, tab, status: [], skip: 0 });
  }

  function toggleStatus(status: WebOrderStatus) {
    setFilters((current) => {
      const exists = current.status.includes(status);
      const next = exists
        ? current.status.filter((value) => value !== status)
        : [...current.status, status];
      const updated = { ...current, status: next, skip: 0 };
      void fetchOrders(updated);
      return updated;
    });
  }

  function handleQueryChange(value: string) {
    setFilters((current) => {
      const updated = { ...current, query: value, skip: 0 };
      return updated;
    });
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchOrders(filters);
    }, 300);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.query]);

  function refreshNow() {
    void fetchOrders(filters);
  }

  function updateLocalOrder(updated: WebOrderDto) {
    setItems((current) => current.map((o) => (o.id === updated.id ? updated : o)));
  }

  function performInlineTransition(
    orderId: string,
    toStatus: WebOrderStatus,
    payments?: { method: PaymentMethod; amountCents: number }[],
  ) {
    startTransition(() => {
      void apiFetch(
        `/api/admin/web-orders/${orderId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ toStatus, notes: null, payments: payments ?? null }),
        },
        webOrderSchema,
      )
        .then((updated) => {
          updateLocalOrder(updated);
          toast.success(`Status atualizado para ${STATUS_LABELS[updated.status]}.`);
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

  function openPaymentModal(order: WebOrderDto) {
    setPaymentOrderId(order.id);
    setSelectedMethods(new Set(["cash"]));
    setPaymentInputs({
      cash: centsToCurrencyInput(order.totalCents),
      pix: "",
      debit: "",
      credit: "",
    });
    setPaymentError(null);
  }

  function closePaymentModal() {
    setPaymentOrderId(null);
    setPaymentError(null);
  }

  function togglePaymentMethod(method: PaymentMethod) {
    if (!paymentOrder) return;
    setPaymentError(null);
    setSelectedMethods((currentSet) => {
      const next = new Set(currentSet);
      if (next.has(method)) {
        next.delete(method);
        setPaymentInputs((inputs) => ({ ...inputs, [method]: "" }));
      } else {
        next.add(method);
        const sumOthers = Array.from(next)
          .filter((m) => m !== method)
          .reduce(
            (acc, m) => acc + (parseCurrencyInputToCents(paymentInputs[m]) ?? 0),
            0,
          );
        const remaining = Math.max(0, paymentOrder.totalCents - sumOthers);
        setPaymentInputs((inputs) => ({
          ...inputs,
          [method]: centsToCurrencyInput(remaining),
        }));
      }
      return next;
    });
  }

  function setPaymentAmount(method: PaymentMethod, raw: string) {
    setPaymentError(null);
    setPaymentInputs((inputs) => ({ ...inputs, [method]: formatCurrencyInput(raw) }));
  }

  const paymentSumCents = (Array.from(selectedMethods) as PaymentMethod[]).reduce(
    (acc, m) => acc + (parseCurrencyInputToCents(paymentInputs[m]) ?? 0),
    0,
  );
  const paymentDiffCents = paymentOrder ? paymentOrder.totalCents - paymentSumCents : 0;

  function submitPayment() {
    if (!paymentOrder) return;
    if (selectedMethods.size === 0) {
      setPaymentError("Selecione pelo menos uma forma de pagamento.");
      return;
    }
    const entries: { method: PaymentMethod; amountCents: number }[] = [];
    for (const m of Array.from(selectedMethods) as PaymentMethod[]) {
      const cents = parseCurrencyInputToCents(paymentInputs[m]);
      if (cents === null || cents <= 0) {
        setPaymentError(`Informe o valor pago em ${PAYMENT_METHOD_LABELS[m]}.`);
        return;
      }
      entries.push({ method: m, amountCents: cents });
    }
    const sum = entries.reduce((a, e) => a + e.amountCents, 0);
    if (sum !== paymentOrder.totalCents) {
      setPaymentError(
        `A soma (${formatCurrency(sum)}) precisa bater com o total (${formatCurrency(paymentOrder.totalCents)}).`,
      );
      return;
    }
    const orderId = paymentOrder.id;
    closePaymentModal();
    performInlineTransition(orderId, WebOrderStatus.PAID, entries);
  }

  function handleInlineActionClick(order: WebOrderDto, toStatus: WebOrderStatus) {
    if (toStatus === WebOrderStatus.PAID) {
      openPaymentModal(order);
      return;
    }
    performInlineTransition(order.id, toStatus);
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Pedidos online</p>
            <h2>{total} {total === 1 ? "pedido" : "pedidos"} {filters.tab === "active" ? "ativos" : "no histórico"}</h2>
          </div>
          <div className="button-row">
            <button className="button button-secondary compact" type="button" onClick={refreshNow} disabled={isFetching}>
              <RefreshCw size={14} aria-hidden className={isFetching ? "spin" : undefined} />
              {isFetching ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        <div className="web-orders-toolbar">
          <div className="web-orders-tabs">
            <button
              type="button"
              className={filters.tab === "active" ? "tab active" : "tab"}
              onClick={() => handleTabChange("active")}
            >
              <ListChecks size={14} aria-hidden />
              Ativos
            </button>
            <button
              type="button"
              className={filters.tab === "history" ? "tab active" : "tab"}
              onClick={() => handleTabChange("history")}
            >
              <History size={14} aria-hidden />
              Histórico
            </button>
          </div>

          <div className="web-orders-status-filter">
            {availableStatuses.map((status) => (
              <label key={status} className="checkbox-field">
                <input
                  type="checkbox"
                  checked={filters.status.includes(status)}
                  onChange={() => toggleStatus(status)}
                />
                <span>{STATUS_LABELS[status]}</span>
              </label>
            ))}
          </div>

          <input
            className="web-orders-search"
            placeholder="Buscar por nome ou telefone"
            value={filters.query}
            onChange={(event) => handleQueryChange(event.target.value)}
          />
        </div>


        {items.length === 0 ? (
          <p className="muted">
            {filters.tab === "active"
              ? "Nenhum pedido ativo no momento. Novos pedidos aparecerão aqui automaticamente."
              : "Nenhum pedido no histórico com os filtros atuais."}
          </p>
        ) : (
          <ul className="web-orders-list">
            {items.map((order) => {
              const isNew = newIds.has(order.id);
              const nextActions = (WEB_ORDER_TRANSITIONS[order.status] ?? []).filter(
                (s) => s !== WebOrderStatus.CANCELLED && s !== WebOrderStatus.DELIVERED,
              );
              return (
                <li key={order.id} className={isNew ? "web-order-card new" : "web-order-card"}>
                  <div className="web-order-card-main">
                    <div className="web-order-card-head">
                      <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                      <span className={STATUS_BADGE_CLASS[order.status]}>{STATUS_LABELS[order.status]}</span>
                      {isNew ? <span className="badge success">Novo!</span> : null}
                    </div>
                    <p className="muted">
                      {order.customerName}
                      {order.customerPhone ? ` · ${order.customerPhone}` : ""}
                    </p>
                    <p className="web-order-card-foot">
                      <strong>{formatCurrency(order.totalCents)}</strong>
                      {mountedClientTime ? (
                        <span className="muted">
                          {formatTimeAgo(order.createdAt, mountedClientTime)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="web-order-card-actions">
                    {nextActions.map((status) => {
                      const Icon = TRANSITION_ICONS[status];
                      return (
                        <button
                          key={status}
                          type="button"
                          className="button button-primary compact"
                          onClick={() => handleInlineActionClick(order, status)}
                          disabled={isTransitioning}
                        >
                          <Icon size={14} aria-hidden />
                          {TRANSITION_LABELS[status]}
                        </button>
                      );
                    })}
                    <Link
                      className="button button-secondary compact"
                      href={`/admin/pedidos-web/${order.id}`}
                    >
                      <Eye size={14} aria-hidden />
                      Ver detalhe
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        isOpen={paymentOrder !== null}
        onClose={closePaymentModal}
        title="Marcar como pago"
        size="sm"
      >
        {paymentOrder ? (
          <>
            <p className="muted">
              Selecione as formas de pagamento e os valores. A soma precisa fechar com o total do
              pedido (<strong>{formatCurrency(paymentOrder.totalCents)}</strong>).
            </p>
            <div className="payment-breakdown-grid">
              {PAYMENT_METHOD_ORDER.map((method) => {
                const isChecked = selectedMethods.has(method);
                return (
                  <div key={method} className="payment-breakdown-row">
                    <label className="payment-method-option">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePaymentMethod(method)}
                      />
                      <span>{PAYMENT_METHOD_LABELS[method]}</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="payment-amount-input"
                      placeholder="R$ 0,00"
                      value={paymentInputs[method]}
                      onChange={(event) => setPaymentAmount(method, event.target.value)}
                      disabled={!isChecked}
                      aria-label={`Valor pago em ${PAYMENT_METHOD_LABELS[method]}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className={`payment-summary ${paymentDiffCents === 0 ? "ok" : "mismatch"}`}>
              <span>
                Soma:&nbsp;<strong>{formatCurrency(paymentSumCents)}</strong>&nbsp;/&nbsp;
                <strong>{formatCurrency(paymentOrder.totalCents)}</strong>
              </span>
              {paymentDiffCents === 0 ? <strong>Valores conferem ✓</strong> : null}
            </div>
            {paymentDiffCents > 0 ? (
              <div className="payment-alert payment-alert--warn">
                <strong>Faltam {formatCurrency(paymentDiffCents)}.</strong> Ajuste os valores ou
                selecione outra forma de pagamento para completar o total.
              </div>
            ) : null}
            {paymentDiffCents < 0 ? (
              <div className="payment-alert payment-alert--warn">
                <strong>Sobra {formatCurrency(Math.abs(paymentDiffCents))}.</strong> A soma excede
                o total do pedido — revise os valores informados.
              </div>
            ) : null}
            <p className="muted small">
              Ao confirmar, o pedido sera marcado como <strong>Pago</strong> e em seguida{" "}
              <strong>Entregue</strong>.
            </p>
            {paymentError ? <p className="form-error compact">{paymentError}</p> : null}
            <div className="button-row">
              <button
                type="button"
                className="button button-secondary compact"
                onClick={closePaymentModal}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button button-primary compact"
                onClick={submitPayment}
                disabled={
                  selectedMethods.size === 0 || paymentDiffCents !== 0 || isTransitioning
                }
              >
                <CircleDollarSign size={14} aria-hidden />
                Confirmar pagamento
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
