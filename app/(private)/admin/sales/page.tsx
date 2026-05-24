import { requireServerSession } from "@/lib/auth/session";
import { listClosedCommandas } from "@/lib/services/commanda-service";
import { listOperators } from "@/lib/services/report-service";
import { paymentMethodSchema } from "@/lib/schemas/shared";
import { parseOptionalDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/money";

type SalesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesPage({ searchParams }: SalesPageProps) {
  await requireServerSession();

  const params = (await searchParams) ?? {};
  const start = typeof params.start === "string" ? params.start : "";
  const end = typeof params.end === "string" ? params.end : "";
  const operatorId = typeof params.operatorId === "string" ? params.operatorId : "";
  const paymentMethod = typeof params.paymentMethod === "string" ? params.paymentMethod : "";
  const parsedPaymentMethod = paymentMethodSchema.safeParse(paymentMethod).success ? paymentMethodSchema.parse(paymentMethod) : null;

  const [commandas, operators] = await Promise.all([
    listClosedCommandas({
      startDate: parseOptionalDate(start, "start"),
      endDate: parseOptionalDate(end, "end"),
      operatorId: operatorId || null,
      paymentMethod: parsedPaymentMethod,
    }),
    listOperators(),
  ]);

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <p className="eyebrow">Histórico</p>
          <h1>Vendas registradas</h1>
          <p className="muted">
            Use os filtros para acompanhar fechamento por período, operador e forma de pagamento.
          </p>
        </div>
      </section>

      <section className="panel">
        <form className="field-grid" method="GET">
          <label className="field">
            <span>Início</span>
            <input name="start" type="date" defaultValue={start} />
          </label>

          <label className="field">
            <span>Fim</span>
            <input name="end" type="date" defaultValue={end} />
          </label>

          <label className="field">
            <span>Operador</span>
            <select name="operatorId" defaultValue={operatorId}>
              <option value="">Todos</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Pagamento</span>
            <select name="paymentMethod" defaultValue={paymentMethod}>
              <option value="">Todos</option>
              <option value="cash">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="debit">Débito</option>
              <option value="credit">Crédito</option>
            </select>
          </label>

          <div className="field action-field">
            <button className="button button-primary" type="submit">
              Aplicar filtros
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Comanda</th>
                <th>Operador</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Pagamento</th>
              </tr>
            </thead>
            <tbody>
              {commandas.map((commanda) => (
                <tr key={commanda.id}>
                  <td>
                    <strong>#{commanda.number}</strong>
                    <span className="table-subtitle">{commanda.closedAt?.replace("T", " ").slice(0, 16)}</span>
                  </td>
                  <td>{commanda.operatorName}</td>
                  <td>{commanda.items.length}</td>
                  <td>{formatCurrency(commanda.totalCents)}</td>
                  <td>{commanda.payments.map((payment) => payment.method).join(", ")}</td>
                </tr>
              ))}
              {commandas.length === 0 ? (
                <tr>
                  <td colSpan={5}>Nenhuma venda encontrada para os filtros selecionados.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
