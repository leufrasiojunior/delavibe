import assert from "node:assert/strict";
import test from "node:test";

import {
  webhookUrlSchema,
  testMessageInputSchema,
} from "@/lib/schemas/whatsapp";

// --- webhookUrlSchema ---

test("webhookUrlSchema: aceita HTTPS valido", () => {
  const result = webhookUrlSchema.safeParse("https://n8n.example.com/webhook/xyz");
  assert.equal(result.success, true);
});

test("webhookUrlSchema: aceita HTTP localhost", () => {
  const result = webhookUrlSchema.safeParse("http://localhost:3000/hook");
  assert.equal(result.success, true);
});

test("webhookUrlSchema: rejeita string vazia", () => {
  const result = webhookUrlSchema.safeParse("");
  assert.equal(result.success, false);
});

test("webhookUrlSchema: rejeita ftp", () => {
  const result = webhookUrlSchema.safeParse("ftp://server.com");
  assert.equal(result.success, false);
});

test("webhookUrlSchema: rejeita string nao-URL", () => {
  const result = webhookUrlSchema.safeParse("nao-e-url");
  assert.equal(result.success, false);
});

test("webhookUrlSchema: rejeita ws://", () => {
  const result = webhookUrlSchema.safeParse("ws://localhost");
  assert.equal(result.success, false);
});

// --- testMessageInputSchema ---

test("testMessageInputSchema: aceita DDD 2 digitos + numero 9 digitos", () => {
  const result = testMessageInputSchema.safeParse({ ddd: "11", numero: "999887766" });
  assert.equal(result.success, true);
});

test("testMessageInputSchema: aceita DDD 2 digitos + numero 8 digitos", () => {
  const result = testMessageInputSchema.safeParse({ ddd: "11", numero: "33334444" });
  assert.equal(result.success, true);
});

test("testMessageInputSchema: rejeita DDD 1 digito", () => {
  const result = testMessageInputSchema.safeParse({ ddd: "1", numero: "999887766" });
  assert.equal(result.success, false);
});

test("testMessageInputSchema: rejeita numero curto demais (5 digitos)", () => {
  const result = testMessageInputSchema.safeParse({ ddd: "11", numero: "12345" });
  assert.equal(result.success, false);
});

test("testMessageInputSchema: rejeita numero 10 digitos", () => {
  const result = testMessageInputSchema.safeParse({ ddd: "11", numero: "1234567890" });
  assert.equal(result.success, false);
});

test("testMessageInputSchema: rejeita DDD nao numerico", () => {
  const result = testMessageInputSchema.safeParse({ ddd: "ab", numero: "999887766" });
  assert.equal(result.success, false);
});
