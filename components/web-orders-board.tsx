"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, History, ListChecks, RefreshCw } from "lucide-react";

import { WebOrderStatus } from "@prisma/client";

import { apiFetch } from "@/lib/api/client";
import {
  WEB_ORDER_ACTIVE_STATUS_LIST,
  WEB_ORDER_HISTORY_STATUS_LIST,
  webOrderListResponseSchema,
  type WebOrderDto,
} from "@/lib/schemas/web-order";
import { formatCurrency } from "@/lib/utils/money";
import { formatTimeAgo } from "@/lib/utils/date";
import { useToast } from "@/components/toast";

const POLL_INTERVAL_MS = 30_000;
const NEW_HIGHLIGHT_MS = 10_000;

const STATUS_LABELS: Record<WebOrderStatus, string> = {
  PENDING_PAYMENT: "Recebido",
  PAID: "Pago",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const STATUS_BADGE_CLASS: Record<WebOrderStatus, string> = {
  PENDING_PAYMENT: "badge warning",
  PAID: "badge neutral",
  PREPARING: "badge neutral",
  READY: "badge neutral",
  OUT_FOR_DELIVERY: "badge warning",
  DELIVERED: "badge success",
  CANCELLED: "badge danger",
};

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

  const previousIdsRef = useRef<Set<string>>(new Set(initialItems.map((item) => item.id)));
  const inFlightRef = useRef(false);

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
                  <Link className="button button-secondary compact" href={`/admin/pedidos-web/${order.id}`}>
                    <Eye size={14} aria-hidden />
                    Ver detalhe
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
