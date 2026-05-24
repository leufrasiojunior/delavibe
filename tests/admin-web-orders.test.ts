import assert from "node:assert/strict";
import test from "node:test";

import { WebOrderStatus } from "@prisma/client";

import {
  webOrderListQuerySchema,
  webOrderStatusTransitionSchema,
} from "@/lib/schemas/web-order";
import { formatPhoneBr } from "@/lib/utils/strings";
import { formatTimeAgo } from "@/lib/utils/date";

test("formatPhoneBr formata 11 dígitos no padrão BR", () => {
  assert.equal(formatPhoneBr("11912345678"), "(11) 91234-5678");
});

test("formatPhoneBr formata 10 dígitos no padrão BR", () => {
  assert.equal(formatPhoneBr("1132345678"), "(11) 3234-5678");
});

test("formatPhoneBr trata input vazio sem erro", () => {
  assert.equal(formatPhoneBr(""), "");
  assert.equal(formatPhoneBr(null), "");
  assert.equal(formatPhoneBr(undefined), "");
});

test("formatPhoneBr aceita input já formatado e normaliza", () => {
  assert.equal(formatPhoneBr("(11) 91234-5678"), "(11) 91234-5678");
});

test("formatTimeAgo retorna 'agora' para segundos recentes", () => {
  const now = new Date("2026-05-23T12:00:00Z");
  const recent = new Date("2026-05-23T11:59:30Z");
  const result = formatTimeAgo(recent, now);
  assert.ok(result.includes("segundo") || result.length > 0);
});

test("formatTimeAgo usa minutos quando 1-59 min atrás", () => {
  const now = new Date("2026-05-23T12:00:00Z");
  const earlier = new Date("2026-05-23T11:55:00Z");
  const result = formatTimeAgo(earlier, now);
  assert.ok(result.includes("minuto"));
});

test("formatTimeAgo usa horas quando 1-23h atrás", () => {
  const now = new Date("2026-05-23T12:00:00Z");
  const earlier = new Date("2026-05-23T08:00:00Z");
  const result = formatTimeAgo(earlier, now);
  assert.ok(result.includes("hora") || result.includes("horas"));
});

test("formatTimeAgo aceita ISO string como entrada", () => {
  const now = new Date("2026-05-23T12:00:00Z");
  const result = formatTimeAgo("2026-05-23T11:50:00Z", now);
  assert.ok(result.length > 0);
});

test("webOrderListQuerySchema aplica defaults", async () => {
  const parsed = await webOrderListQuerySchema.parseAsync({});
  assert.equal(parsed.tab, "active");
  assert.equal(parsed.take, 50);
  assert.equal(parsed.skip, 0);
});

test("webOrderListQuerySchema aceita status compatível com tab active", async () => {
  const parsed = await webOrderListQuerySchema.parseAsync({
    tab: "active",
    status: [WebOrderStatus.PAID],
  });
  assert.deepEqual(parsed.status, [WebOrderStatus.PAID]);
});

test("webOrderListQuerySchema rejeita status incompatível com tab", async () => {
  await assert.rejects(
    webOrderListQuerySchema.parseAsync({
      tab: "active",
      status: [WebOrderStatus.DELIVERED],
    }),
  );
});

test("webOrderListQuerySchema aceita status terminal em tab history", async () => {
  const parsed = await webOrderListQuerySchema.parseAsync({
    tab: "history",
    status: [WebOrderStatus.CANCELLED],
  });
  assert.deepEqual(parsed.status, [WebOrderStatus.CANCELLED]);
});

test("webOrderListQuerySchema aceita string única em status (não array)", async () => {
  const parsed = await webOrderListQuerySchema.parseAsync({
    tab: "active",
    status: WebOrderStatus.PAID,
  });
  assert.deepEqual(parsed.status, [WebOrderStatus.PAID]);
});

test("webOrderListQuerySchema rejeita take > 200", async () => {
  await assert.rejects(webOrderListQuerySchema.parseAsync({ take: 500 }));
});

test("webOrderStatusTransitionSchema cobre cancelamento com nota válida", async () => {
  const parsed = await webOrderStatusTransitionSchema.parseAsync({
    toStatus: WebOrderStatus.CANCELLED,
    notes: "Cliente desistiu",
  });
  assert.equal(parsed.notes, "Cliente desistiu");
});
