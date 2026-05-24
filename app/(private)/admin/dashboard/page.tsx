import Link from "next/link";

import { DashboardSalesChart } from "@/components/dashboard-sales-chart";
import { requireServerSession } from "@/lib/auth/session";
import { getDashboardAnalytics, getDashboardData } from "@/lib/services/report-service";
import { resolveDashboardAnalyticsRange } from "@/lib/services/report-analytics";
import { formatCurrency } from "@/lib/utils/money";
import { listOpenCommandas } from "@/lib/services/commanda-service";
import { formatDisplayDate } from "@/lib/utils/date";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DashboardTab = "day" | "analytics";

function buildDashboardTabHref(tab: DashboardTab, startInput: string, endInput: string, isDefaultRange: boolean) {
  const params = new URLSearchParams();

  if (tab === "analytics") {
    params.set("tab", "analytics");
  }

  if (!isDefaultRange) {
    params.set("start", startInput);
    params.set("end", endInput);
  }

  const query = params.toString();
  return query ? `/admin/dashboard?${query}` : "/admin/dashboard";
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireServerSession();

  const params = (await searchParams) ?? {};
  const activeTab: DashboardTab = typeof params.tab === "string" && params.tab === "analytics" ? "analytics" : "day";
  const analyticsRange = resolveDashboardAnalyticsRange(params.start, params.end);
  const dayTabHref = buildDashboardTabHref("day", analyticsRange.startInput, analyticsRange.endInput, analyticsRange.isDefault);
  const analyticsTabHref = buildDashboardTabHref(
    "analytics",
    analyticsRange.startInput,
    analyticsRange.endInput,
    analyticsRange.isDefault,
  );
  const [dashboard, analytics, openCommandas] = await Promise.all([
    getDashboardData(),
    getDashboardAnalytics(analyticsRange),
    listOpenCommandas(),
  ]);

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <p className="eyebrow">{activeTab === "day" ? "Resumo do dia" : "Analítico"}</p>
          <h1>{activeTab === "day" ? "Operação em tempo real" : "Leitura analítica das vendas"}</h1>
          <p className="muted">
            {activeTab === "day"
              ? "O painel mostra o que está aberto agora, quanto já vendeu hoje e onde o estoque exige atenção."
              : "Acompanhe tendência diária, desempenho do período e os itens que mais puxam faturamento."}
          </p>
        </div>
        <Link href="/admin/commandas" className="button button-primary">
          Ir para o PDV
        </Link>
      </section>

      <nav className="dashboard-tabs" aria-label="Abas do dashboard">
        <Link href={dayTabHref} className={`dashboard-tab${activeTab === "day" ? " active" : ""}`}>
          Do dia
        </Link>
        <Link href={analyticsTabHref} className={`dashboard-tab${activeTab === "analytics" ? " active" : ""}`}>
          Analítico
        </Link>
      </nav>

      {activeTab === "day" ? (
        <>
          <div className="stats-grid">
            <article className="stat-card">
              <span>Vendas do dia</span>
              <strong>{formatCurrency(dashboard.summary.totalSalesCents)}</strong>
            </article>
            <article className="stat-card">
              <span>Comandas fechadas</span>
              <strong>{dashboard.summary.closedCommandasCount}</strong>
            </article>
            <article className="stat-card">
              <span>Comandas abertas</span>
              <strong>{dashboard.summary.openCommandasCount}</strong>
            </article>
            <article className="stat-card">
              <span>Estoque crítico</span>
              <strong>{dashboard.summary.lowStockCount}</strong>
            </article>
          </div>

          <div className="page-grid two-columns">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Em atendimento</p>
                  <h2>Comandas abertas</h2>
                </div>
                <Link href="/admin/commandas" className="button button-secondary">
                  Abrir comandas
                </Link>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Comanda</th>
                      <th>Operador</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openCommandas.map((commanda) => (
                      <tr key={commanda.id}>
                        <td>
                          <strong>#{commanda.number}</strong>
                          <span className="table-subtitle">{commanda.customerName || "Sem identificação"}</span>
                        </td>
                        <td>{commanda.operatorName}</td>
                        <td>{formatCurrency(commanda.totalCents)}</td>
                      </tr>
                    ))}
                    {openCommandas.length === 0 ? (
                      <tr>
                        <td colSpan={3}>Nenhuma comanda aberta.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Radar</p>
                  <h2>Produtos com alerta</h2>
                </div>
              </div>

              <div className="stack">
                {dashboard.lowStockProducts.map((product) => (
                  <article key={product.id} className="stock-card">
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.stockQty} em saldo</span>
                    </div>
                    <span className={product.stockQty < 0 ? "badge danger" : "badge warning"}>
                      mínimo {product.minimumStock}
                    </span>
                  </article>
                ))}
                {dashboard.lowStockProducts.length === 0 ? (
                  <p className="muted">Nenhum produto em situação crítica.</p>
                ) : null}
              </div>

              <div className="top-products">
                <p className="eyebrow">Mais vendidos hoje</p>
                {dashboard.summary.topProducts.map((item) => (
                  <article key={item.productName} className="top-product-row">
                    <strong>{item.productName}</strong>
                    <span>
                      {item.quantity} itens · {formatCurrency(item.totalCents)}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}

      {activeTab === "analytics" ? (
        <>
          <section className="panel analytics-filter-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Analítico</p>
                <h2>Vendas por período</h2>
                <p className="muted">
                  Acompanhe tendência diária e itens mais vendidos sem perder o histórico do período selecionado.
                </p>
              </div>
              <span className="badge neutral">
                {formatDisplayDate(analyticsRange.startDate)} até {formatDisplayDate(analyticsRange.endDate)}
              </span>
            </div>

            <form className="field-grid analytics-filter-grid" method="GET">
              <input type="hidden" name="tab" value="analytics" />
              <label className="field">
                <span>Início</span>
                <input name="start" type="date" defaultValue={analyticsRange.startInput} />
              </label>

              <label className="field">
                <span>Fim</span>
                <input name="end" type="date" defaultValue={analyticsRange.endInput} />
              </label>

              <div className="field action-field analytics-filter-actions">
                <button className="button button-primary" type="submit">
                  Aplicar período
                </button>
              </div>

              <div className="field action-field analytics-filter-actions">
                <Link href="/dashboard?tab=analytics" className="button button-secondary">
                  Resetar
                </Link>
              </div>
            </form>
          </section>

          <div className="stats-grid analytics-stats-grid">
            <article className="stat-card">
              <span>Faturamento no período</span>
              <strong>{formatCurrency(analytics.summary.totalSalesCents)}</strong>
            </article>
            <article className="stat-card">
              <span>Comandas fechadas no período</span>
              <strong>{analytics.summary.closedCommandasCount}</strong>
            </article>
            <article className="stat-card">
              <span>Ticket médio</span>
              <strong>{formatCurrency(analytics.summary.averageTicketCents)}</strong>
            </article>
            <article className="stat-card">
              <span>Itens vendidos no período</span>
              <strong>{analytics.summary.itemsSoldCount}</strong>
            </article>
          </div>

          <div className="page-grid analytics-grid">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Série diária</p>
                  <h2>Vendas dia a dia</h2>
                </div>
                {analyticsRange.isDefault ? <span className="badge neutral">Últimos 7 dias</span> : null}
              </div>

              <DashboardSalesChart data={analytics.salesByDay} />
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Ranking</p>
                  <h2>Itens mais vendidos</h2>
                </div>
              </div>

              <div className="top-products">
                {analytics.topProducts.map((item) => (
                  <article key={item.productId} className="top-product-row">
                    <strong>{item.productName}</strong>
                    <span>
                      {item.quantity} itens · {formatCurrency(item.totalCents)}
                    </span>
                  </article>
                ))}
                {analytics.topProducts.length === 0 ? (
                  <p className="muted">Nenhuma venda fechada no período selecionado.</p>
                ) : null}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
