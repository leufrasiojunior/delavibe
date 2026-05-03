import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";

import { assertRateLimit, getRateLimitState, resetRateLimit } from "@/lib/auth/rate-limit";
import {
  closeCommandaInputSchema,
  updateCommandaCustomerNameInputSchema,
  updateCommandaItemQuantityInputSchema,
} from "@/lib/schemas/commanda";
import { buildDashboardAnalytics, resolveDashboardAnalyticsRange } from "@/lib/services/report-analytics";
import { createProductInputSchema } from "@/lib/schemas/product";
import { createStockMovementInputSchema } from "@/lib/schemas/stock";
import { filterCommandasByStatusAndCustomerName } from "@/lib/utils/commandas";
import { buildCommandaItemAddition, buildCommandaItemQuantityUpdate } from "@/lib/utils/commanda-items";
import { calculateCommandaTotals } from "@/lib/utils/totals";

test("normaliza cadastro de produto e converte preço para centavos", async () => {
  const parsed = await createProductInputSchema.parseAsync({
    name: "  Cerveja   Pilsen 600ml ",
    sku: " ",
    barcode: " 123456 ",
    category: " Long Neck ",
    unit: " UN ",
    price: "R$ 12,50",
    cost: "",
    stockQty: "10",
    minimumStock: "3",
    isActive: true,
  });

  assert.equal(parsed.name, "Cerveja Pilsen 600ml");
  assert.equal(parsed.sku, null);
  assert.equal(parsed.barcode, "123456");
  assert.equal(parsed.priceCents, 1250);
  assert.equal(parsed.costCents, null);
  assert.equal(parsed.unit, "un");
});

test("rejeita produto sem código de barras com mensagem clara", async () => {
  await assert.rejects(
    () =>
      createProductInputSchema.parseAsync({
        name: "Produto sem código",
        sku: "",
        barcode: "",
        category: "",
        unit: "un",
        price: "R$ 10,00",
        cost: "",
        stockQty: "1",
        minimumStock: "0",
      }),
    (error) => {
      assert.ok(error instanceof ZodError);
      assert.match(error.issues[0]?.message ?? "", /código de barras/i);
      return true;
    },
  );
});

test("rejeita entrada manual com quantidade negativa", async () => {
  await assert.rejects(
    () =>
      createStockMovementInputSchema.parseAsync({
        productId: "ckaaaaaaaaaaaaaaaaaaaaaaa",
        reason: "manual_entry",
        quantity: -2,
        notes: "teste",
      }),
    /Entradas manuais precisam ser positivas/,
  );
});

test("soma totais da comanda em centavos", () => {
  const totals = calculateCommandaTotals([
    { subtotalCents: 1200 },
    { subtotalCents: 800 },
  ]);

  assert.deepEqual(totals, {
    subtotalCents: 2000,
    discountCents: 0,
    totalCents: 2000,
  });
});

test("transforma pagamentos do fechamento para centavos", async () => {
  const parsed = await closeCommandaInputSchema.parseAsync({
    payments: [
      { method: "pix", amount: "R$ 10,50" },
      { method: "cash", amount: "R$ 5,25", notes: "troco separado" },
      { method: "credit", amount: "", notes: "" },
    ],
  });

  assert.deepEqual(parsed.payments, [
    { method: "pix", amountCents: 1050, notes: null },
    { method: "cash", amountCents: 525, notes: "troco separado" },
  ]);
});

test("normaliza o nome do cliente ao renomear a comanda", async () => {
  const parsedWithName = await updateCommandaCustomerNameInputSchema.parseAsync({
    customerName: "  Maria Clara  ",
  });
  const parsedWithoutName = await updateCommandaCustomerNameInputSchema.parseAsync({
    customerName: "   ",
  });

  assert.deepEqual(parsedWithName, {
    customerName: "Maria Clara",
  });

  assert.deepEqual(parsedWithoutName, {
    customerName: null,
  });
});

test("valida atualizacao de quantidade da comanda com inteiro positivo", async () => {
  const parsed = await updateCommandaItemQuantityInputSchema.parseAsync({
    quantity: "4",
  });

  assert.deepEqual(parsed, {
    quantity: 4,
  });

  await assert.rejects(
    () =>
      updateCommandaItemQuantityInputSchema.parseAsync({
        quantity: "0",
      }),
    /maior que zero/i,
  );
});

test("soma o mesmo item da comanda usando o preco atual", () => {
  const nextItem = buildCommandaItemAddition(2, 3, 1800);

  assert.deepEqual(nextItem, {
    nextQuantity: 5,
    subtotalCents: 9000,
    stockDelta: -3,
  });
});

test("recalcula delta de estoque ao editar quantidade do item da comanda", () => {
  const increase = buildCommandaItemQuantityUpdate(2, 5, 1800);
  const decrease = buildCommandaItemQuantityUpdate(5, 3, 1800);

  assert.deepEqual(increase, {
    nextQuantity: 5,
    quantityDelta: 3,
    subtotalCents: 9000,
    stockDelta: -3,
  });

  assert.deepEqual(decrease, {
    nextQuantity: 3,
    quantityDelta: -2,
    subtotalCents: 5400,
    stockDelta: 2,
  });
});

test("rejeita fechamento com linha de pagamento preenchida sem valor", async () => {
  await assert.rejects(
    () =>
      closeCommandaInputSchema.parseAsync({
        payments: [
          { method: "pix", amount: "", notes: "faltou valor" },
        ],
      }),
    /valor da forma de pagamento preenchida/i,
  );
});

test("limita tentativas com janela simples em memória", () => {
  const key = "test-rate-limit";
  resetRateLimit(key);

  assert.doesNotThrow(() => assertRateLimit(key, 2, 1_000));
  assert.doesNotThrow(() => assertRateLimit(key, 2, 1_000));
  assert.throws(() => assertRateLimit(key, 2, 1_000), /Muitas tentativas/);
  assert.ok(getRateLimitState(key));
});

test("usa últimos 7 dias no dashboard analítico quando a URL está vazia ou inválida", () => {
  const now = new Date(2026, 4, 1, 15, 30, 0);
  const defaultRange = resolveDashboardAnalyticsRange(undefined, undefined, now);
  const invalidRange = resolveDashboardAnalyticsRange("invalida", "2026-05-02", now);

  assert.deepEqual(
    {
      startInput: defaultRange.startInput,
      endInput: defaultRange.endInput,
      isDefault: defaultRange.isDefault,
    },
    {
      startInput: "2026-04-25",
      endInput: "2026-05-01",
      isDefault: true,
    },
  );

  assert.deepEqual(
    {
      startInput: invalidRange.startInput,
      endInput: invalidRange.endInput,
      isDefault: invalidRange.isDefault,
    },
    {
      startInput: "2026-04-25",
      endInput: "2026-05-01",
      isDefault: true,
    },
  );
});

test("agrega analytics por período e preenche dias sem venda", () => {
  const analytics = buildDashboardAnalytics(
    [
      {
        closedAt: new Date(2026, 4, 1, 12, 0, 0),
        totalCents: 3000,
        items: [
          {
            productId: "product-a",
            productName: "Gin Tônica",
            quantity: 2,
            totalCents: 2000,
          },
          {
            productId: "product-b",
            productName: "Cerveja",
            quantity: 1,
            totalCents: 1000,
          },
        ],
      },
      {
        closedAt: new Date(2026, 4, 3, 19, 45, 0),
        totalCents: 4500,
        items: [
          {
            productId: "product-b",
            productName: "Cerveja",
            quantity: 3,
            totalCents: 3000,
          },
          {
            productId: "product-c",
            productName: "Água",
            quantity: 1,
            totalCents: 1500,
          },
        ],
      },
    ],
    {
      startDate: new Date(2026, 4, 1, 0, 0, 0),
      endDate: new Date(2026, 4, 3, 23, 59, 59),
    },
  );

  assert.deepEqual(analytics.summary, {
    totalSalesCents: 7500,
    closedCommandasCount: 2,
    averageTicketCents: 3750,
    itemsSoldCount: 7,
  });

  assert.deepEqual(analytics.salesByDay, [
    {
      date: "2026-05-01",
      label: "01/05",
      displayDate: "01/05/2026",
      totalSalesCents: 3000,
      closedCommandasCount: 1,
    },
    {
      date: "2026-05-02",
      label: "02/05",
      displayDate: "02/05/2026",
      totalSalesCents: 0,
      closedCommandasCount: 0,
    },
    {
      date: "2026-05-03",
      label: "03/05",
      displayDate: "03/05/2026",
      totalSalesCents: 4500,
      closedCommandasCount: 1,
    },
  ]);
});

test("ordena ranking do dashboard analítico por quantidade e desempata por faturamento", () => {
  const analytics = buildDashboardAnalytics(
    [
      {
        closedAt: new Date(2026, 4, 1, 11, 0, 0),
        totalCents: 7000,
        items: [
          {
            productId: "product-a",
            productName: "Drink A",
            quantity: 3,
            totalCents: 3000,
          },
          {
            productId: "product-b",
            productName: "Drink B",
            quantity: 3,
            totalCents: 3500,
          },
          {
            productId: "product-c",
            productName: "Drink C",
            quantity: 2,
            totalCents: 500,
          },
        ],
      },
    ],
    {
      startDate: new Date(2026, 4, 1, 0, 0, 0),
      endDate: new Date(2026, 4, 1, 23, 59, 59),
    },
  );

  assert.deepEqual(
    analytics.topProducts.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      totalCents: item.totalCents,
    })),
    [
      { productId: "product-b", quantity: 3, totalCents: 3500 },
      { productId: "product-a", quantity: 3, totalCents: 3000 },
      { productId: "product-c", quantity: 2, totalCents: 500 },
    ],
  );
});

test("filtra comandas por aba de status e nome do cliente", () => {
  const commandas: Array<{ id: string; status: "open" | "closed"; customerName: string | null }> = [
    { id: "1", status: "open", customerName: "Maria Clara" },
    { id: "2", status: "open", customerName: null },
    { id: "3", status: "closed", customerName: "Joao Pedro" },
    { id: "4", status: "closed", customerName: "Maria Fernanda" },
  ];

  assert.deepEqual(
    filterCommandasByStatusAndCustomerName(commandas, "open", "maria").map((commanda) => commanda.id),
    ["1"],
  );

  assert.deepEqual(
    filterCommandasByStatusAndCustomerName(commandas, "closed", "maria").map((commanda) => commanda.id),
    ["4"],
  );
});

test("nao considera comandas sem nome quando a pesquisa nominal estiver preenchida", () => {
  const commandas: Array<{ id: string; status: "open" | "closed"; customerName: string | null }> = [
    { id: "1", status: "open", customerName: null },
    { id: "2", status: "open", customerName: "Balcao A" },
  ];

  assert.deepEqual(
    filterCommandasByStatusAndCustomerName(commandas, "open", "balcao").map((commanda) => commanda.id),
    ["2"],
  );
});
