"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api/client";
import {
  commandaMutationResponseSchema,
  commandaSchema,
  type CommandaDto,
} from "@/lib/schemas/commanda";
import type { ProductDto } from "@/lib/schemas/product";
import type { CommandaBoardStatusTab } from "@/lib/utils/commandas";
import { filterCommandasByStatusAndCustomerName } from "@/lib/utils/commandas";
import {
  centsToCurrencyInput,
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInputToCents,
} from "@/lib/utils/money";

type CommandaBoardProps = {
  commandas: CommandaDto[];
  products: ProductDto[];
};

type PaymentDraft = {
  method: "cash" | "pix" | "debit" | "credit";
  amount: string;
  notes: string;
};

const SINGLE_SALE_CUSTOMER_NAME = "Venda avulsa";

function createPaymentDraft(totalCents?: number | null): PaymentDraft {
  return {
    method: "cash",
    amount: totalCents != null && totalCents > 0 ? centsToCurrencyInput(totalCents) : "",
    notes: "",
  };
}

function buildProductDetails(product: ProductDto) {
  const parts = [];

  if (product.sku) {
    parts.push(`SKU ${product.sku}`);
  }

  parts.push(`CB ${product.barcode}`);

  if (product.category) {
    parts.push(product.category);
  }

  return parts.join(" · ");
}

function formatRecordedAt(value?: string | null) {
  if (!value) {
    return null;
  }

  return value.replace("T", " ").slice(0, 16);
}

function getCommandaStatusLabel(status: CommandaDto["status"]) {
  if (status === "closed") {
    return "Fechada";
  }

  if (status === "cancelled") {
    return "Cancelada";
  }

  return "Aberta";
}

function getPaymentMethodLabel(method: PaymentDraft["method"]) {
  if (method === "pix") {
    return "Pix";
  }

  if (method === "debit") {
    return "Debito";
  }

  if (method === "credit") {
    return "Credito";
  }

  return "Dinheiro";
}

function getCommandaCustomerLabel(customerName?: string | null) {
  return customerName?.trim() || "Sem identificacao";
}

export function CommandaBoard({ commandas, products }: CommandaBoardProps) {
  const router = useRouter();
  const firstOpenCommandaId = commandas.find((commanda) => commanda.status === "open")?.id ?? null;
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(firstOpenCommandaId);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [singleSaleCustomerName, setSingleSaleCustomerName] = useState("");
  const [renameCustomerName, setRenameCustomerName] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [commandaSearch, setCommandaSearch] = useState("");
  const [activeCommandaTab, setActiveCommandaTab] = useState<CommandaBoardStatusTab>("open");
  const [quantityByProduct, setQuantityByProduct] = useState<Record<string, string>>({});
  const [itemQuantityDrafts, setItemQuantityDrafts] = useState<Record<string, string>>({});
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentDraft[]>([createPaymentDraft()]);
  const [isPending, startTransition] = useTransition();

  const deferredProductSearch = useDeferredValue(productSearch);
  const deferredCommandaSearch = useDeferredValue(commandaSearch);

  const filteredProducts = useMemo(() => {
    const query = deferredProductSearch.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) =>
      [product.name, product.sku ?? "", product.barcode, product.category ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [deferredProductSearch, products]);

  const visibleCommandas = useMemo(
    () => filterCommandasByStatusAndCustomerName(commandas, activeCommandaTab, deferredCommandaSearch),
    [activeCommandaTab, commandas, deferredCommandaSearch],
  );

  const selectedComanda = useMemo(
    () => commandas.find((commanda) => commanda.id === selectedComandaId) ?? null,
    [commandas, selectedComandaId],
  );

  const openCommandasCount = useMemo(
    () => commandas.filter((commanda) => commanda.status === "open").length,
    [commandas],
  );
  const closedCommandasCount = useMemo(
    () => commandas.filter((commanda) => commanda.status === "closed").length,
    [commandas],
  );
  const canEditSelectedComanda = selectedComanda?.status === "open";

  const paymentSummary = useMemo(() => {
    const preparedPayments = payments
      .map((payment) => ({
        ...payment,
        notes: payment.notes.trim(),
      }))
      .filter((payment) => payment.amount.trim().length > 0 || payment.notes.length > 0);

    const invalidAmount = preparedPayments.some((payment) => parseCurrencyInputToCents(payment.amount) == null);
    const totalCents = preparedPayments.reduce((sum, payment) => {
      const paymentCents = parseCurrencyInputToCents(payment.amount);
      return sum + (paymentCents ?? 0);
    }, 0);

    return {
      preparedPayments,
      invalidAmount,
      totalCents,
    };
  }, [payments]);

  const paymentDeltaCents = selectedComanda ? selectedComanda.totalCents - paymentSummary.totalCents : 0;

  useEffect(() => {
    if (selectedComandaId && visibleCommandas.some((commanda) => commanda.id === selectedComandaId)) {
      return;
    }

    setSelectedComandaId(visibleCommandas[0]?.id ?? null);
  }, [selectedComandaId, visibleCommandas]);

  useEffect(() => {
    setPayments([createPaymentDraft(selectedComanda?.status === "open" ? selectedComanda.totalCents : null)]);
  }, [selectedComanda?.id, selectedComanda?.status, selectedComanda?.totalCents]);

  useEffect(() => {
    setRenameCustomerName(selectedComanda?.customerName ?? "");
  }, [selectedComanda?.id, selectedComanda?.customerName]);

  useEffect(() => {
    if (!selectedComanda) {
      setItemQuantityDrafts({});
      return;
    }

    setItemQuantityDrafts(
      Object.fromEntries(selectedComanda.items.map((item) => [item.id, String(item.quantity)])),
    );
  }, [selectedComanda]);

  function quantityFor(productId: string) {
    const parsed = Number(quantityByProduct[productId] ?? "1");

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1;
    }

    return Math.floor(parsed);
  }

  function setProductQuantity(productId: string, value: string) {
    setQuantityByProduct((current) => ({
      ...current,
      [productId]: value,
    }));
  }

  function setCommandaItemDraft(itemId: string, value: string) {
    setItemQuantityDrafts((current) => ({
      ...current,
      [itemId]: value,
    }));
  }

  function markItemPending(itemId: string, pending: boolean) {
    setPendingItemIds((current) => {
      if (pending) {
        return current.includes(itemId) ? current : [...current, itemId];
      }

      return current.filter((currentItemId) => currentItemId !== itemId);
    });
  }

  function isItemPending(itemId: string) {
    return pendingItemIds.includes(itemId);
  }

  function getDraftQuantity(item: CommandaDto["items"][number]) {
    const parsed = Number(itemQuantityDrafts[item.id] ?? String(item.quantity));

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return item.quantity;
    }

    return Math.floor(parsed);
  }

  function setPaymentAmount(index: number, value: string) {
    setPayments((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, amount: formatCurrencyInput(value) } : entry,
      ),
    );
  }

  function withHandledAction(action: () => Promise<void>) {
    setFeedback(null);
    setError(null);

    startTransition(() => {
      void action().catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel concluir a operacao.");
      });
    });
  }

  async function createCommanda(options?: { customerName?: string | null; notes?: string | null }) {
    const created = await apiFetch(
      "/api/commandas",
      {
        method: "POST",
        body: JSON.stringify({
          customerName: options?.customerName ?? (newCustomerName || null),
          notes: options?.notes ?? (newNotes || null),
        }),
      },
      commandaSchema,
    );

    setNewCustomerName("");
    setNewNotes("");
    setSingleSaleCustomerName("");
    setCommandaSearch("");
    setActiveCommandaTab("open");
    setSelectedComandaId(created.id);

    return created;
  }

  function handleCreateCommanda(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    withHandledAction(async () => {
      const created = await createCommanda();
      setFeedback(`Comanda #${created.number} criada e pronta para atendimento.`);
      router.refresh();
    });
  }

  function handleCreateSingleSale() {
    const nextCustomerName = singleSaleCustomerName.trim() || SINGLE_SALE_CUSTOMER_NAME;

    withHandledAction(async () => {
      const created = await createCommanda({
        customerName: nextCustomerName,
        notes: null,
      });
      setFeedback(`Comanda #${created.number} aberta para ${getCommandaCustomerLabel(created.customerName)}.`);
      router.refresh();
    });
  }

  function handleRenameSelectedCommanda(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedComanda) {
      return;
    }

    const nextName = renameCustomerName.trim();
    const currentName = selectedComanda.customerName?.trim() ?? "";

    if (nextName === currentName) {
      setFeedback("O nome da comanda ja esta atualizado.");
      setError(null);
      return;
    }

    withHandledAction(async () => {
      const updated = await apiFetch(
        `/api/commandas/${selectedComanda.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            customerName: renameCustomerName,
          }),
        },
        commandaSchema,
      );

      setFeedback(
        updated.customerName
          ? `Comanda #${updated.number} atualizada para ${updated.customerName}.`
          : `Comanda #${updated.number} ficou sem identificacao.`,
      );
      router.refresh();
    });
  }

  function handleAddItem(product: ProductDto) {
    if (!selectedComanda || selectedComanda.status !== "open") {
      setFeedback(null);
      setError("Abra uma comanda ou reabra uma fechada antes de adicionar itens.");
      return;
    }

    withHandledAction(async () => {
      const response = await apiFetch(
        `/api/commandas/${selectedComanda.id}/items`,
        {
          method: "POST",
          body: JSON.stringify({
            productId: product.id,
            quantity: quantityFor(product.id),
          }),
        },
        commandaMutationResponseSchema,
      );

      setQuantityByProduct((current) => ({
        ...current,
        [product.id]: "1",
      }));

      if (response.warning) {
        setFeedback(response.warning);
      } else {
        setFeedback(`Quantidade de ${product.name} atualizada na comanda #${response.commanda.number}.`);
      }

      router.refresh();
    });
  }

  function persistItemQuantity(item: CommandaDto["items"][number], requestedQuantity: string | number) {
    if (!selectedComanda || selectedComanda.status !== "open") {
      return;
    }

    const parsedQuantity = typeof requestedQuantity === "number" ? requestedQuantity : Number(requestedQuantity);
    const nextQuantity = Number.isFinite(parsedQuantity) ? Math.floor(parsedQuantity) : Number.NaN;

    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      setCommandaItemDraft(item.id, String(item.quantity));
      setFeedback(null);
      setError("A quantidade do item deve ser maior que zero.");
      return;
    }

    setCommandaItemDraft(item.id, String(nextQuantity));

    if (nextQuantity === item.quantity) {
      return;
    }

    markItemPending(item.id, true);

    withHandledAction(async () => {
      try {
        const response = await apiFetch(
          `/api/commandas/${selectedComanda.id}/items/${item.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              quantity: nextQuantity,
            }),
          },
          commandaMutationResponseSchema,
        );

        if (response.warning) {
          setFeedback(response.warning);
        } else {
          setFeedback(`Quantidade de ${item.productName} atualizada na comanda #${response.commanda.number}.`);
        }

        router.refresh();
      } finally {
        markItemPending(item.id, false);
      }
    });
  }

  function handleRemoveItem(itemId: string) {
    if (!selectedComanda || selectedComanda.status !== "open") {
      return;
    }

    markItemPending(itemId, true);

    withHandledAction(async () => {
      try {
        await apiFetch(
          `/api/commandas/${selectedComanda.id}/items/${itemId}`,
          { method: "DELETE" },
          commandaMutationResponseSchema,
        );
        setFeedback("Item removido e estoque recomposto.");
        router.refresh();
      } finally {
        markItemPending(itemId, false);
      }
    });
  }

  function handleCancelCommanda() {
    if (!selectedComanda || selectedComanda.status !== "open") {
      return;
    }

    withHandledAction(async () => {
      await apiFetch(
        `/api/commandas/${selectedComanda.id}/cancel`,
        { method: "POST" },
        commandaMutationResponseSchema,
      );
      setFeedback("Comanda cancelada com reversao do estoque.");
      router.refresh();
    });
  }

  function handleReopenCommanda() {
    if (!selectedComanda || selectedComanda.status !== "closed") {
      return;
    }

    withHandledAction(async () => {
      const response = await apiFetch(
        `/api/commandas/${selectedComanda.id}/reopen`,
        { method: "POST" },
        commandaMutationResponseSchema,
      );
      setActiveCommandaTab("open");
      setSelectedComandaId(response.commanda.id);
      setFeedback(`Comanda #${response.commanda.number} reaberta. Os pagamentos anteriores foram removidos.`);
      router.refresh();
    });
  }

  function handleCloseCommanda() {
    if (!selectedComanda || selectedComanda.status !== "open") {
      return;
    }

    if (paymentSummary.preparedPayments.length === 0) {
      setError("Informe ao menos uma forma de pagamento com valor.");
      return;
    }

    if (paymentSummary.invalidAmount) {
      setError("Revise os valores informados nas formas de pagamento.");
      return;
    }

    if (paymentSummary.totalCents !== selectedComanda.totalCents) {
      setError(`A soma dos pagamentos precisa fechar em ${formatCurrency(selectedComanda.totalCents)}.`);
      return;
    }

    withHandledAction(async () => {
      const response = await apiFetch(
        `/api/commandas/${selectedComanda.id}/close`,
        {
          method: "POST",
          body: JSON.stringify({
            payments: paymentSummary.preparedPayments.map((payment) => ({
              method: payment.method,
              amount: payment.amount,
              notes: payment.notes || null,
            })),
          }),
        },
        commandaMutationResponseSchema,
      );
      setActiveCommandaTab("closed");
      setSelectedComandaId(response.commanda.id);
      setFeedback("Venda fechada e pagamentos registrados.");
      router.refresh();
    });
  }

  return (
    <div className="commanda-layout">
      {feedback ? <p className="form-success">{feedback}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Comandas</p>
            <h2>Lista, abertura e retomada</h2>
            <p className="muted">Abra a comanda primeiro. O catalogo aparece no contexto da comanda selecionada.</p>
          </div>
        </div>

        <div className="commanda-creation-grid">
          <form className="stack commanda-creation-box" onSubmit={handleCreateCommanda}>
            <div>
              <p className="eyebrow">Abrir comanda</p>
              <p className="muted">Identifique o cliente agora ou deixe sem nome para renomear depois.</p>
            </div>

            <label className="field">
              <span>Nome do cliente</span>
              <input
                value={newCustomerName}
                onChange={(event) => setNewCustomerName(event.target.value)}
                placeholder="Mesa, nome ou apelido"
              />
            </label>

            <label className="field">
              <span>Observacoes</span>
              <textarea
                value={newNotes}
                onChange={(event) => setNewNotes(event.target.value)}
                rows={3}
                placeholder="Ex.: balcao, retirada, aniversario"
              />
            </label>

            <button className="button button-primary" type="submit" disabled={isPending}>
              {isPending ? "Criando..." : "Abrir comanda"}
            </button>
          </form>

          <div className="stack commanda-creation-box">
            <div>
              <p className="eyebrow">Venda avulsa</p>
              <p className="muted">
                Use o nome padrao ou identifique o cliente desde o inicio se a venda puder virar permanencia no local.
              </p>
            </div>

            <label className="field">
              <span>Nome opcional</span>
              <input
                value={singleSaleCustomerName}
                onChange={(event) => setSingleSaleCustomerName(event.target.value)}
                placeholder={SINGLE_SALE_CUSTOMER_NAME}
              />
            </label>

            <button className="button button-secondary" type="button" onClick={handleCreateSingleSale} disabled={isPending}>
              {isPending ? "Criando..." : "Registrar venda avulsa"}
            </button>
          </div>
        </div>

        <div className="stack">
          <label className="field">
            <span>Pesquisar por nome</span>
            <input
              value={commandaSearch}
              onChange={(event) => setCommandaSearch(event.target.value)}
              placeholder="Nome do cliente"
            />
          </label>

          <div className="commanda-tabs" role="tablist" aria-label="Filtros de status das comandas">
            <button
              className={`commanda-tab ${activeCommandaTab === "open" ? "active" : ""}`}
              type="button"
              onClick={() => setActiveCommandaTab("open")}
            >
              Abertas
              <span className="badge neutral">{openCommandasCount}</span>
            </button>
            <button
              className={`commanda-tab ${activeCommandaTab === "closed" ? "active" : ""}`}
              type="button"
              onClick={() => setActiveCommandaTab("closed")}
            >
              Fechadas
              <span className="badge neutral">{closedCommandasCount}</span>
            </button>
          </div>
        </div>

        <div className="commanda-list">
          {visibleCommandas.map((commanda) => (
            <button
              key={commanda.id}
              className={`commanda-card ${selectedComandaId === commanda.id ? "selected" : ""}`}
              type="button"
              onClick={() => setSelectedComandaId(commanda.id)}
            >
              <div>
                <strong>Comanda #{commanda.number}</strong>
                <span>{getCommandaCustomerLabel(commanda.customerName)}</span>
                <span className="table-subtitle">
                  {commanda.status === "closed" && commanda.closedAt
                    ? `Fechada em ${formatRecordedAt(commanda.closedAt)}`
                    : commanda.notes || "Em atendimento"}
                </span>
              </div>
              <div className="commanda-card-meta">
                <span className={`badge ${commanda.status === "open" ? "success" : "neutral"}`}>
                  {getCommandaStatusLabel(commanda.status)}
                </span>
                <strong>{formatCurrency(commanda.totalCents)}</strong>
              </div>
            </button>
          ))}

          {visibleCommandas.length === 0 ? (
            <p className="muted">
              {activeCommandaTab === "open"
                ? "Nenhuma comanda aberta encontrada."
                : "Nenhuma comanda fechada encontrada."}
            </p>
          ) : null}
        </div>
      </section>

      <section className="panel">
        {selectedComanda ? (
          <>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Comanda selecionada</p>
                <h2>Comanda #{selectedComanda.number}</h2>
                <p className="muted">{getCommandaCustomerLabel(selectedComanda.customerName)}</p>
              </div>
              {selectedComanda.status === "open" ? (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={handleCancelCommanda}
                  disabled={isPending}
                >
                  Cancelar
                </button>
              ) : selectedComanda.status === "closed" ? (
                <button className="button button-primary" type="button" onClick={handleReopenCommanda} disabled={isPending}>
                  Reabrir comanda
                </button>
              ) : null}
            </div>

            <div className="selected-commanda-summary">
              <span className={`badge ${selectedComanda.status === "open" ? "success" : "neutral"}`}>
                {getCommandaStatusLabel(selectedComanda.status)}
              </span>
              <span className="muted">Criada em {formatRecordedAt(selectedComanda.createdAt)}</span>
              {selectedComanda.status === "closed" && selectedComanda.closedAt ? (
                <span className="muted">Fechada em {formatRecordedAt(selectedComanda.closedAt)}</span>
              ) : null}
            </div>

            <div className="selected-commanda-grid">
              <form className="rename-row" onSubmit={handleRenameSelectedCommanda}>
                <label className="field">
                  <span>Nome do cliente</span>
                  <input
                    value={renameCustomerName}
                    onChange={(event) => setRenameCustomerName(event.target.value)}
                    placeholder="Sem identificacao"
                  />
                </label>

                <button className="button button-secondary" type="submit" disabled={isPending}>
                  Salvar nome
                </button>
              </form>

              <div className="commanda-note-box">
                <span>Observacoes</span>
                <strong>{selectedComanda.notes || "Sem observacoes registradas."}</strong>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qtd.</th>
                    <th>Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selectedComanda.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.productName}</strong>
                        <span className="table-subtitle">{item.productSku}</span>
                      </td>
                      <td>
                        {selectedComanda.status === "open" ? (
                          <div className="quantity-control quantity-control-inline">
                            <button
                              className="button button-secondary compact"
                              type="button"
                              onClick={() => persistItemQuantity(item, getDraftQuantity(item) - 1)}
                              disabled={isPending || isItemPending(item.id) || getDraftQuantity(item) <= 1}
                            >
                              -
                            </button>
                            <input
                              value={itemQuantityDrafts[item.id] ?? String(item.quantity)}
                              type="number"
                              min="1"
                              step="1"
                              onChange={(event) => setCommandaItemDraft(item.id, event.target.value)}
                              onBlur={() => persistItemQuantity(item, itemQuantityDrafts[item.id] ?? String(item.quantity))}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  persistItemQuantity(item, itemQuantityDrafts[item.id] ?? String(item.quantity));
                                }
                              }}
                              disabled={isPending || isItemPending(item.id)}
                            />
                            <button
                              className="button button-secondary compact"
                              type="button"
                              onClick={() => persistItemQuantity(item, getDraftQuantity(item) + 1)}
                              disabled={isPending || isItemPending(item.id)}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          item.quantity
                        )}
                      </td>
                      <td>{formatCurrency(item.subtotalCents)}</td>
                      <td className="table-actions">
                        {selectedComanda.status === "open" ? (
                          <button
                            className="button button-secondary compact"
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={isPending || isItemPending(item.id)}
                          >
                            Remover
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {selectedComanda.items.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        {selectedComanda.status === "open"
                          ? "Adicione produtos para comecar o atendimento."
                          : "Nenhum item registrado nesta comanda."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="totals-panel">
              <div>
                <span>Subtotal</span>
                <strong>{formatCurrency(selectedComanda.subtotalCents)}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatCurrency(selectedComanda.totalCents)}</strong>
              </div>
            </div>

            {selectedComanda.status === "open" ? (
              <div className="close-panel">
                <div className="panel-header small">
                  <div>
                    <p className="eyebrow">Fechamento</p>
                    <h3>Registrar pagamento</h3>
                  </div>
                  <button
                    className="button button-secondary compact"
                    type="button"
                    onClick={() => setPayments((current) => [...current, createPaymentDraft()])}
                  >
                    Adicionar forma
                  </button>
                </div>

                <div className="stack">
                  {payments.map((payment, index) => (
                    <div className="payment-row" key={`${selectedComanda.id}-${index}`}>
                      <select
                        value={payment.method}
                        onChange={(event) =>
                          setPayments((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, method: event.target.value as PaymentDraft["method"] }
                                : entry,
                            ),
                          )
                        }
                      >
                        <option value="cash">Dinheiro</option>
                        <option value="pix">Pix</option>
                        <option value="debit">Debito</option>
                        <option value="credit">Credito</option>
                      </select>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="R$ 0,00"
                        value={payment.amount}
                        onChange={(event) => setPaymentAmount(index, event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Observacao"
                        value={payment.notes}
                        onChange={(event) =>
                          setPayments((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, notes: event.target.value } : entry,
                            ),
                          )
                        }
                      />
                      {payments.length > 1 ? (
                        <button
                          className="button button-secondary compact"
                          type="button"
                          onClick={() =>
                            setPayments((current) => current.filter((_, entryIndex) => entryIndex !== index))
                          }
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="payment-summary">
                  <span>Total informado</span>
                  <strong>{formatCurrency(paymentSummary.totalCents)}</strong>
                  {paymentDeltaCents > 0 ? (
                    <span className="badge warning">Falta {formatCurrency(paymentDeltaCents)}</span>
                  ) : paymentDeltaCents < 0 ? (
                    <span className="badge warning">Excedeu {formatCurrency(Math.abs(paymentDeltaCents))}</span>
                  ) : (
                    <span className="badge success">Total conferido</span>
                  )}
                </div>

                <button
                  className="button button-primary"
                  type="button"
                  onClick={handleCloseCommanda}
                  disabled={isPending || selectedComanda.items.length === 0}
                >
                  {isPending ? "Finalizando..." : "Fechar venda"}
                </button>
              </div>
            ) : (
              <div className="close-panel">
                <div className="panel-header small">
                  <div>
                    <p className="eyebrow">Conferencia</p>
                    <h3>Fechamento registrado</h3>
                  </div>
                </div>

                <div className="payment-history">
                  {selectedComanda.payments.map((payment) => (
                    <div key={payment.id} className="payment-history-row">
                      <strong>{getPaymentMethodLabel(payment.method)}</strong>
                      <span>{formatCurrency(payment.amountCents)}</span>
                    </div>
                  ))}
                  {selectedComanda.payments.length === 0 ? (
                    <p className="muted">Nao ha pagamentos registrados nesta comanda.</p>
                  ) : null}
                </div>

                <p className="muted">
                  Ao reabrir, os pagamentos atuais serao removidos e a comanda volta para edicao de itens.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="commanda-empty-state">
            <p className="eyebrow">Sem comanda selecionada</p>
            <h2>Escolha uma comanda para continuar</h2>
            <p className="muted">
              Abra uma nova comanda, registre uma venda avulsa ou selecione uma comanda fechada para conferencia.
            </p>
          </div>
        )}
      </section>

      {selectedComanda?.status === "open" ? (
        <section className="panel catalog-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Produtos da comanda</p>
              <h2>Adicionar itens na comanda #{selectedComanda.number}</h2>
              <p className="muted">Os produtos entram diretamente na comanda aberta selecionada.</p>
            </div>
          </div>

          <div className="catalog-toolbar">
            <label className="field">
              <span>Buscar produto</span>
              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Nome, SKU, categoria ou codigo de barras"
              />
            </label>
            <div className="catalog-toolbar-info">
              <span className="badge neutral">{filteredProducts.length} produtos</span>
              <span className="muted">Editando {getCommandaCustomerLabel(selectedComanda.customerName)}.</span>
            </div>
          </div>

          <div className="product-pick-list">
            {filteredProducts.map((product) => (
              <article key={product.id} className="product-pick-card catalog-card">
                <div className="product-card-image">
                  <img
                    src={product.imagePath || "/catalog-placeholder.jpg"}
                    alt={product.name}
                    className="product-card-thumb"
                    width={320}
                    height={220}
                    loading="lazy"
                  />
                </div>
                <div className="product-card-body">
                  <div className="product-card-head">
                    <strong>{product.name}</strong>
                    <span>{formatCurrency(product.priceCents)}</span>
                  </div>
                  <span className="table-subtitle">{buildProductDetails(product)}</span>
                  <div className="pick-card-footer">
                    <span
                      className={
                        product.stockQty < 0
                          ? "badge danger"
                          : product.stockQty <= product.minimumStock
                            ? "badge warning"
                            : "badge neutral"
                      }
                    >
                      Estoque {product.stockQty}
                    </span>
                    <div className="quantity-control">
                      <input
                        value={quantityByProduct[product.id] ?? "1"}
                        type="number"
                        min="1"
                        step="1"
                        onChange={(event) => setProductQuantity(product.id, event.target.value)}
                      />
                      <button
                        className="button button-primary compact"
                        type="button"
                        onClick={() => handleAddItem(product)}
                        disabled={isPending || !product.isActive}
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <p className="muted">Nenhum produto encontrado para o filtro informado.</p>
          ) : null}
        </section>
      ) : (
        <section className="panel commanda-context-panel">
          <div className="commanda-empty-state">
            <p className="eyebrow">Catalogo contextual</p>
            <h2>
              {selectedComanda?.status === "closed"
                ? "Reabra a comanda para voltar a editar itens"
                : "Abra ou selecione uma comanda para liberar os produtos"}
            </h2>
            <p className="muted">
              {selectedComanda?.status === "closed"
                ? "A comanda fechada continua visivel para conferencia, mas o catalogo so reaparece depois da reabertura."
                : "A lista de produtos so aparece quando houver uma comanda aberta selecionada para receber os itens."}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
