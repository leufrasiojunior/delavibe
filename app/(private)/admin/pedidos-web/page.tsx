import { WebOrderStatus } from "@prisma/client";

import { WebOrdersBoard } from "@/components/web-orders-board";
import { requireServerSession } from "@/lib/auth/session";
import {
  WEB_ORDER_ACTIVE_STATUS_LIST,
  WEB_ORDER_HISTORY_STATUS_LIST,
  webOrderListQuerySchema,
} from "@/lib/schemas/web-order";
import { listWebOrders } from "@/lib/services/web-order-service";

export const dynamic = "force-dynamic";

type PedidosWebPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeStatusParam(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

export default async function PedidosWebPage({ searchParams }: PedidosWebPageProps) {
  await requireServerSession();
  const params = await searchParams;

  const parsed = webOrderListQuerySchema.parse({
    tab: typeof params.tab === "string" ? params.tab : undefined,
    status: normalizeStatusParam(params.status),
    query: typeof params.query === "string" ? params.query : undefined,
    take: typeof params.take === "string" ? params.take : undefined,
    skip: typeof params.skip === "string" ? params.skip : undefined,
  });

  const statusFilter: WebOrderStatus[] =
    parsed.status?.length
      ? parsed.status
      : parsed.tab === "active"
        ? WEB_ORDER_ACTIVE_STATUS_LIST
        : WEB_ORDER_HISTORY_STATUS_LIST;

  const result = await listWebOrders({
    status: statusFilter,
    query: parsed.query ?? null,
    take: parsed.take,
    skip: parsed.skip,
  });

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <p className="eyebrow">Pedidos web</p>
          <h1>Acompanhe os pedidos online</h1>
          <p className="muted">
            Confirme pagamentos presenciais, avance o preparo e mantenha a tela aberta — novos pedidos aparecem
            automaticamente a cada 30 segundos.
          </p>
        </div>
      </section>

      <WebOrdersBoard
        initialItems={result.items}
        initialTotal={result.total}
        initialFilters={{
          tab: parsed.tab,
          status: parsed.status ?? [],
          query: parsed.query ?? "",
          take: parsed.take,
          skip: parsed.skip,
        }}
      />
    </div>
  );
}
