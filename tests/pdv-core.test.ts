import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { GET as healthzGet } from "@/app/healthz/route";
import { handleProtectedRoute } from "@/lib/api/route-security";
import { parseJsonBody } from "@/lib/api/response";
import { assertRateLimit, buildRateLimitKey, getRateLimitState, resetRateLimit } from "@/lib/auth/rate-limit";
import { assertCsrfProtection } from "@/lib/auth/session";
import {
  commandaListQuerySchema,
  closeCommandaInputSchema,
  updateCommandaCustomerNameInputSchema,
  updateCommandaItemQuantityInputSchema,
} from "@/lib/schemas/commanda";
import { buildDashboardAnalytics, resolveDashboardAnalyticsRange } from "@/lib/services/report-analytics";
import { createProductInputSchema } from "@/lib/schemas/product";
import { createStockMovementInputSchema } from "@/lib/schemas/stock";
import { filterCommandasByStatusAndCustomerName } from "@/lib/utils/commandas";
import { buildCommandaItemAddition, buildCommandaItemQuantityUpdate } from "@/lib/utils/commanda-items";
import { buildProductsCsv } from "@/lib/utils/product-export";
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

test("healthz responde 200 publico sem cache", async () => {
  const response = await healthzGet();

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ok");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
});

test("gera csv de produtos com estoque e escaping", () => {
  const csv = buildProductsCsv([
    {
      id: "product-1",
      name: 'Combo "Especial"; Verao',
      sku: null,
      barcode: "001234567890",
      category: "Bebidas\nGeladas",
      imagePath: null,
      unit: "un",
      priceCents: 1590,
      costCents: 980,
      stockQty: 12,
      minimumStock: 3,
      isActive: true,
      createdAt: "2026-05-03T00:00:00.000Z",
      updatedAt: "2026-05-03T00:00:00.000Z",
    },
    {
      id: "product-2",
      name: "Produto inativo",
      sku: "SKU-2",
      barcode: "7890000000002",
      category: null,
      imagePath: null,
      unit: "cx",
      priceCents: 4500,
      costCents: null,
      stockQty: 0,
      minimumStock: 0,
      isActive: false,
      createdAt: "2026-05-03T00:00:00.000Z",
      updatedAt: "2026-05-03T00:00:00.000Z",
    },
  ]);

  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"Nome";"SKU";"Codigo de barras";"Categoria";"Unidade";"Preco de venda";"Custo";"Estoque atual";"Estoque minimo";"Status"/);
  assert.match(
    csv,
    /"Combo ""Especial""; Verao";"";"001234567890";"Bebidas\nGeladas";"un";"R\$\s*15,90";"R\$\s*9,80";"12";"3";"Ativo"/,
  );
  assert.match(csv, /"Produto inativo";"SKU-2";"7890000000002";"";"cx";"R\$\s*45,00";"";"0";"0";"Inativo"/);
});

test("limita tentativas de login por rota, IP e usuário", async () => {
  const request = new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "12345678",
    }),
  });
  const key = buildRateLimitKey("auth_login", request, null, {
    identifier: "admin",
  });

  await resetRateLimit(key);
  await assert.doesNotReject(() => assertRateLimit("auth_login", request, null, { identifier: "admin" }));
  await assert.doesNotReject(() => assertRateLimit("auth_login", request, null, { identifier: "admin" }));
  await assert.doesNotReject(() => assertRateLimit("auth_login", request, null, { identifier: "admin" }));
  await assert.doesNotReject(() => assertRateLimit("auth_login", request, null, { identifier: "admin" }));
  await assert.doesNotReject(() => assertRateLimit("auth_login", request, null, { identifier: "admin" }));
  await assert.rejects(
    () => assertRateLimit("auth_login", request, null, { identifier: "admin" }),
    /Muitas tentativas/i,
  );
  assert.ok(await getRateLimitState(key));
});

test("limita escritas autenticadas por usuário, IP e rota", async () => {
  const request = new NextRequest("http://localhost/api/products", {
    method: "POST",
  });
  const session = {
    user: {
      id: "user-1",
    },
  };
  const key = buildRateLimitKey("write_authenticated", request, session);

  await resetRateLimit(key);

  for (let attempt = 0; attempt < 180; attempt += 1) {
    await assert.doesNotReject(() => assertRateLimit("write_authenticated", request, session));
  }

  await assert.rejects(
    () => assertRateLimit("write_authenticated", request, session),
    /Muitas tentativas/i,
  );
});

test("rejeita imagePath remoto ou com path traversal", async () => {
  await assert.rejects(
    () =>
      createProductInputSchema.parseAsync({
        name: "Produto inseguro",
        sku: "",
        barcode: "ABC-123",
        category: "",
        imagePath: "https://evil.test/payload.png",
        unit: "un",
        price: "R$ 10,00",
        cost: "",
        stockQty: "1",
        minimumStock: "0",
      }),
    /caminhos locais/i,
  );

  await assert.rejects(
    () =>
      createProductInputSchema.parseAsync({
        name: "Produto inseguro",
        sku: "",
        barcode: "ABC-123",
        category: "",
        imagePath: "/../../etc/passwd",
        unit: "un",
        price: "R$ 10,00",
        cost: "",
        stockQty: "1",
        minimumStock: "0",
      }),
    /caminhos locais/i,
  );
});

test("valida e limita query params da listagem de comandas", () => {
  const parsed = commandaListQuerySchema.parse({
    status: "closed",
    q: "  Maria   Clara  ",
  });

  assert.deepEqual(parsed, {
    status: "closed",
    q: "Maria Clara",
  });

  assert.throws(
    () =>
      commandaListQuerySchema.parse({
        status: "open",
        q: "x".repeat(81),
      }),
    /no máximo 80 caracteres/i,
  );
});

test("rejeita mutação sem origin permitido no wrapper central", async () => {
  const response = await handleProtectedRoute(
    new NextRequest("http://localhost/api/setup/initial-admin", {
      method: "POST",
      headers: {
        origin: "http://evil.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Admin Seguranca",
        username: "admin",
        password: "12345678",
        confirmPassword: "12345678",
      }),
    }),
    {
      auth: "none",
      requireJsonBody: true,
      requireOrigin: true,
      rateLimitPolicy: "bootstrap_setup",
    },
    async () => NextResponse.json({ ok: true }),
  );

  assert.equal(response.status, 403);
  const payload = await response.json();
  assert.equal(payload.error.code, "invalid_origin");
});

test("rejeita payload acima do limite antes do parse JSON", async () => {
  await assert.rejects(
    () =>
      parseJsonBody(
        new NextRequest("http://localhost/api/test", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            notes: "a".repeat(20_000),
          }),
        }),
      ),
    /excede o limite permitido/i,
  );
});

test("rejeita mutação sem token csrf válido", () => {
  const request = new NextRequest("http://localhost/api/products", {
    method: "POST",
    headers: {
      cookie: "pdv_csrf=csrf-cookie",
    },
  });

  assert.throws(
    () =>
      assertCsrfProtection(request, {
        sessionId: "session-1",
        csrfToken: "csrf-header",
        expiresAt: new Date().toISOString(),
        user: {
          id: "user-1",
          name: "Admin",
          username: "admin",
          role: "admin",
        },
      }),
    /verificação de segurança/i,
  );
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
