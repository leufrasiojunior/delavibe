/**
 * Tests for WhatsApp API routes.
 *
 * The project does not have an in-process HTTP testing harness or session/Prisma
 * mock helpers.  Auth enforcement (401 / 403) is centralised in
 * `handleProtectedRoute` and shared across every route, so it is not
 * unit-tested per-route.
 *
 * These tests verify:
 *  - Route modules export the correct HTTP-method handlers.
 *  - The Zod schemas used for body parsing reject invalid payloads
 *    (which the routes delegate to `parseJsonBody`).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createInstanceInputSchema,
  testMessageInputSchema,
  webhookUrlSchema,
} from "@/lib/schemas/whatsapp";

// ---------------------------------------------------------------------------
// 1. Smoke tests -- route modules export the expected handler functions
// ---------------------------------------------------------------------------

test("instance route exports GET, POST, DELETE", async () => {
  const mod = await import("@/app/api/whatsapp/instance/route");
  assert.equal(typeof mod.GET, "function", "GET must be a function");
  assert.equal(typeof mod.POST, "function", "POST must be a function");
  assert.equal(typeof mod.DELETE, "function", "DELETE must be a function");
});

test("webhook route exports POST", async () => {
  const mod = await import("@/app/api/whatsapp/webhook/route");
  assert.equal(typeof mod.POST, "function", "POST must be a function");
});

test("qr route exports GET", async () => {
  const mod = await import("@/app/api/whatsapp/qr/route");
  assert.equal(typeof mod.GET, "function", "GET must be a function");
});

test("test-message route exports POST", async () => {
  const mod = await import("@/app/api/whatsapp/test-message/route");
  assert.equal(typeof mod.POST, "function", "POST must be a function");
});

test("connected route exports POST", async () => {
  const mod = await import("@/app/api/whatsapp/connected/route");
  assert.equal(typeof mod.POST, "function", "POST must be a function");
});

// ---------------------------------------------------------------------------
// 2. Body validation -- schemas reject invalid payloads (400 path)
// ---------------------------------------------------------------------------

test("createInstanceInputSchema accepts missing webhookUrl (now optional)", async () => {
  const result = await createInstanceInputSchema.safeParseAsync({});
  assert.equal(result.success, true);
});

test("createInstanceInputSchema accepts empty webhookUrl (now optional)", async () => {
  const result = await createInstanceInputSchema.safeParseAsync({
    webhookUrl: "",
  });
  assert.equal(result.success, true);
});

test("createInstanceInputSchema rejects invalid webhookUrl", async () => {
  const result = await createInstanceInputSchema.safeParseAsync({
    token: "",
    webhookUrl: "ftp://invalid",
  });
  assert.equal(result.success, false);
});

test("createInstanceInputSchema accepts valid payload with token", async () => {
  const result = await createInstanceInputSchema.safeParseAsync({
    token: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    webhookUrl: "https://n8n.example.com/webhook/abc",
  });
  assert.equal(result.success, true);
});

test("createInstanceInputSchema accepts valid payload without token", async () => {
  const result = await createInstanceInputSchema.safeParseAsync({
    webhookUrl: "https://n8n.example.com/webhook/abc",
  });
  assert.equal(result.success, true);
});

test("testMessageInputSchema rejects non-numeric DDD", async () => {
  const result = await testMessageInputSchema.safeParseAsync({
    ddd: "ab",
    numero: "999887766",
  });
  assert.equal(result.success, false);
});

test("testMessageInputSchema rejects numero with 7 digits", async () => {
  const result = await testMessageInputSchema.safeParseAsync({
    ddd: "11",
    numero: "1234567",
  });
  assert.equal(result.success, false);
});

test("webhookUrlSchema rejects empty string for webhook route", () => {
  const result = webhookUrlSchema.safeParse("");
  assert.equal(result.success, false);
});

test("webhookUrlSchema rejects non-http protocol for webhook route", () => {
  const result = webhookUrlSchema.safeParse("ws://localhost:8080");
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// 3. Service method existence -- whatsapp-service exports expected API
// ---------------------------------------------------------------------------

test("whatsapp-service exports all methods used by routes", async () => {
  const svc = await import("@/lib/services/whatsapp-service");
  assert.equal(typeof svc.getInstance, "function");
  assert.equal(typeof svc.createInstance, "function");
  assert.equal(typeof svc.deleteInstance, "function");
  assert.equal(typeof svc.getQrCode, "function");
  assert.equal(typeof svc.markConnected, "function");
  assert.equal(typeof svc.sendTestMessage, "function");
  assert.equal(typeof svc.setWebhook, "function");
});
